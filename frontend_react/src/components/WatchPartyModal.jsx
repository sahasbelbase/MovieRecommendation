import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2,
  Users, MessageSquare, Send, Sparkles, Share2, Copy, Check,
  Monitor, ExternalLink, RefreshCw, Crown, Film, Radio, Tv, Lock,
  AppWindow
} from 'lucide-react';
import api, { getWsUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

const REACTION_EMOJIS = ['❤️', '😂', '🍿', '🔥', '😱', '👏'];

// STUN servers for WebRTC PeerConnections
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function WatchPartyModal({
  isOpen,
  onClose,
  roomCode: propRoomCode,
  movie: propMovie,
  initialVideoSource = null,
  onShowToast,
  onRequireAuth,
}) {
  const { user } = useAuth();

  // Guest identity & Join status
  const [guestName, setGuestName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cinematch_guest_name') || '';
    }
    return '';
  });

  const [hasJoined, setHasJoined] = useState(() => {
    return Boolean(user) || (typeof window !== 'undefined' && Boolean(localStorage.getItem('cinematch_guest_name')));
  });

  const [myGuestId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cinematch_theater_uid');
      if (stored) return stored;
      const newId = `guest_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('cinematch_theater_uid', newId);
      return newId;
    }
    return `guest_${Math.random().toString(36).substring(2, 9)}`;
  });

  const myUserId = user?.uid || myGuestId;
  const myUserName = user?.displayName || user?.email?.split('@')[0] || guestName || 'Friend';

  useEffect(() => {
    if (user) {
      setHasJoined(true);
    }
  }, [user]);

  // Room & theater state
  const [roomCode, setRoomCode] = useState(propRoomCode ? propRoomCode.toUpperCase() : '');
  const [movie, setMovie] = useState(propMovie || null);
  const [videoSource, setVideoSource] = useState(initialVideoSource || null);
  const [hostId, setHostId] = useState('');
  const [hostName, setHostName] = useState('');
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (propRoomCode) {
      setRoomCode(propRoomCode.toUpperCase());
    }
  }, [propRoomCode]);

  useEffect(() => {
    if (propMovie) {
      setMovie(propMovie);
    }
  }, [propMovie]);

  useEffect(() => {
    if (initialVideoSource) {
      setVideoSource(initialVideoSource);
    }
  }, [initialVideoSource]);

  // Playback sync state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120); // default trailer seconds
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState('watch'); // 'watch' | 'screen' | 'external'
  const [countdown, setCountdown] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Animated floating reactions
  const [reactions, setReactions] = useState([]);

  // WebRTC Screen Share state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  // Refs
  const wsRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // userId -> RTCPeerConnection
  const pendingIceCandidatesRef = useRef({}); // userId -> Array of ICE candidates
  const handleServerEventRef = useRef(null);
  const chatScrollRef = useRef(null);
  const isHost = myUserId === hostId;
  const lastSyncTimeRef = useRef(0);
  const isSeekingRef = useRef(false);

  // Fullscreen theater state and container ref
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalContainerRef = useRef(null);
  const [isLoadingTheater, setIsLoadingTheater] = useState(true);
  const [pipContainer, setPipContainer] = useState(null);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const el = modalContainerRef.current;
        if (el?.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el?.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el?.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle error:', err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen || !user) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, user, toggleFullscreen]);

  // Open Always-on-Top Floating Chat PiP / Companion Window
  const openPopoutChat = useCallback(async () => {
    // 1. Modern Chromium Document Picture-in-Picture API (System Always-on-Top)
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 360,
          height: 560,
        });

        // Copy active stylesheets so styles render properly inside the PiP body
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = styleSheet.type;
            link.media = styleSheet.media;
            link.href = styleSheet.href;
            pipWindow.document.head.appendChild(link);
          }
        });

        pipWindow.document.body.className = 'bg-zinc-950 text-white m-0 p-0 overflow-hidden font-sans';
        setPipContainer(pipWindow.document.body);

        pipWindow.addEventListener('pagehide', () => {
          setPipContainer(null);
        });
        return;
      } catch (err) {
        console.warn('Document PiP request error, falling back to popup window:', err);
      }
    }

    // 2. Safari / Firefox Fallback: Floating Companion Window
    const w = 380;
    const h = 580;
    const left = window.screen.width - w - 20;
    const top = 80;
    const popoutUrl = `${window.location.origin}/?party=${roomCode}&view=chat`;
    const popup = window.open(
      popoutUrl,
      `CinematchParty_${roomCode}`,
      `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=no,status=no`
    );
    if (popup) popup.focus();
  }, [roomCode]);

  // 1. Initialize or join Theater session
  const initTheater = useCallback(async () => {
    if (!roomCode) return;
    setIsLoadingTheater(true);
    try {
      // 1. First attempt to fetch existing theater state (ideal for joining friends)
      let th = null;
      try {
        const stateRes = await api.get(`/rooms/${roomCode}/theater/state`);
        if (stateRes.data?.theater) {
          th = stateRes.data.theater;
        }
      } catch (err) {
        // 404: Session not created yet, proceed to start below
      }

      // 2. If no existing session found, initialize it with host credentials
      if (!th) {
        const res = await api.post(`/rooms/${roomCode}/theater/start`, {
          host_id: myUserId,
          host_name: myUserName,
          movie: propMovie || undefined,
          video_source: initialVideoSource || undefined,
        });
        th = res.data.theater;
      }

      if (th) {
        setHostId(th.host_id);
        setHostName(th.host_name);
        if (th.movie && (!movie || !movie.title)) {
          setMovie(th.movie);
        }
        if (th.video_source) {
          setVideoSource(th.video_source);
        }
        setParticipants(th.participants || []);
        setChatMessages(th.chat_history || []);
        setIsPlaying(th.playback?.is_playing || false);
        setCurrentTime(th.playback?.current_time || 0);

        if (th.video_source?.type === 'webrtc' || (th.webrtc_streamer_id && th.webrtc_streamer_id !== myUserId)) {
          setActiveTab('screen');
        }
      }
    } catch (err) {
      console.error('Failed to initialize theater session:', err);
    } finally {
      setIsLoadingTheater(false);
    }
  }, [roomCode, myUserId, myUserName, propMovie, initialVideoSource]);

  // 2. Connect WebSocket for real-time synchronization
  useEffect(() => {
    if (!isOpen || !roomCode || !hasJoined) return;

    initTheater();

    const wsUrl = getWsUrl(`/rooms/${roomCode}/theater/ws?user_id=${encodeURIComponent(myUserId)}&user_name=${encodeURIComponent(myUserName)}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Theater WebSocket connected');
      // Request active screen stream if host is already sharing
      ws.send(
        JSON.stringify({
          type: 'WEBRTC_SIGNAL',
          payload: {
            stream_action: 'request_screen',
          },
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEventRef.current?.(data);
      } catch (err) {
        console.error('Failed parsing theater WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Theater WebSocket closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      // Clean up WebRTC tracks
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [isOpen, roomCode, hasJoined, myUserId, myUserName]);

  // 3. Handle incoming WebSocket events
  const handleServerEvent = async (data) => {
    switch (data.type) {
      case 'INITIAL_SYNC': {
        const st = data.state;
        if (st.host_id) setHostId(st.host_id);
        if (st.host_name) setHostName(st.host_name);
        if (st.movie) setMovie(st.movie);
        if (st.video_source) {
          setVideoSource(st.video_source);
          setIsLoadingTheater(false);
        }
        if (st.participants) setParticipants(st.participants);
        if (st.chat_history) setChatMessages(st.chat_history);
        setIsPlaying(st.playback?.is_playing || false);
        setCurrentTime(st.playback?.current_time || 0);

        // Sync YouTube player if already mounted
        if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
          ytPlayerRef.current.seekTo(st.playback?.current_time || 0, true);
          if (st.playback?.is_playing) {
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.pauseVideo();
          }
        }
        break;
      }

      case 'PARTICIPANT_JOINED': {
        if (data.participants) setParticipants(data.participants);
        if (onShowToast && data.participant) {
          onShowToast({ message: `${data.participant.name} joined the Watch Party 🍿` });
        }
        if (localScreenStreamRef.current && data.participant?.id && data.participant.id !== myUserId) {
          console.log(`[Host] Auto-sending screen share offer to newcomer: ${data.participant.id}`);
          sendScreenOfferToPeer(data.participant.id, localScreenStreamRef.current);
        }
        break;
      }

      case 'PARTICIPANT_LEFT': {
        if (data.participants) setParticipants(data.participants);
        if (data.new_host_id) setHostId(data.new_host_id);
        break;
      }

      case 'PLAY': {
        setIsPlaying(true);
        const targetTime = data.currentTime || data.current_time;
        if (typeof targetTime === 'number') {
          setCurrentTime(targetTime);
          if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            const currentPTime = ytPlayerRef.current.getCurrentTime?.() || 0;
            if (Math.abs(currentPTime - targetTime) > 1.2) {
              ytPlayerRef.current.seekTo(targetTime, true);
            }
            ytPlayerRef.current.playVideo();
          }
        }
        break;
      }

      case 'PAUSE': {
        setIsPlaying(false);
        const targetTime = data.currentTime || data.current_time;
        if (typeof targetTime === 'number') {
          setCurrentTime(targetTime);
          if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
            ytPlayerRef.current.pauseVideo();
          }
        }
        break;
      }

      case 'SEEK': {
        const targetTime = data.currentTime || data.current_time;
        if (typeof targetTime === 'number') {
          setCurrentTime(targetTime);
          if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(targetTime, true);
          }
        }
        break;
      }

      case 'SOURCE_CHANGED': {
        const newSrc = data.source || data.video_source;
        if (newSrc) {
          setVideoSource(newSrc);
          setIsPlaying(false);
          setCurrentTime(0);
          if (newSrc.type === 'webrtc') {
            setActiveTab('screen');
          }
        }
        break;
      }

      case 'REACTION': {
        triggerFloatingReaction(data.emoji, data.user_name);
        break;
      }

      case 'CHAT': {
        const newMsg = data.message || {
          id: data.id || `msg_${Date.now()}`,
          user_id: data.user_id,
          user_name: data.sender_name,
          text: data.text,
          timestamp: Date.now() / 1000,
          video_time: currentTime,
        };
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) {
            return prev;
          }
          return [...prev, newMsg];
        });
        if (!isChatOpen) {
          setUnreadChatCount((prev) => prev + 1);
        }
        // Auto scroll
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 80);
        break;
      }

      case 'WEBRTC_SIGNAL': {
        handleWebRTCSignal(data);
        break;
      }

      default:
        break;
    }
  };

  // Keep latest handler in ref to prevent stale closures in WebSocket event listeners
  handleServerEventRef.current = handleServerEvent;

  // Helper to initiate or send WebRTC screen share offer to a specific peer
  const sendScreenOfferToPeer = useCallback(async (targetId, stream) => {
    if (!targetId || targetId === myUserId || !stream) return;
    try {
      if (peerConnectionsRef.current[targetId]) {
        try { peerConnectionsRef.current[targetId].close(); } catch (_) {}
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current[targetId] = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'WEBRTC_SIGNAL',
              payload: {
                target_id: targetId,
                signal: { candidate: event.candidate },
              },
            })
          );
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'WEBRTC_SIGNAL',
            payload: {
              target_id: targetId,
              stream_action: 'start_screen',
              signal: { sdp: pc.localDescription },
            },
          })
        );
      }
    } catch (err) {
      console.error(`Failed to send screen offer to ${targetId}:`, err);
    }
  }, [myUserId]);

  // 4. WebRTC Signaling Handler (Screen Sharing)
  const handleWebRTCSignal = async (data) => {
    const { sender_id, signal, stream_action } = data;

    if (stream_action === 'start_screen') {
      setActiveTab('screen');
      if (onShowToast) onShowToast({ message: `${data.sender_name || 'Host'} started screen sharing 🖥️` });
    } else if (stream_action === 'stop_screen') {
      setRemoteStream(null);
      setActiveTab('watch');
      if (onShowToast) onShowToast({ message: 'Screen sharing ended' });
      return;
    } else if (stream_action === 'request_screen') {
      // Peer requested the active screen stream
      if (localScreenStreamRef.current && sender_id && sender_id !== myUserId) {
        console.log(`[Host] Responding to request_screen from peer ${sender_id}`);
        sendScreenOfferToPeer(sender_id, localScreenStreamRef.current);
      }
      return;
    }

    if (!signal) return;

    // Handle SDP Offers & Answers
    if (signal.sdp) {
      if (signal.sdp.type === 'offer') {
        // Close previous peer connection if any
        if (peerConnectionsRef.current[sender_id]) {
          try { peerConnectionsRef.current[sender_id].close(); } catch (_) {}
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnectionsRef.current[sender_id] = pc;

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            setActiveTab('screen');
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'WEBRTC_SIGNAL',
                payload: {
                  target_id: sender_id,
                  signal: { candidate: event.candidate },
                },
              })
            );
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Drain any queued ICE candidates that arrived before remote description
        if (pendingIceCandidatesRef.current[sender_id]) {
          for (const cand of pendingIceCandidatesRef.current[sender_id]) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('Error adding queued ICE candidate:', e);
            }
          }
          delete pendingIceCandidatesRef.current[sender_id];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'WEBRTC_SIGNAL',
              payload: {
                target_id: sender_id,
                signal: { sdp: pc.localDescription },
              },
            })
          );
        }
      } else if (signal.sdp.type === 'answer') {
        const pc = peerConnectionsRef.current[sender_id];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          // Drain queued ICE candidates on host side
          if (pendingIceCandidatesRef.current[sender_id]) {
            for (const cand of pendingIceCandidatesRef.current[sender_id]) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('Error adding queued ICE candidate:', e);
              }
            }
            delete pendingIceCandidatesRef.current[sender_id];
          }
        }
      }
    } else if (signal.candidate) {
      const pc = peerConnectionsRef.current[sender_id];
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      } else {
        if (!pendingIceCandidatesRef.current[sender_id]) {
          pendingIceCandidatesRef.current[sender_id] = [];
        }
        pendingIceCandidatesRef.current[sender_id].push(signal.candidate);
      }
    }
  };

  // Host starts screen sharing
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: { ideal: 30, max: 60 } },
        audio: true,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'include',
      });

      localScreenStreamRef.current = stream;
      setIsScreenSharing(true);
      setActiveTab('screen');

      // Notify peers that screen share started
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'WEBRTC_SIGNAL',
            payload: { stream_action: 'start_screen' },
          })
        );
      }

      // Handle user stopping screen share via browser stop button
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Prompt or offer popout chat for convenient multi-tab chatting
      if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
        openPopoutChat().catch(() => {});
      }

      // Create WebRTC offers for all other participants in the room
      participants.forEach((p) => {
        if (p.id !== myUserId) {
          sendScreenOfferToPeer(p.id, stream);
        }
      });
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
    }
  };

  const stopScreenShare = () => {
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      localScreenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setActiveTab('watch');

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'WEBRTC_SIGNAL',
          payload: { stream_action: 'stop_screen' },
        })
      );
    }
  };

  // 5. YouTube Iframe API Loader & Initialization
  useEffect(() => {
    if (activeTab !== 'watch' || !videoSource?.src) return;

    let playerInstance = null;
    let pollInterval = null;
    let isCleanedUp = false;

    const createPlayer = () => {
      if (isCleanedUp || !ytContainerRef.current || !window.YT || !window.YT.Player) return false;

      // Clear container children before creating iframe to prevent duplicates
      ytContainerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.className = 'w-full h-full';
      ytContainerRef.current.appendChild(playerDiv);

      playerInstance = new window.YT.Player(playerDiv, {
        videoId: videoSource.src,
        playerVars: {
          autoplay: 0,
          controls: 0, // Custom synchronized controls
          disablekb: 1,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (isCleanedUp) return;
            ytPlayerRef.current = event.target;
            const dur = event.target.getDuration();
            if (dur) setDuration(dur);
            if (currentTime > 0) {
              event.target.seekTo(currentTime, true);
            }
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (isCleanedUp) return;
            // YT.PlayerState.ENDED = 0, PLAYING = 1, PAUSED = 2
            if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
          },
        },
      });
      return true;
    };

    if (!createPlayer()) {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }

      pollInterval = setInterval(() => {
        if (createPlayer()) {
          clearInterval(pollInterval);
        }
      }, 150);
    }

    return () => {
      isCleanedUp = true;
      if (pollInterval) clearInterval(pollInterval);
      if (playerInstance && typeof playerInstance.destroy === 'function') {
        try {
          playerInstance.destroy();
        } catch (e) {
          // ignore
        }
      }
      ytPlayerRef.current = null;
    };
  }, [videoSource?.src, activeTab]);

  // Periodic time update ticker for UI scrubber
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        const timeNow = ytPlayerRef.current.getCurrentTime();
        if (typeof timeNow === 'number') {
          setCurrentTime(timeNow);
        }
      } else {
        setCurrentTime((prev) => prev + 0.5);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // 6. Playback Control Actions (Broadcast to all peers)
  const togglePlayPause = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    let sendTime = currentTime;
    if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      sendTime = ytPlayerRef.current.getCurrentTime() || currentTime;
      if (nextPlaying) {
        ytPlayerRef.current.playVideo();
      } else {
        ytPlayerRef.current.pauseVideo();
      }
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: nextPlaying ? 'PLAY' : 'PAUSE',
          payload: { currentTime: sendTime },
        })
      );
    }
  };

  const handleSeek = (seconds) => {
    const clamped = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(clamped);

    if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(clamped, true);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SEEK',
          payload: { currentTime: clamped },
        })
      );
    }
  };

  const handleSkip = (delta) => {
    handleSeek(currentTime + delta);
  };

  // 7. Reaction Cannon System
  const triggerFloatingReaction = (emoji, userName = 'Someone') => {
    const id = `react_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const randomLeft = 40 + Math.floor(Math.random() * 50); // 40% - 90%
    const randomRotation = -20 + Math.floor(Math.random() * 40);

    setReactions((prev) => [
      ...prev,
      { id, emoji, userName, left: randomLeft, rotation: randomRotation },
    ]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
  };

  const sendReaction = (emoji) => {
    triggerFloatingReaction(emoji, 'You');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'REACTION',
          payload: { emoji },
        })
      );
    }
  };

  // 8. Live Chat Sending
  const sendChatMessage = (e) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMsg = {
      id: msgId,
      user_id: myUserId,
      user_name: myUserName,
      text,
      timestamp: Date.now() / 1000,
      video_time: currentTime,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput('');

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CHAT',
          payload: { id: msgId, text, videoTime: currentTime },
        })
      );
    }

    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 50);
  };

  // 9. Countdown Sync for External Services (Tier 3)
  const startExternalCountdown = () => {
    let count = 5;
    setCountdown(count);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CHAT',
          payload: { text: '⏱️ Host started 5-second countdown to press PLAY!' },
        })
      );
    }

    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else if (count === 0) {
        setCountdown('PLAY NOW! 🍿');
      } else {
        clearInterval(timer);
        setTimeout(() => setCountdown(null), 2500);
      }
    }, 1000);
  };

  // Mobile Native Share or Desktop Clipboard Copy
  const handleShareParty = async () => {
    const url = `${window.location.origin}/?party=${roomCode}`;
    const shareData = {
      title: `Cinematch Watch Party (Room ${roomCode})`,
      text: `🍿 Join my Watch Party on Cinematch (Room: ${roomCode})! Watch live screen share and chat with me:`,
      url: url,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        if (onShowToast) onShowToast({ message: 'Invitation sent! 🍿' });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share error:', err);
        } else {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      if (onShowToast) onShowToast({ message: 'Watch Party link copied to clipboard! 📋' });
    } catch (_) {
      if (onShowToast) onShowToast({ message: `Room link: ${url}` });
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  if (!hasJoined && !user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fade-in select-none">
        <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 shadow-xl shadow-rose-950/60">
            <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center text-3xl">
              🍿
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>LIVE WATCH PARTY</span>
            </div>
            <h3 className="text-xl font-bold text-white">
              Join Room {roomCode}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Watch movies, live stream screens, chat in real-time, and react together!
            </p>
          </div>

          {/* Fast Guest Nickname Join */}
          <div className="space-y-3 pt-1 text-left">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                Your Nickname
              </label>
              <input
                type="text"
                value={guestName}
                maxLength={20}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Alex or MovieBuff"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const name = guestName.trim() || 'Cinephile';
                    setGuestName(name);
                    if (typeof window !== 'undefined') localStorage.setItem('cinematch_guest_name', name);
                    setHasJoined(true);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-rose-500 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            <button
              onClick={() => {
                const name = guestName.trim() || 'Cinephile';
                setGuestName(name);
                if (typeof window !== 'undefined') localStorage.setItem('cinematch_guest_name', name);
                setHasJoined(true);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-rose-950/60 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Join Watch Party Now</span>
              <span>🍿</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-800 w-full" />
            <span className="bg-zinc-950 px-3 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">or</span>
          </div>

          {/* Google Sign In option */}
          <button
            onClick={() => {
              if (onRequireAuth) onRequireAuth();
            }}
            className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <span>Sign In with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in select-none ${
        isFullscreen ? 'p-0' : 'p-0 sm:p-4'
      }`}
    >
      {/* Container */}
      <div
        ref={modalContainerRef}
        className={`relative w-full h-full bg-zinc-950 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'w-screen h-screen sm:max-w-none sm:h-screen sm:rounded-none sm:border-0'
            : 'sm:h-[94vh] sm:max-w-7xl sm:border sm:border-zinc-800/80 sm:rounded-3xl'
        }`}
      >
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800/60 backdrop-blur z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>LIVE PARTY</span>
            </div>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                {movie?.title || 'Cinematch Theater'}
                {movie?.year && <span className="text-xs text-zinc-400 font-normal">({movie.year})</span>}
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                <span>Room: <strong className="text-amber-400 tracking-wider">{roomCode}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  {isHost ? 'You are Host' : `Host: ${hostName || 'Leader'}`}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareParty}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-all active:scale-95"
              title="Share party invitation via WhatsApp, Instagram, iMessage, etc."
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied!' : 'Share Party'}</span>
            </button>

            {/* Chat toggle button */}
            <button
              onClick={() => {
                setIsChatOpen(!isChatOpen);
                setUnreadChatCount(0);
              }}
              className="relative p-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95"
              title="Toggle Live Chat"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadChatCount}
                </span>
              )}
            </button>

            {/* Fullscreen toggle button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95"
              title={isFullscreen ? 'Exit Full Screen (F)' : 'Full Screen Mode (F)'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-rose-400" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (Watch Trailer / Screen Share / External App Sync) */}
        <div className="flex items-center gap-1 px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/40 text-xs font-medium overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('watch')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'watch'
                ? 'bg-rose-600 text-white font-semibold shadow-md shadow-rose-950/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Synced Video & Trailer</span>
          </button>

          <button
            onClick={() => setActiveTab('screen')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'screen'
                ? 'bg-purple-600 text-white font-semibold shadow-md shadow-purple-950/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Live Screen Share (Discord/SharePlay)</span>
          </button>

          <button
            onClick={() => setActiveTab('external')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'external'
                ? 'bg-amber-600 text-white font-semibold shadow-md shadow-amber-950/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Streaming Apps Sync (Netflix/Prime)</span>
          </button>
        </div>

        {/* Main Body (Video Stage + Chat Drawer) */}
        <div className="relative flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left / Top: Video Stage */}
          <div
            onDoubleClick={toggleFullscreen}
            className="relative flex-1 flex flex-col bg-black justify-center items-center overflow-hidden cursor-pointer"
            title="Double-click to toggle fullscreen (F)"
          >
            
            {/* Mode A: Synchronized YouTube / Video Player */}
            {activeTab === 'watch' && (
              <div className="relative w-full h-full flex flex-col justify-center items-center">
                {videoSource?.src ? (
                  <div
                    onDoubleClick={toggleFullscreen}
                    className={`relative w-full ${
                      isFullscreen ? 'h-full max-h-none flex-1' : 'aspect-video max-h-[75vh]'
                    } bg-black flex items-center justify-center cursor-pointer`}
                    title="Double-click to toggle fullscreen (F)"
                  >
                    <div ref={ytContainerRef} className="w-full h-full" />
                  </div>
                ) : isLoadingTheater ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center animate-spin">
                      <RefreshCw className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Connecting to Watch Party...</h3>
                      <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                        Synchronizing synchronized stream and room settings with {hostName || 'host'}...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                    <Film className="w-12 h-12 text-zinc-700 animate-pulse" />
                    <h3 className="text-lg font-bold text-white">Trailer not found</h3>
                    <p className="text-xs text-zinc-400 max-w-sm">
                      Switch to "Live Screen Share" tab to stream any video from your screen, or use the "Streaming Apps Sync" mode.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mode B: WebRTC Screen Sharing Player */}
            {activeTab === 'screen' && (
              <div className="relative w-full h-full flex flex-col justify-center items-center p-4">
                {isScreenSharing ? (
                  <div
                    onDoubleClick={toggleFullscreen}
                    className={`relative w-full ${
                      isFullscreen ? 'h-full max-h-none flex-1 rounded-none border-0' : 'aspect-video max-h-[75vh] rounded-2xl border border-purple-500/40'
                    } overflow-hidden bg-zinc-950 cursor-pointer`}
                    title="Double-click to toggle fullscreen (F)"
                  >
                    <video
                      ref={(el) => {
                        if (el && localScreenStreamRef.current) {
                          el.srcObject = localScreenStreamRef.current;
                        }
                      }}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300 text-xs font-semibold backdrop-blur">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                      <span>You are sharing your screen</span>
                    </div>

                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <button
                        onClick={openPopoutChat}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 text-xs font-bold shadow-lg backdrop-blur transition-all active:scale-95"
                        title="Pop out floating chat window so you can watch other tabs while chatting"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Pop-out Floating Chat 🪟</span>
                      </button>
                    </div>
                  </div>
                ) : remoteStream ? (
                  <div
                    onDoubleClick={toggleFullscreen}
                    className={`relative w-full ${
                      isFullscreen ? 'h-full max-h-none flex-1 rounded-none border-0' : 'aspect-video max-h-[75vh] rounded-2xl border border-purple-500/40'
                    } overflow-hidden bg-zinc-950 cursor-pointer`}
                    title="Double-click to toggle fullscreen (F)"
                  >
                    <video
                      ref={(el) => {
                        if (el && remoteStream && el.srcObject !== remoteStream) {
                          el.srcObject = remoteStream;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      controls
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300 text-xs font-semibold backdrop-blur">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                      <span>Viewing host's screen share</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xl shadow-purple-950/40">
                      <Monitor className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">SharePlay Screen Sharing</h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Host can stream any browser tab, video player, or file with system audio directly to everyone in this room!
                      </p>
                      <p className="text-[11px] text-purple-400/90 mt-2 flex items-center justify-center gap-1">
                        <span>💡 Tip: Pop out the floating chat window to chat while watching your shared tab!</span>
                      </p>
                    </div>
                    {isHost ? (
                      <button
                        onClick={startScreenShare}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-purple-950/60 transition-all active:scale-95"
                      >
                        <Monitor className="w-4 h-4" />
                        <span>Start Screen Share</span>
                      </button>
                    ) : (
                      <div className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
                        Waiting for host ({hostName || 'Host'}) to start sharing...
                      </div>
                    )}
                  </div>
                )}

                {/* Host screen share control actions */}
                {isScreenSharing && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={openPopoutChat}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Pop-out Chat Window 🪟</span>
                    </button>
                    <button
                      onClick={stopScreenShare}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all active:scale-95"
                    >
                      Stop Sharing Screen
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode C: External Streaming App Sync */}
            {activeTab === 'external' && (
              <div className="relative w-full h-full flex flex-col justify-center items-center p-6 space-y-6 max-w-xl text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-950/40">
                  <Radio className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Streaming Platform Sync</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Watch together on your own Netflix, Prime, Disney+, or Tubi accounts. Click your platform below to open the movie, then host triggers the synced countdown so everyone presses Play at the exact same second!
                  </p>
                </div>

                {/* Platform Quick Links */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                  <a
                    href={`https://www.netflix.com/search?q=${encodeURIComponent(movie?.title || '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-rose-400 transition-all group"
                  >
                    <span className="font-bold text-sm">Netflix</span>
                    <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-rose-400 mt-1" />
                  </a>

                  <a
                    href={`https://www.amazon.com/s?k=${encodeURIComponent(movie?.title || '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-sky-400 transition-all group"
                  >
                    <span className="font-bold text-sm">Prime Video</span>
                    <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-sky-400 mt-1" />
                  </a>

                  <a
                    href={`https://www.disneyplus.com/search?q=${encodeURIComponent(movie?.title || '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-blue-400 transition-all group"
                  >
                    <span className="font-bold text-sm">Disney+</span>
                    <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-blue-400 mt-1" />
                  </a>

                  <a
                    href={`https://tubitv.com/search/${encodeURIComponent(movie?.title || '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-amber-400 transition-all group"
                  >
                    <span className="font-bold text-sm">Tubi (Free)</span>
                    <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 mt-1" />
                  </a>
                </div>

                {/* Host Countdown Trigger */}
                <div className="pt-2 w-full">
                  {countdown !== null ? (
                    <div className="py-4 px-6 rounded-2xl bg-rose-600/20 border border-rose-500/50 animate-bounce">
                      <span className="text-3xl sm:text-4xl font-black text-rose-400 font-mono tracking-widest">
                        {countdown}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={startExternalCountdown}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-amber-950/50 transition-all active:scale-95"
                    >
                      <span>Start 5-Second Play Countdown ⏱️</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Floating Reactions Layer */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
              {reactions.map((r) => (
                <div
                  key={r.id}
                  style={{
                    left: `${r.left}%`,
                    bottom: '80px',
                    transform: `rotate(${r.rotation}deg)`,
                  }}
                  className="absolute flex flex-col items-center animate-reaction-float"
                >
                  <span className="text-3xl sm:text-4xl filter drop-shadow-md select-none">{r.emoji}</span>
                  <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm mt-0.5">
                    {r.userName}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom Scrubber & Playback Controls Bar */}
            <div className="w-full bg-gradient-to-t from-black via-zinc-950/90 to-transparent p-3 sm:p-4 z-20 space-y-2">
              {/* Progress Slider (Only for In-App Video) */}
              {activeTab === 'watch' && (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-zinc-400 w-10 text-right">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.5}
                    value={currentTime}
                    disabled={!isHost}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleSeek(val);
                    }}
                    className={`flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500 ${
                      !isHost ? 'opacity-80 cursor-default' : ''
                    }`}
                  />
                  <span className="text-[11px] font-mono text-zinc-400 w-10">
                    {formatTime(duration)}
                  </span>
                </div>
              )}

              {/* Controls & Quick Reaction Tray */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Playback buttons */}
                <div className="flex items-center gap-2">
                  {isHost ? (
                    <>
                      <button
                        onClick={togglePlayPause}
                        className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 transition-all active:scale-95"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>
                      <button
                        onClick={() => handleSkip(-10)}
                        className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95 text-xs font-semibold"
                        title="Skip back 10s"
                      >
                        -10s
                      </button>
                      <button
                        onClick={() => handleSkip(10)}
                        className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95 text-xs font-semibold"
                        title="Skip forward 10s"
                      >
                        +10s
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Synced with Host</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setIsMuted(!isMuted);
                      if (ytPlayerRef.current) {
                        if (!isMuted) ytPlayerRef.current.mute?.();
                        else ytPlayerRef.current.unMute?.();
                      }
                    }}
                    className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-all"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95"
                    title={isFullscreen ? 'Exit Full Screen (F)' : 'Full Screen Mode (F)'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4 text-rose-400" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Reaction Cannon Buttons */}
                <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl px-2 py-1 shadow-lg">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="p-1.5 hover:scale-125 transition-transform active:scale-95 text-base sm:text-lg select-none"
                      title={`Send ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right / Bottom: Live Chat & Attendees Drawer */}
          {isChatOpen && (
            <div className="w-full lg:w-80 h-72 lg:h-full bg-zinc-900/95 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col z-20">
              
              {/* Drawer Header */}
              <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Party Chat</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono">
                    {participants.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={openPopoutChat}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold transition-all active:scale-95"
                    title="Pop out floating chat window to stay on top while watching other tabs"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="hidden sm:inline">Pop out</span>
                  </button>

                  {/* Participant Avatars */}
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {participants.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-white uppercase"
                        title={p.name}
                      >
                        {p.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat Messages List */}
              <div
                ref={chatScrollRef}
                className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs scrollbar-thin scrollbar-thumb-zinc-700"
              >
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                    <p>No messages yet.</p>
                    <p className="text-[11px] text-zinc-600">Send a greeting or reaction to start the watch party!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.user_id === myUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-0.5 font-mono">
                          <span className="font-semibold text-zinc-300">{msg.user_name}</span>
                          {msg.video_time > 0 && (
                            <span className="text-rose-400">[{formatTime(msg.video_time)}]</span>
                          )}
                        </div>
                        <div
                          className={`px-3 py-2 rounded-2xl max-w-[85%] break-words ${
                            isMe
                              ? 'bg-rose-600 text-white rounded-tr-none'
                              : 'bg-zinc-800/90 text-zinc-200 rounded-tl-none border border-zinc-700/50'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={sendChatMessage} className="p-2.5 bg-zinc-900/90 border-t border-zinc-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Chat with party..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white transition-all active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      {/* Picture-in-Picture Floating Companion Portal */}
      {pipContainer &&
        createPortal(
          <ChatCompanionContent
            roomCode={roomCode}
            participants={participants}
            isHost={isHost}
            isPlaying={isPlaying}
            togglePlayPause={togglePlayPause}
            handleSkip={handleSkip}
            reactions={reactions}
            sendReaction={sendReaction}
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChatMessage={sendChatMessage}
            chatScrollRef={chatScrollRef}
            myUserId={myUserId}
            onClosePip={() => setPipContainer(null)}
          />,
          pipContainer
        )}
    </div>
  );
}

// Standalone Chat Companion for Picture-in-Picture & Floating Companion Mode
export function ChatCompanionContent({
  roomCode,
  participants = [],
  isHost = false,
  isPlaying = false,
  togglePlayPause,
  handleSkip,
  reactions = [],
  sendReaction,
  chatMessages = [],
  chatInput = '',
  setChatInput,
  sendChatMessage,
  chatScrollRef,
  myUserId = '',
  onClosePip,
}) {
  return (
    <div className="w-full h-full min-h-screen flex flex-col bg-zinc-950 text-white font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wider font-mono">ROOM #{roomCode}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono">
            👥 {participants.length}
          </span>
        </div>
        {onClosePip && (
          <button
            onClick={onClosePip}
            className="text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
          >
            Close Floating
          </button>
        )}
      </div>

      {/* Host Controls Bar */}
      {isHost && (
        <div className="px-3 py-2 bg-zinc-900/70 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Host Controls</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={togglePlayPause}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition-all active:scale-95"
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              onClick={() => handleSkip?.(-10)}
              className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs transition-all active:scale-95"
            >
              -10s
            </button>
            <button
              onClick={() => handleSkip?.(10)}
              className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs transition-all active:scale-95"
            >
              +10s
            </button>
          </div>
        </div>
      )}

      {/* Reaction Cannon */}
      <div className="px-2 py-1.5 bg-zinc-900/50 border-b border-zinc-800/60 flex items-center justify-around shrink-0">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction?.(emoji)}
            className="hover:scale-125 transition-transform text-base select-none p-1"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500">
            <MessageSquare className="w-6 h-6 mb-1 opacity-40" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[10px] text-zinc-600">Chat with party while watching your tab!</p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.user_id === myUserId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-0.5 font-mono">
                  <span className={`font-bold ${isMe ? 'text-rose-400' : 'text-zinc-300'}`}>
                    {isMe ? 'You' : msg.user_name}
                  </span>
                  {msg.video_time > 0 && (
                    <span className="text-zinc-500">
                      [{Math.floor(msg.video_time / 60)}:{Math.floor(msg.video_time % 60) < 10 ? '0' : ''}{Math.floor(msg.video_time % 60)}]
                    </span>
                  )}
                </div>
                <div
                  className={`px-3 py-1.5 rounded-2xl max-w-[88%] break-words leading-relaxed ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-tr-sm shadow-md shadow-rose-950/40'
                      : 'bg-zinc-800/90 text-zinc-200 rounded-tl-sm border border-zinc-700/50'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input Form */}
      <form onSubmit={sendChatMessage} className="p-2.5 bg-zinc-900 border-t border-zinc-800 flex gap-2 shrink-0">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput?.(e.target.value)}
          placeholder="Chat with party..."
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!chatInput?.trim()}
          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow transition-all active:scale-95"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Standalone Popup Window for Browsers without Document PiP (Safari/Firefox)
export function StandaloneChatCompanion({ roomCode }) {
  const { user } = useAuth();
  const myUserId = user?.uid || `companion_${Math.random().toString(36).substring(2, 6)}`;
  const myUserName = user?.displayName || user?.email?.split('@')[0] || 'Friend';

  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const wsRef = useRef(null);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (!roomCode) return;
    const fetchState = async () => {
      try {
        const res = await api.get(`/rooms/${roomCode}/theater/state`);
        if (res.data?.theater) {
          const th = res.data.theater;
          setParticipants(th.participants || []);
          setChatMessages(th.chat_history || []);
          setIsPlaying(th.playback?.is_playing || false);
          if (th.host_id === myUserId) setIsHost(true);
        }
      } catch (e) {
        console.warn('Companion fetch error:', e);
      }
    };
    fetchState();

    const wsUrl = getWsUrl(`/rooms/${roomCode}/theater/ws?user_id=${encodeURIComponent(myUserId)}&user_name=${encodeURIComponent(myUserName)}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INITIAL_SYNC') {
          setParticipants(data.state?.participants || []);
          setChatMessages(data.state?.chat_history || []);
          setIsPlaying(data.state?.playback?.is_playing || false);
          if (data.state?.host_id === myUserId) setIsHost(true);
        } else if (data.type === 'CHAT') {
          const newMsg = data.message || {
            id: data.id || `msg_${Date.now()}`,
            user_id: data.user_id,
            user_name: data.sender_name,
            text: data.text,
            timestamp: Date.now() / 1000,
            video_time: 0,
          };
          setChatMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
          setTimeout(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
          }, 80);
        } else if (data.type === 'PLAY') {
          setIsPlaying(true);
        } else if (data.type === 'PAUSE') {
          setIsPlaying(false);
        }
      } catch (err) {
        console.warn('WS message error:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [roomCode, myUserId, myUserName]);

  const sendChatMessage = (e) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMsg = {
      id: msgId,
      user_id: myUserId,
      user_name: myUserName,
      text,
      timestamp: Date.now() / 1000,
      video_time: 0,
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput('');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CHAT', payload: { id: msgId, text, videoTime: 0 } }));
    }
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 50);
  };

  const togglePlayPause = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: nextPlaying ? 'PLAY' : 'PAUSE', payload: { currentTime: 0 } }));
    }
  };

  const handleSkip = (delta) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SEEK', payload: { currentTime: delta > 0 ? 10 : 0 } }));
    }
  };

  const sendReaction = (emoji) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'REACTION', payload: { emoji } }));
    }
  };

  return (
    <ChatCompanionContent
      roomCode={roomCode}
      participants={participants}
      isHost={isHost}
      isPlaying={isPlaying}
      togglePlayPause={togglePlayPause}
      handleSkip={handleSkip}
      reactions={[]}
      sendReaction={sendReaction}
      chatMessages={chatMessages}
      chatInput={chatInput}
      setChatInput={setChatInput}
      sendChatMessage={sendChatMessage}
      chatScrollRef={chatScrollRef}
      myUserId={myUserId}
      onClosePip={() => window.close()}
    />
  );
}
