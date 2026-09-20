import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2,
  Users, MessageSquare, Send, Sparkles, Share2, Copy, Check,
  Monitor, ExternalLink, RefreshCw, Crown, Film, Radio, Tv
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
}) {
  const { user } = useAuth();

  // User identity
  const [myUserId] = useState(() => {
    return user?.uid || localStorage.getItem('movienight_uid') || `user_${Math.random().toString(36).substring(2, 9)}`;
  });
  const [myUserName] = useState(() => {
    return user?.displayName || localStorage.getItem('movienight_name') || 'Guest Cinephile';
  });

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
  const chatScrollRef = useRef(null);
  const isHost = myUserId === hostId;
  const lastSyncTimeRef = useRef(0);
  const isSeekingRef = useRef(false);

  // 1. Initialize or join Theater session
  const initTheater = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await api.post(`/rooms/${roomCode}/theater/start`, {
        host_id: myUserId,
        host_name: myUserName,
        movie: movie || undefined,
        video_source: videoSource || undefined,
      });

      const th = res.data.theater;
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
    } catch (err) {
      console.error('Failed to start theater session:', err);
    }
  }, [roomCode, myUserId, myUserName, movie, videoSource]);

  // 2. Connect WebSocket for real-time synchronization
  useEffect(() => {
    if (!isOpen || !roomCode) return;

    initTheater();

    const wsUrl = getWsUrl(`/rooms/${roomCode}/theater/ws?user_id=${encodeURIComponent(myUserId)}&user_name=${encodeURIComponent(myUserName)}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Theater WebSocket connected');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
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
  }, [isOpen, roomCode, initTheater]);

  // 3. Handle incoming WebSocket events
  const handleServerEvent = async (data) => {
    switch (data.type) {
      case 'INITIAL_SYNC': {
        const st = data.state;
        setHostId(st.host_id);
        setHostName(st.host_name);
        if (st.movie) setMovie(st.movie);
        if (st.video_source) setVideoSource(st.video_source);
        setParticipants(st.participants || []);
        setChatMessages(st.chat_history || []);
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
        }
        break;
      }

      case 'REACTION': {
        triggerFloatingReaction(data.emoji, data.user_name);
        break;
      }

      case 'CHAT': {
        const newMsg = data.message || {
          id: `msg_${Date.now()}`,
          user_id: data.user_id,
          user_name: data.sender_name,
          text: data.text,
          timestamp: Date.now() / 1000,
          video_time: currentTime,
        };
        setChatMessages((prev) => [...prev, newMsg]);
        if (!isChatOpen) {
          setUnreadChatCount((prev) => prev + 1);
        }
        // Auto scroll
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 100);
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
    }

    if (!signal) return;

    let pc = peerConnectionsRef.current[sender_id];
    if (!pc) {
      pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current[sender_id] = pc;

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
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
    }

    if (signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === 'offer') {
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
      }
    } else if (signal.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (e) {
        console.warn('Error adding ICE candidate:', e);
      }
    }
  };

  // Host starts screen sharing
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: { ideal: 30, max: 60 } },
        audio: true,
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

      // Create WebRTC offers for all other participants in the room
      participants.forEach(async (p) => {
        if (p.id !== myUserId) {
          const pc = new RTCPeerConnection(RTC_CONFIG);
          peerConnectionsRef.current[p.id] = pc;

          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'WEBRTC_SIGNAL',
                  payload: {
                    target_id: p.id,
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
                  target_id: p.id,
                  signal: { sdp: pc.localDescription },
                },
              })
            );
          }
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

    const onYouTubeIframeAPIReady = () => {
      if (!ytContainerRef.current) return;

      playerInstance = new window.YT.Player(ytContainerRef.current, {
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
            // YT.PlayerState.ENDED = 0, PLAYING = 1, PAUSED = 2
            if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      onYouTubeIframeAPIReady();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    }

    return () => {
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

    const newMsg = {
      id: `msg_${Date.now()}`,
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
          payload: { text, videoTime: currentTime },
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

  // Copy share party link
  const copyPartyLink = () => {
    const url = `${window.location.origin}/?party=${roomCode}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    if (onShowToast) onShowToast({ message: 'Watch Party link copied to clipboard!' });
  };

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-xl animate-fade-in select-none">
      {/* Container */}
      <div className="relative w-full h-full sm:h-[94vh] sm:max-w-7xl bg-zinc-950 sm:border sm:border-zinc-800/80 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
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
              onClick={copyPartyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all active:scale-95"
              title="Copy share link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Invite Friends'}</span>
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
          <div className="relative flex-1 flex flex-col bg-black justify-center items-center overflow-hidden">
            
            {/* Mode A: Synchronized YouTube / Video Player */}
            {activeTab === 'watch' && (
              <div className="relative w-full h-full flex flex-col justify-center items-center">
                {videoSource?.src ? (
                  <div className="relative w-full aspect-video max-h-[75vh] bg-black">
                    <div ref={ytContainerRef} className="w-full h-full" />
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
                  <div className="relative w-full aspect-video max-h-[75vh] rounded-2xl overflow-hidden bg-zinc-950 border border-purple-500/40">
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
                  </div>
                ) : remoteStream ? (
                  <div className="relative w-full aspect-video max-h-[75vh] rounded-2xl overflow-hidden bg-zinc-950 border border-purple-500/40">
                    <video
                      ref={(el) => {
                        if (el) el.srcObject = remoteStream;
                      }}
                      autoPlay
                      playsInline
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

                {/* Host stop screen share button */}
                {isScreenSharing && (
                  <button
                    onClick={stopScreenShare}
                    className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
                  >
                    Stop Sharing Screen
                  </button>
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
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
    </div>
  );
}
