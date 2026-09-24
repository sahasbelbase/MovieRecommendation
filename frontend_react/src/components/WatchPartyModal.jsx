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

const REACTION_EMOJIS = ['❤️', '😂', '', '', '😱', '👏'];

// STUN servers for WebRTC PeerConnections
const RTC_CONFIG = {
 iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
 ],
};

export default function WatchPartyModal({
 isVip,
 onActivateVip,
 onDeactivateVip,
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
  if (typeof window!== 'undefined') {
   return localStorage.getItem('cinematch_guest_name') || localStorage.getItem('movienight_name') || '';
  }
  return '';
 });

 const [hasJoined, setHasJoined] = useState(() => {
  return Boolean(user) || (typeof window!== 'undefined' && Boolean(localStorage.getItem('cinematch_guest_name')));
 });

 const [myGuestId] = useState(() => {
  if (typeof window!== 'undefined') {
   const stored = localStorage.getItem('cinematch_theater_uid');
   if (stored) return stored;
   const newId = `guest_${Math.random().toString(36).substring(2, 9)}`;
   localStorage.setItem('cinematch_theater_uid', newId);
   return newId;
  }
  return `guest_${Math.random().toString(36).substring(2, 9)}`;
 });

 const myUserId = user?.uid || myGuestId;
 const myUserName = user?.displayName || user?.email?.split('@')[0] || guestName || localStorage.getItem('movienight_name') || 'Friend';

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
 const isHost = myUserId === hostId;
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
 const [streamAudioMuted, setStreamAudioMuted] = useState(false);
 const [isMutedByBrowser, setIsMutedByBrowser] = useState(false);
 const [showAudioReminder, setShowAudioReminder] = useState(false);
 const [isNegotiating, setIsNegotiating] = useState(false);
 const remoteVideoRef = useRef(null);
 const localVideoRef = useRef(null);

 // Helper to ensure participants is always an array of objects
 const normalizeParticipants = useCallback((p) => {
  if (!p) return [];
  if (Array.isArray(p)) return p;
  if (typeof p === 'object') return Object.values(p);
  return [];
 }, []);

 // Sync remote video stream to DOM video element with autoplay mobile audio fallback
 useEffect(() => {
  if (remoteVideoRef.current && remoteStream && activeTab === 'screen') {
   if (remoteVideoRef.current.srcObject!== remoteStream) {
    remoteVideoRef.current.srcObject = remoteStream;
    
    // Attempt unmuted play first to bypass restrictions if possible
    remoteVideoRef.current.muted = false;
    remoteVideoRef.current.play().then(() => {
     setIsMutedByBrowser(false);
     setStreamAudioMuted(false);
    }).catch((err) => {
     if (err.name === 'NotAllowedError') {
      console.warn('Autoplay blocked. Muting stream and requesting user interaction.');
      remoteVideoRef.current.muted = true;
      setIsMutedByBrowser(true);
      setStreamAudioMuted(true);
      remoteVideoRef.current.play().catch(e => console.error(e));
     }
    });
   }
  }
 }, [remoteStream, activeTab]);

 // VidLink Sync: Listen for host's player events and broadcast them
 useEffect(() => {
  if (activeTab !== 'embed' || !videoSource?.src?.includes('vidlink.pro')) return;
  
  const handleMessage = (e) => {
   if (e.origin !== 'https://vidlink.pro') return;
   
   // Parse timeupdate to keep our local currentTime accurate
   let type = '';
   let time = currentTime;
   
   if (typeof e.data === 'string') {
     type = e.data;
   } else if (e.data && typeof e.data === 'object') {
     type = e.data.type || e.data.event;
     time = typeof e.data.currentTime === 'number' ? e.data.currentTime : (e.data.time || time);
     if (type === 'timeupdate' && typeof time === 'number') {
       setCurrentTime(time);
     }
   }

   // Only host broadcasts state
   if (isHost && wsRef.current?.readyState === WebSocket.OPEN) {
     if (type === 'play') {
       setIsPlaying(true);
       wsRef.current.send(JSON.stringify({ type: 'PLAY', payload: { current_time: time } }));
     } else if (type === 'pause') {
       setIsPlaying(false);
       wsRef.current.send(JSON.stringify({ type: 'PAUSE', payload: { current_time: time } }));
     } else if (type === 'seeked' || type === 'seek') {
       wsRef.current.send(JSON.stringify({ type: 'SEEK', payload: { current_time: time } }));
     }
   }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
 }, [activeTab, videoSource, isHost, currentTime]);

 const handleTogglePiP = async (e) => {
  e.stopPropagation();
  if (!remoteVideoRef.current) return;
  try {
   if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
   } else if (document.pictureInPictureEnabled) {
    await remoteVideoRef.current.requestPictureInPicture();
   }
  } catch (err) {
   console.warn('PiP error:', err);
   if (onShowToast) onShowToast({ message: 'Picture-in-Picture not supported on this browser' });
  }
 };

 // Sync local screen share stream to Host preview video element
 useEffect(() => {
  if (localVideoRef.current && localScreenStreamRef.current && isScreenSharing && activeTab === 'screen') {
   if (localVideoRef.current.srcObject!== localScreenStreamRef.current) {
    localVideoRef.current.srcObject = localScreenStreamRef.current;
    localVideoRef.current.play().catch((err) => console.warn('Local screen preview play error:', err));
   }
  }
 }, [isScreenSharing, activeTab]);

 // Refs
 const wsRef = useRef(null);
 const ytPlayerRef = useRef(null);
 const ytContainerRef = useRef(null);
 const localScreenStreamRef = useRef(null);
 const lastMediaVideoSourceRef = useRef(null);
 const peerConnectionsRef = useRef({}); // userId -> RTCPeerConnection
 const pendingIceCandidatesRef = useRef({}); // userId -> Array of ICE candidates
 const handleServerEventRef = useRef(null);
 const chatScrollRef = useRef(null);
 const lastSyncTimeRef = useRef(0);
 const isSeekingRef = useRef(false);

 // Preserve last valid non-WebRTC video source so we can restore it when screen sharing ends
 useEffect(() => {
  if (videoSource && videoSource.type!== 'webrtc' && videoSource.src) {
   lastMediaVideoSourceRef.current = videoSource;
  }
 }, [videoSource]);

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
   if (!isOpen ||!user) return;
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
  if (typeof window!== 'undefined' && 'documentPictureInPicture' in window) {
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
    if (th.movie && (!movie ||!movie.title)) {
     setMovie(th.movie);
    }
    if (th.video_source) {
     setVideoSource(th.video_source);
    }
    setParticipants(normalizeParticipants(th.participants));
    setChatMessages(th.chat_history || []);
    setIsPlaying(th.playback?.is_playing || false);
    setCurrentTime(th.playback?.current_time || 0);

    if (th.video_source?.type === 'webrtc' || (th.webrtc_streamer_id && th.webrtc_streamer_id!== myUserId)) {
     setActiveTab('screen');
    }
   }
  } catch (err) {
   console.error('Failed to initialize theater session:', err);
  } finally {
   setIsLoadingTheater(false);
  }
 }, [roomCode, myUserId, myUserName, propMovie, initialVideoSource, normalizeParticipants]);

 // 2. Connect WebSocket for real-time synchronization
 useEffect(() => {
  if (!isOpen ||!roomCode ||!hasJoined) return;

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
 }, [isOpen, roomCode, hasJoined, myUserId, myUserName, initTheater]);

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
    if (st.participants) setParticipants(normalizeParticipants(st.participants));
    if (st.chat_history) setChatMessages(st.chat_history);
    setIsPlaying(st.playback?.is_playing || false);
    setCurrentTime(st.playback?.current_time || 0);

    // If host is streaming screen, switch to screen and auto-request stream
    if (st.video_source?.type === 'webrtc' || (st.webrtc_streamer_id && st.webrtc_streamer_id!== myUserId)) {
     setActiveTab('screen');
     setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
       wsRef.current.send(
        JSON.stringify({
         type: 'WEBRTC_SIGNAL',
         payload: {
          target_id: st.webrtc_streamer_id || st.host_id,
          stream_action: 'request_screen',
         },
        })
       );
      }
     }, 350);
    }

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
    if (data.participants) setParticipants(normalizeParticipants(data.participants));
    if (onShowToast && data.participant) {
     onShowToast({ message: `${data.participant.name} joined the Watch Party ` });
    }
    if (localScreenStreamRef.current && data.participant?.id && data.participant.id!== myUserId) {
     console.log(`[Host] Auto-sending screen share offer to newcomer: ${data.participant.id}`);
     sendScreenOfferToPeer(data.participant.id, localScreenStreamRef.current);
    }
    break;
   }

   case 'PARTICIPANT_LEFT': {
    if (data.participants) setParticipants(normalizeParticipants(data.participants));
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
     
     // VidLink Sync (Viewer Side)
     if (!isHost && activeTab === 'embed' && videoSource?.src?.includes('vidlink.pro')) {
       setVideoSource(prev => {
         if (!prev) return prev;
         try {
           const url = new URL(prev.src);
           url.searchParams.set('startAt', Math.floor(targetTime));
           url.searchParams.set('autoplay', 'true');
           return { ...prev, src: url.toString() };
         } catch(e) { return prev; }
       });
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

     // VidLink Sync (Viewer Side)
     if (!isHost && activeTab === 'embed' && videoSource?.src?.includes('vidlink.pro')) {
       setVideoSource(prev => {
         if (!prev) return prev;
         try {
           const url = new URL(prev.src);
           url.searchParams.set('startAt', Math.floor(targetTime));
           url.searchParams.set('autoplay', 'false');
           return { ...prev, src: url.toString() };
         } catch(e) { return prev; }
       });
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

     // VidLink Sync (Viewer Side)
     if (!isHost && activeTab === 'embed' && videoSource?.src?.includes('vidlink.pro')) {
       setVideoSource(prev => {
         if (!prev) return prev;
         try {
           const url = new URL(prev.src);
           url.searchParams.set('startAt', Math.floor(targetTime));
           url.searchParams.set('autoplay', isPlaying ? 'true' : 'false');
           return { ...prev, src: url.toString() };
         } catch(e) { return prev; }
       });
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
  if (!targetId || targetId === myUserId ||!stream) return;
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
   if (onShowToast) onShowToast({ message: `${data.sender_name || 'Host'} started screen sharing ` });
  } else if (stream_action === 'stop_screen') {
   setRemoteStream(null);
   if (remoteVideoRef.current) {
    remoteVideoRef.current.srcObject = null;
   }
   setActiveTab('watch');
   if (onShowToast) onShowToast({ message: 'Screen sharing ended' });
   return;
  } else if (stream_action === 'request_screen') {
   // Peer requested the active screen stream
   if (localScreenStreamRef.current && sender_id && sender_id!== myUserId) {
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
     const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
     setRemoteStream(stream);
     setActiveTab('screen');
     setIsNegotiating(false);
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

 // Request active screen stream from host on demand
 const requestScreenFromHost = useCallback(() => {
  setIsNegotiating(true);
  if (!wsRef.current || wsRef.current.readyState!== WebSocket.OPEN) return;
  const target = hostId;
  if (target && target!== myUserId) {
   wsRef.current.send(
    JSON.stringify({
     type: 'WEBRTC_SIGNAL',
     payload: {
      target_id: target,
      stream_action: 'request_screen',
     },
    })
   );
   if (onShowToast) onShowToast({ message: "Connecting to host's screen share... " });
  } else {
   setIsNegotiating(false);
  }
 }, [hostId, myUserId, onShowToast]);

 // Handle Screen Share Clicks and Constraints
 const handleScreenShareClick = () => {
  if (!isHost) {
   if (onShowToast) onShowToast({ message: 'Only the party host can broadcast their screen ' });
   return;
  }
  if (typeof navigator.mediaDevices === 'undefined' || typeof navigator.mediaDevices.getDisplayMedia === 'undefined') {
    if (onShowToast) onShowToast({ message: 'Screen sharing is not supported on this browser/device ' });
    return;
  }
  setShowAudioReminder(true);
 };

 // Host starts screen sharing (Broadcaster role)
 const startScreenShare = async () => {
  setShowAudioReminder(false);
  try {
   const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { 
      cursor: "never",
      displaySurface: "browser",
      frameRate: { ideal: 30, max: 60 },
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 }
    },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 44100
    },
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: 'include',
   });

   localScreenStreamRef.current = stream;
   setIsScreenSharing(true);
   setActiveTab('screen');

   // 1. Notify peers and backend of webrtc source change
   if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(
     JSON.stringify({
      type: 'CHANGE_SOURCE',
      payload: {
       source: {
        type: 'webrtc',
        src: myUserId,
        title: `${myUserName}'s Screen Share`,
       },
      },
     })
    );
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
   if (typeof window!== 'undefined' && 'documentPictureInPicture' in window) {
    openPopoutChat().catch(() => {});
   }

   // Create WebRTC offers for all other participants in the room
   normalizeParticipants(participants).forEach((p) => {
    const peerId = typeof p === 'string' ? p : p?.id;
    if (peerId && peerId!== myUserId) {
     sendScreenOfferToPeer(peerId, stream);
    }
   });
  } catch (err) {
   console.warn('Screen share cancelled or failed:', err);
  }
 };

 const stopScreenShare = async () => {
  if (localScreenStreamRef.current) {
   localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
   localScreenStreamRef.current = null;
  }
  if (localVideoRef.current) {
   localVideoRef.current.srcObject = null;
  }
  if (remoteVideoRef.current) {
   remoteVideoRef.current.srcObject = null;
  }
  setRemoteStream(null);
  setIsScreenSharing(false);
  setActiveTab('watch');

  let restoreSource = lastMediaVideoSourceRef.current;
  if (!restoreSource?.src && movie?.id) {
   try {
    const res = await api.get(`/movies/${movie.id}/trailers?media_type=${movie.media_type || 'movie'}`);
    if (res.data && res.data.length > 0) {
     restoreSource = {
      type: 'youtube',
      src: res.data[0].key,
      title: `${movie.title || movie.name || 'Movie'} - Trailer`,
     };
    }
   } catch (e) {
    console.warn('Failed to fetch trailer on stop screen share:', e);
   }
  }

  const finalSource = restoreSource || {
   type: 'youtube',
   src: '',
   title: movie?.title || 'Cinema Stream',
  };

  if (wsRef.current?.readyState === WebSocket.OPEN) {
   wsRef.current.send(
    JSON.stringify({
     type: 'CHANGE_SOURCE',
     payload: {
      source: finalSource,
     },
    })
   );
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
  if (activeTab!== 'watch' ||!videoSource?.src) return;

  let playerInstance = null;
  let pollInterval = null;
  let isCleanedUp = false;

  const createPlayer = () => {
   if (isCleanedUp ||!ytContainerRef.current ||!window.YT ||!window.YT.Player) return false;

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
  const nextPlaying =!isPlaying;
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
   setReactions((prev) => prev.filter((r) => r.id!== id));
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
    setCountdown('PLAY NOW! ');
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
   text: ` Join my Watch Party on Cinematch (Room: ${roomCode})! Watch live screen share and chat with me:`,
   url: url,
  };

  if (typeof navigator!== 'undefined' && navigator.share) {
   try {
    await navigator.share(shareData);
    if (onShowToast) onShowToast({ message: 'Invitation sent! ' });
    return;
   } catch (err) {
    if (err.name!== 'AbortError') {
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
   if (onShowToast) onShowToast({ message: 'Watch Party link copied to clipboard! ' });
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

 if (!hasJoined &&!user) {
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
          if (typeof window!== 'undefined') {
           localStorage.setItem('cinematch_guest_name', name);
           localStorage.setItem('movienight_name', name);
          }
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
        if (typeof window!== 'undefined') {
         localStorage.setItem('cinematch_guest_name', name);
         localStorage.setItem('movienight_name', name);
        }
        setHasJoined(true);
       }}
       className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-rose-950/60 transition-all active:scale-95 flex items-center justify-center gap-2"
      >
       <span>Join Watch Party Now</span>
       <span></span>
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
    <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-zinc-900/90 border-b border-zinc-800/60 backdrop-blur z-20 shrink-0">
     <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <div className="flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] sm:text-xs font-mono font-bold shrink-0">
       <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 animate-pulse" />
       <span>LIVE</span>
      </div>

      <div className="min-w-0">
       <h2 className="text-xs sm:text-base font-bold text-white truncate flex items-center gap-1.5">
        <span className="truncate">{movie?.title || 'Cinematch Theater'}</span>
        {movie?.year && <span className="text-[11px] text-zinc-400 font-normal hidden sm:inline">({movie.year})</span>}
       </h2>
       <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-zinc-400 font-mono">
        <span>Room: <strong className="text-amber-400 font-bold tracking-wider">{roomCode}</strong></span>
        <span className="text-zinc-600">•</span>
        <span className="flex items-center gap-1 truncate">
         <Crown className="w-3 h-3 text-amber-400 shrink-0" />
         <span className="truncate">{isHost ? 'You (Host)' : (hostName || 'Host')}</span>
        </span>
       </div>
      </div>
     </div>

     {/* Action buttons */}
     <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <button
       onClick={handleShareParty}
       className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-all active:scale-95"
       title="Share party invitation via WhatsApp, Instagram, iMessage, etc."
      >
       {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
       <span className="hidden xs:inline">{copiedLink ? 'Copied' : 'Share'}</span>
      </button>

      {/* Chat toggle button */}
      <button
       onClick={() => {
        setIsChatOpen(!isChatOpen);
        setUnreadChatCount(0);
       }}
       className={`relative p-2 rounded-xl transition-all active:scale-95 ${
        isChatOpen
         ? 'bg-rose-600/20 border border-rose-500/40 text-rose-300'
         : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300'
       }`}
       title="Toggle Live Chat"
      >
       <MessageSquare className="w-4 h-4" />
       {unreadChatCount > 0 &&!isChatOpen && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
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

    {/* Mode Selector Tabs (Host only) OR Live Broadcast Status Chip (Viewer only) */}
    {isHost ? (
     <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-900/60 border-b border-zinc-800/40 text-xs font-medium overflow-x-auto scrollbar-none shrink-0">
      <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline mr-1">
       Broadcast:
      </span>
      <button
       onClick={() => {
        setActiveTab('watch');
        if (isScreenSharing) stopScreenShare();
       }}
       className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
        activeTab === 'watch'
         ? 'bg-rose-600 text-white font-semibold shadow-md shadow-rose-950/40'
         : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
       }`}
      >
       <Film className="w-3.5 h-3.5" />
       <span>Movie Trailer</span>
      </button>

      {user && isVip && movie?.id && movie?.media_type === 'anime' && (
       <>
        <button
         onClick={() => {
          setActiveTab('embed');
          if (isScreenSharing) stopScreenShare();
          
          const embedSrc = `https://anify.to/embed/${movie.id}/1`;
          const newSrc = {
           type: 'embed',
           src: embedSrc,
           title: `${movie.title || 'Movie'} (Anify HD)`
          };
          setVideoSource(newSrc);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
           wsRef.current.send(
            JSON.stringify({
             type: 'CHANGE_SOURCE',
             payload: { source: newSrc }
            })
           );
          }
         }}
         className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
          activeTab === 'embed' && videoSource?.src?.includes('anify.to')
           ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-950/40'
           : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
         }`}
        >
         <Play className="w-3.5 h-3.5 fill-current" />
         <span>Anify HD</span>
        </button>

        <button
         onClick={() => {
          setActiveTab('embed');
          if (isScreenSharing) stopScreenShare();
          
          const embedSrc = `https://anime.vidsrc.me/embed/anime?tmdb=${movie.id}`;
          const newSrc = {
           type: 'embed',
           src: embedSrc,
           title: `${movie.title || 'Movie'} (VidSrc Anime)`
          };
          setVideoSource(newSrc);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
           wsRef.current.send(
            JSON.stringify({
             type: 'CHANGE_SOURCE',
             payload: { source: newSrc }
            })
           );
          }
         }}
         className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
          activeTab === 'embed' && videoSource?.src?.includes('anime.vidsrc.me')
           ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-950/40'
           : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
         }`}
        >
         <Play className="w-3.5 h-3.5 fill-current" />
         <span>VidSrc Anime</span>
        </button>
       </>
      )}

      {user && isVip && movie?.id && (
       <button
        onClick={() => {
         setActiveTab('embed');
         if (isScreenSharing) stopScreenShare();
         const isSeries = Boolean(
          movie?.is_series === true ||
          movie?.stream_type === 'tv' ||
          (movie?.seasons_count && movie.seasons_count > 0) ||
          Boolean(movie?.first_air_date) ||
          ((movie?.media_type === 'tv' || movie?.media_type === 'kdrama') && !movie?.is_movie && !movie?.release_date)
         );
         const streamType = isSeries ? 'tv' : 'movie';
         const embedSrc = streamType === 'tv'
          ? `https://vidlink.pro/tv/${movie.id}/1/1?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid`
          : `https://vidlink.pro/movie/${movie.id}?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid`;
         const newSrc = {
          type: 'embed',
          src: embedSrc,
          title: `${movie.title || 'Movie'} (VidLink HD)`
         };
         setVideoSource(newSrc);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
           wsRef.current.send(
            JSON.stringify({
             type: 'CHANGE_SOURCE',
             payload: { source: newSrc }
            })
           );
          }
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
         activeTab === 'embed' && (!videoSource?.src?.includes('anime.vidsrc.me') && !videoSource?.src?.includes('anify.to'))
          ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-950/40'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
        }`}
       >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>VidLink HD</span>
       </button>
      )}

      <button
       onClick={() => setActiveTab('screen')}
       className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
        activeTab === 'screen'
         ? 'bg-purple-600 text-white font-semibold shadow-md shadow-purple-950/40'
         : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
       }`}
      >
       <Monitor className="w-3.5 h-3.5" />
       <span>Share Screen (Live)</span>
       {isScreenSharing && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />}
      </button>

      <button
       onClick={() => setActiveTab('external')}
       className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
        activeTab === 'external'
         ? 'bg-amber-600 text-white font-semibold shadow-md shadow-amber-950/40'
         : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
       }`}
      >
       <Radio className="w-3.5 h-3.5" />
       <span>Streaming Apps Sync</span>
      </button>
     </div>
    ) : (
     <div className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-900/60 border-b border-zinc-800/40 text-xs shrink-0">
      <div className="flex items-center gap-2 min-w-0">
       {activeTab === 'screen' || remoteStream || videoSource?.type === 'webrtc' ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium text-xs">
         <Monitor className="w-3.5 h-3.5 text-purple-400 shrink-0" />
         <span className="truncate">
          {remoteStream ? "Viewing Host's Screen (Live Stream) " : "Connecting to Host's Live Screen..."}
         </span>
        </div>
       ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-medium text-xs">
         <Film className="w-3.5 h-3.5 text-rose-400 shrink-0" />
         <span className="truncate">Synced Movie Playback with Host</span>
        </div>
       )}
      </div>

      {(videoSource?.type === 'webrtc' || activeTab === 'screen') &&!remoteStream && (
       <button
        onClick={requestScreenFromHost}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-[11px] font-semibold border border-purple-500/40 transition-all active:scale-95 shrink-0"
       >
        <RefreshCw className="w-3 h-3" />
        <span>Reconnect Feed</span>
       </button>
      )}
     </div>
    )}

    {/* Main Body (Video Stage Chat Drawer) */}
    <div className="relative flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
     
     {/* Left / Top: Video Stage */}
     <div
      onDoubleClick={toggleFullscreen}
      className={`relative flex flex-col bg-black justify-center items-center overflow-hidden cursor-pointer ${
       isChatOpen
        ? 'w-full aspect-video sm:aspect-video lg:aspect-auto lg:flex-1 shrink-0 lg:shrink'
        : 'w-full flex-1'
      }`}
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
            Synchronizing stream and room settings with {hostName || 'host'}...
           </p>
          </div>
         </div>
        ) : (
         <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
          <Film className="w-12 h-12 text-zinc-700 animate-pulse" />
          <h3 className="text-lg font-bold text-white">Trailer not found</h3>
          <p className="text-xs text-zinc-400 max-w-sm">
           {isHost
            ? 'Switch to "Share Screen (Live)" tab to stream your screen or browser tab!'
            : 'Waiting for host to start movie or screen share.'}
          </p>
         </div>
        )}
       </div>
      )}

      {/* Mode A2: VidSrc Sandboxed Ad-Shielded Embed Player */}
      {activeTab === 'embed' && (
       <div className="relative w-full h-full flex flex-col justify-center items-center">
        <div
         onDoubleClick={toggleFullscreen}
         className={`relative w-full ${
          isFullscreen ? 'h-full max-h-none flex-1' : 'aspect-video max-h-[75vh]'
         } bg-black flex items-center justify-center cursor-pointer overflow-hidden`}
         title="Double-click to toggle fullscreen (F)"
        >
          {(!user || !isVip) ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center z-50">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-4 border border-rose-500/30">
             <span className="text-2xl">🔒</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-mono">
             {!user ? 'Sign In Required' : 'VIP Passcode Required'}
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mb-6">
             {!user
              ? 'Please sign in to access full movies, TV series, and watch party streams.'
              : 'Enter secret access code (e.g. 9999) to unlock streaming in Watch Party.'}
            </p>
            {!user ? (
             <button
              onClick={() => {
               if (onRequireAuth) onRequireAuth();
               if (onShowToast) onShowToast({ message: 'Please sign in' });
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 text-white font-bold text-sm hover:from-rose-500 hover:to-orange-500 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
             >
              Sign In / Register
             </button>
            ) : (
             <form
              onSubmit={async (e) => {
               e.preventDefault();
               const code = e.target.elements.passcode.value.trim();
               if (code === '9999') {
                const res = await onActivateVip?.();
                if (res !== false && onShowToast) {
                  onShowToast({ message: 'VIP Stream Access Unlocked 🤫' });
                }
               } else if (code === '0000') {
                await onDeactivateVip?.();
                if (onShowToast) onShowToast({ message: 'VIP Access Deactivated 🔒' });
               } else {
                alert('Incorrect passcode');
               }
              }}
              className="flex items-center gap-2 w-full max-w-xs"
             >
              <input
               name="passcode"
               type="text"
               maxLength={4}
               placeholder="Passcode..."
               className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm font-mono text-white text-center focus:outline-none focus:border-rose-500 uppercase tracking-widest"
              />
              <button
               type="submit"
               className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-colors shadow-md shrink-0"
              >
               Unlock
              </button>
             </form>
            )}
           </div>
          ) : (() => {
           const isSeries = Boolean(
            movie?.is_series === true ||
            movie?.stream_type === 'tv' ||
            (movie?.seasons_count && movie.seasons_count > 0) ||
            Boolean(movie?.first_air_date) ||
            ((movie?.media_type === 'tv' || movie?.media_type === 'kdrama') && !movie?.is_movie && !movie?.release_date)
           );
           const streamType = isSeries ? 'tv' : 'movie';
           const activeSrc = videoSource?.src || (movie?.id
            ? streamType === 'tv'
              ? `https://vidlink.pro/tv/${movie.id}/1/1?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid`
              : `https://vidlink.pro/movie/${movie.id}?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid`
            : '');
           const isVidLink = activeSrc.includes('vidlink.pro');
           return (
            <iframe
             src={activeSrc}
             title={videoSource?.title || movie?.title || 'Full Movie Stream'}
             allow="autoplay; encrypted-media; picture-in-picture"
             allowFullScreen
             className="w-full h-full border-0"
            />
           );
          })()}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/90 border border-indigo-500/50 text-indigo-300 text-[11px] font-semibold backdrop-blur z-20">
           <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
           <span>Live Stream</span>
          </div>

          {/* Viewer Overlays for Host Authority & Pause States */}
          {!isHost && (
            <>
              {/* Invisible overlay to block clicks so viewers can't seek/play/pause */}
              <div className="absolute inset-0 z-40 bg-transparent" title="Only the host can control playback" />
              
              {/* Dim overlay when the host pauses the video */}
              {!isPlaying && (
                <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm transition-all">
                  <div className="p-4 rounded-full bg-white/10 mb-3">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Host Paused</span>
                </div>
              )}
            </>
          )}
        </div>
       </div>
      )}

      {/* Mode B: WebRTC Screen Sharing Player */}
      {activeTab === 'screen' && (
       <div className="relative w-full h-full flex flex-col justify-center items-center p-0 sm:p-3">
        {isScreenSharing ? (
         <div
          onDoubleClick={toggleFullscreen}
          className={`relative w-full ${
           isFullscreen ? 'h-full max-h-none flex-1 rounded-none border-0' : 'aspect-video max-h-[75vh] rounded-none sm:rounded-2xl border-0 sm:border border-purple-500/40'
          } overflow-hidden bg-zinc-950 cursor-pointer`}
          title="Double-click to toggle fullscreen (F)"
         >
          <video
           ref={localVideoRef}
           autoPlay
           muted
           playsInline
           className="w-full h-full object-contain"
          />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300 text-[11px] font-semibold backdrop-blur">
           <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
           <span>You are sharing your screen</span>
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-2">
           <button
            onClick={openPopoutChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 text-xs font-bold shadow-lg backdrop-blur transition-all active:scale-95"
            title="Pop out floating chat window so you can watch other tabs while chatting"
           >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pop-out Chat </span>
           </button>
          </div>
         </div>
        ) : remoteStream ? (
         <div
          onDoubleClick={toggleFullscreen}
          className={`relative w-full ${
           isFullscreen ? 'h-full max-h-none flex-1 rounded-none border-0' : 'aspect-video max-h-[75vh] rounded-none sm:rounded-2xl border-0 sm:border border-purple-500/40'
          } overflow-hidden bg-zinc-950 cursor-pointer group`}
          title="Double-click to toggle fullscreen (F)"
         >
          <video
           ref={remoteVideoRef}
           autoPlay
           playsInline
           className={`w-full h-full object-contain transition-all duration-300 ${isMutedByBrowser ? 'blur-sm brightness-50' : ''}`}
          />

          {/* Autoplay Blocked - Tap to Unmute Overlay */}
          {isMutedByBrowser && (
           <div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10"
            onClick={(e) => {
             e.stopPropagation();
             if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = false;
              setIsMutedByBrowser(false);
              setStreamAudioMuted(false);
             }
            }}
           >
            <div className="w-16 h-16 rounded-full bg-rose-600/90 text-white flex items-center justify-center mb-4 shadow-xl shadow-rose-900/50 hover:scale-105 active:scale-95 transition-transform cursor-pointer border-2 border-white/20">
             <Volume2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white shadow-sm">Tap to Unmute Stream</h3>
            <p className="text-zinc-300 text-sm mt-1 max-w-xs text-center drop-shadow-md">
             Your browser paused the audio. Tap anywhere to enable sound!
            </p>
           </div>
          )}

          {/* Mobile Picture-in-Picture Button */}
          {typeof document!== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled &&!isMutedByBrowser && (
           <button
            onClick={handleTogglePiP}
            className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur"
            title="Picture-in-Picture"
           >
            <ExternalLink className="w-4 h-4" />
           </button>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300 text-[11px] font-semibold backdrop-blur">
           <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
           <span>Viewing host's screen share </span>
          </div>

          {streamAudioMuted && (
           <button
            onClick={() => {
             if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = false;
              setStreamAudioMuted(false);
             }
            }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xl animate-bounce"
           >
            <VolumeX className="w-4 h-4" />
            <span>Tap to Unmute Audio </span>
           </button>
          )}
         </div>
        ) : (
         <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
           <Monitor className={`w-7 h-7 ${isNegotiating ? 'animate-bounce text-purple-300' : 'animate-pulse'}`} />
          </div>
          <div>
           <h3 className="text-base sm:text-lg font-bold text-white">
            {isHost ? 'SharePlay Screen Sharing' : (isNegotiating ? 'Syncing with Host...' : 'Live Screen Stream')}
           </h3>
           <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
            {isHost
             ? 'Stream any browser tab, video player, or screen with audio directly to everyone in this room!'
             : (isNegotiating ? 'Establishing secure WebRTC connection with host. This may take a few seconds.' : `Waiting for host (${hostName || 'Host'}) to start sharing screen...`)}
           </p>
          </div>

          {isHost ? (
           <button
            onClick={handleScreenShareClick}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-purple-950/60 transition-all active:scale-95"
           >
            <Monitor className="w-4 h-4" />
            <span>Start Screen Share</span>
           </button>
          ) : (
           <div className="flex flex-col items-center gap-2">
            {isNegotiating ? (
             <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-xs text-purple-200 font-semibold shadow-lg shadow-purple-900/20">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Connecting...</span>
             </div>
            ) : (
             <>
              <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
               Waiting for host's video stream...
              </div>
              <button
               onClick={requestScreenFromHost}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-xs font-semibold border border-purple-500/40 transition-all active:scale-95"
              >
               <RefreshCw className="w-3.5 h-3.5" />
               <span>Request / Reconnect Feed</span>
              </button>
             </>
            )}
           </div>
          )}
         </div>
        )}

        {/* Host screen share control actions */}
        {isScreenSharing && isHost && (
         <div className="mt-3 flex items-center gap-3">
          <button
           onClick={openPopoutChat}
           className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95"
          >
           <ExternalLink className="w-3.5 h-3.5" />
           <span>Pop-out Chat Window </span>
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
       <div className="relative w-full h-full flex flex-col justify-center items-center p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-950/40">
         <Radio className="w-7 h-7" />
        </div>
        <div>
         <h3 className="text-base sm:text-lg font-bold text-white">Streaming Platform Sync</h3>
         <p className="text-xs text-zinc-400 mt-1 max-w-md">
          Watch together on your own Netflix, Prime, Disney+, or Tubi accounts. Host triggers the synchronized countdown so everyone taps Play at the exact same second!
         </p>
        </div>

        {/* Platform Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
         <a
          href={`https://www.netflix.com/search?q=${encodeURIComponent(movie?.title || '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-rose-400 transition-all group"
         >
          <span className="font-bold text-xs sm:text-sm">Netflix</span>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-rose-400 mt-1" />
         </a>

         <a
          href={`https://www.amazon.com/s?k=${encodeURIComponent(movie?.title || '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-sky-400 transition-all group"
         >
          <span className="font-bold text-xs sm:text-sm">Prime Video</span>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-sky-400 mt-1" />
         </a>

         <a
          href={`https://www.disneyplus.com/search?q=${encodeURIComponent(movie?.title || '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-blue-400 transition-all group"
         >
          <span className="font-bold text-xs sm:text-sm">Disney+</span>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-blue-400 mt-1" />
         </a>

         <a
          href={`https://tubitv.com/search/${encodeURIComponent(movie?.title || '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-amber-400 transition-all group"
         >
          <span className="font-bold text-xs sm:text-sm">Tubi (Free)</span>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 mt-1" />
         </a>
        </div>

        {/* Host Countdown Trigger */}
        {isHost && (
         <div className="pt-1 w-full">
          {countdown!== null ? (
           <div className="py-3 px-6 rounded-2xl bg-rose-600/20 border border-rose-500/50 animate-bounce">
            <span className="text-2xl sm:text-4xl font-black text-rose-400 font-mono tracking-widest">
             {countdown}
            </span>
           </div>
          ) : (
           <button
            onClick={startExternalCountdown}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-amber-950/50 transition-all active:scale-95"
           >
            <span>Start 5-Second Play Countdown ⏱️</span>
           </button>
          )}
         </div>
        )}
       </div>
      )}

      {/* Floating Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
       {reactions.map((r) => (
        <div
         key={r.id}
         style={{
          left: `${r.left}%`,
          bottom: '60px',
          transform: `rotate(${r.rotation}deg)`,
         }}
         className="absolute flex flex-col items-center animate-reaction-float"
        >
         <span className="text-2xl sm:text-4xl filter drop-shadow-md select-none">{r.emoji}</span>
         <span className="text-[9px] font-bold text-white bg-black/60 px-1 py-0.5 rounded-full backdrop-blur-sm mt-0.5">
          {r.userName}
         </span>
        </div>
       ))}
      </div>

      {/* Bottom Scrubber & Playback Controls Bar */}
      <div className="w-full bg-gradient-to-t from-black via-zinc-950/95 to-transparent px-2.5 py-1.5 sm:px-4 sm:py-3 z-20 space-y-1 sm:space-y-2 shrink-0">
       {/* Progress Slider (Only for In-App Video and Host) */}
       {activeTab === 'watch' && (
        <div className="flex items-center gap-2 sm:gap-3">
         <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 w-8 sm:w-10 text-right">
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
          className={`flex-1 h-1 sm:h-1.5 bg-zinc-800 rounded-lg appearance-none accent-rose-500 ${
           !isHost ? 'opacity-70 cursor-default' : 'cursor-pointer'
          }`}
         />
         <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 w-8 sm:w-10">
          {formatTime(duration)}
         </span>
        </div>
       )}

       {/* Controls & Quick Reaction Tray */}
       <div className="flex items-center justify-between gap-1 sm:gap-2">
        {/* Playback buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
         {isHost ? (
          <>
           {activeTab === 'watch' && (
            <>
             <button
              onClick={togglePlayPause}
              className="p-1.5 sm:p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 transition-all active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
             >
              {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />}
             </button>
             <button
              onClick={() => handleSkip(-10)}
              className="hidden xs:flex p-1.5 sm:p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95 text-[10px] sm:text-xs font-semibold"
              title="Skip back 10s"
             >
              -10s
             </button>
             <button
              onClick={() => handleSkip(10)}
              className="hidden xs:flex p-1.5 sm:p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95 text-[10px] sm:text-xs font-semibold"
              title="Skip forward 10s"
             >
              10s
             </button>
            </>
           )}
          </>
         ) : (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] sm:text-xs font-mono text-emerald-400">
           <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
           <span className="truncate">{activeTab === 'screen' ? 'Live Stream' : 'In Sync'}</span>
          </div>
         )}

         {activeTab === 'watch' && (
          <button
           onClick={() => {
            setIsMuted(!isMuted);
            if (ytPlayerRef.current) {
             if (!isMuted) ytPlayerRef.current.mute?.();
             else ytPlayerRef.current.unMute?.();
            }
           }}
           className="p-1.5 sm:p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-all"
           title={isMuted ? 'Unmute' : 'Mute'}
          >
           {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
         )}

         <button
          onClick={toggleFullscreen}
          className="p-1.5 sm:p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95"
          title={isFullscreen ? 'Exit Full Screen (F)' : 'Full Screen Mode (F)'}
         >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
         </button>
        </div>

        {/* Reaction Cannon Buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl px-1.5 py-0.5 sm:px-2 sm:py-1 shadow-lg shrink-0">
         {REACTION_EMOJIS.map((emoji) => (
          <button
           key={emoji}
           onClick={() => sendReaction(emoji)}
           className="p-1 hover:scale-125 transition-transform active:scale-90 text-xs sm:text-base select-none"
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
      <div className="w-full lg:w-80 flex-1 lg:h-full min-h-0 bg-zinc-950/95 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col z-20 shrink-0 lg:shrink">
       
       {/* Drawer Header */}
       <div className="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
         <Users className="w-3.5 h-3.5 text-rose-400" />
         <span className="text-xs font-bold text-white uppercase tracking-wider">Party Chat</span>
         <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono">
          {normalizeParticipants(participants).length}
         </span>
        </div>

        <div className="flex items-center gap-2">
         <button
          onClick={openPopoutChat}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold transition-all active:scale-95"
          title="Pop out floating chat window to stay on top while watching other tabs"
         >
          <ExternalLink className="w-3 h-3" />
          <span className="hidden sm:inline">Pop out</span>
         </button>

         {/* Participant Avatars */}
         <div className="flex -space-x-1.5 overflow-hidden">
          {normalizeParticipants(participants).slice(0, 4).map((p) => {
           const name = p?.name || 'Guest';
           return (
            <div
             key={p?.id || name}
             className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-white uppercase"
             title={name}
            >
             {name.charAt(0)}
            </div>
           );
          })}
         </div>

         {/* Mobile close chat button */}
         <button
          onClick={() => setIsChatOpen(false)}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 lg:hidden transition-colors"
          title="Hide chat to view full video"
         >
          <X className="w-3.5 h-3.5" />
         </button>
        </div>
       </div>

       {/* Chat Messages List */}
       <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2 text-xs scrollbar-thin scrollbar-thumb-zinc-700"
       >
        {chatMessages.length === 0 ? (
         <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500">
          <MessageSquare className="w-6 h-6 mb-1.5 opacity-40" />
          <p className="text-xs">No messages yet.</p>
          <p className="text-[11px] text-zinc-600">Send a greeting or reaction to start the party!</p>
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
             className={`px-3 py-1.5 rounded-2xl max-w-[85%] break-words text-xs ${
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
       <form onSubmit={sendChatMessage} className="p-2 bg-zinc-900/95 border-t border-zinc-800 flex gap-2 shrink-0">
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
         <Send className="w-3.5 h-3.5" />
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

   {/* Host Audio Reminder Modal */}
   {showAudioReminder && (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
     <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
       <Volume2 className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Share your audio!</h3>
      <p className="text-sm text-zinc-400 mb-6">
       When the browser popup appears, make sure to toggle <strong className="text-white">Share tab audio</strong> or <strong className="text-white">Share system audio</strong> so your friends can hear the movie.
      </p>
      <div className="w-full flex gap-3">
       <button
        onClick={() => setShowAudioReminder(false)}
        className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all"
       >
        Cancel
       </button>
       <button
        onClick={startScreenShare}
        className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-900/50 transition-all active:scale-95"
       >
        Got it, let's go!
       </button>
      </div>
     </div>
    </div>
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
       {participants.length}
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
       10s
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
  const nextPlaying =!isPlaying;
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
