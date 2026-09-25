import React, { useState, useEffect, useRef } from 'react';
import {
 Users, Heart, X, Copy, Check, Sparkles, Share2, LogOut,
 RefreshCw, Film, Tv, Star, Bookmark, ChevronRight, Info, Flame, AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function MovieNightModal({
 isOpen,
 onClose,
 initialRoomCode = '',
 onShowToast,
 onSelectMovie,
 onStartWatchParty
}) {
 const { user, toggleWatchlist, watchlistIds } = useAuth();

 // Mode: 'lobby' (create or join) or 'room' (active swiping)
 const [mode, setMode] = useState('lobby');
 const [activeLobbyTab, setActiveLobbyTab] = useState(initialRoomCode ? 'join' : 'create');

 // Creation form state
 const [hostName, setHostName] = useState(user?.displayName || localStorage.getItem('movienight_name') || '');
 const [roomName, setRoomName] = useState('');
 const [mediaType, setMediaType] = useState('all');
 const [genre, setGenre] = useState('All');
 const [matchThreshold, setMatchThreshold] = useState('everyone');

 // Join form state
 const [joinCode, setJoinCode] = useState(initialRoomCode || '');
 const [joinName, setJoinName] = useState(user?.displayName || localStorage.getItem('movienight_name') || '');

 // Active room state
 const [currentRoom, setCurrentRoom] = useState(null);
 const [myUserId, setMyUserId] = useState(() => {
  return user?.uid || localStorage.getItem('movienight_uid') || `user_${Math.random().toString(36).substring(2, 9)}`;
 });
 const [isLoading, setIsLoading] = useState(false);
 const [errorMsg, setErrorMsg] = useState('');
 const [copiedLink, setCopiedLink] = useState(false);

 // Swiping state
 const [deck, setDeck] = useState([]);
 const [currentIndex, setCurrentIndex] = useState(0);
 const [showDetails, setShowDetails] = useState(false);
 const [activeMatchOverlay, setActiveMatchOverlay] = useState(null);
 const [showMatchesSheet, setShowMatchesSheet] = useState(false);
 const [showShareModal, setShowShareModal] = useState(false);
 const [copiedShareCode, setCopiedShareCode] = useState(false);
 const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const dragStartRef = useRef({ x: 0, y: 0 });

 // Persist user ID and nickname in localStorage
 useEffect(() => {
  if (user?.uid) {
   setMyUserId(user.uid);
   if (user.displayName) {
    setHostName(user.displayName);
    setJoinName(user.displayName);
   }
  } else {
   localStorage.setItem('movienight_uid', myUserId);
  }
 }, [user]);

 // Reset state every time the modal opens — prevents blank body when mode
 // was stuck on 'room' from a previous session but currentRoom was already null.
 useEffect(() => {
  if (isOpen) {
   // Only reset to lobby if there's no active room session
   if (!currentRoom) {
    setMode('lobby');
    setDeck([]);
    setCurrentIndex(0);
    setShowDetails(false);
    setActiveMatchOverlay(null);
    setShowMatchesSheet(false);
    setShowShareModal(false);
    setErrorMsg('');
   }
  }
 }, [isOpen]);

 // Close modal on Escape key
 useEffect(() => {
  if (!isOpen) return;
  const handleEscape = (e) => {
   if (e.key === 'Escape') {
    onClose();
   }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
 }, [isOpen, onClose]);

 useEffect(() => {
  if (initialRoomCode) {
   setJoinCode(initialRoomCode.toUpperCase());
   setActiveLobbyTab('join');
  }
 }, [initialRoomCode]);

 // Polling active room state every 2 seconds when inside a room
 useEffect(() => {
  if (!isOpen || mode!== 'room' ||!currentRoom?.code) return;

  let isMounted = true;
  const fetchRoom = async () => {
   try {
    const res = await api.get(`/rooms/${currentRoom.code}?user_id=${encodeURIComponent(myUserId)}`);
    if (isMounted && res.data?.room) {
     const updated = res.data.room;

     // Check if any new matches arrived that we haven't celebrated yet
     if (updated.matches && currentRoom.matches) {
      if (updated.matches.length > currentRoom.matches.length) {
       const latestMatch = updated.matches[updated.matches.length - 1];
       setActiveMatchOverlay(latestMatch);
      }
     }

     setCurrentRoom(updated);
     // Sync unswiped deck if initial deck was empty
     if (deck.length === 0 && updated.unswiped_deck?.length > 0) {
      setDeck(updated.unswiped_deck);
      setCurrentIndex(0);
     }
    }
   } catch (err) {
    console.error("Room sync error:", err);
   }
  };

  const interval = setInterval(fetchRoom, 2000);
  return () => {
   isMounted = false;
   clearInterval(interval);
  };
 }, [isOpen, mode, currentRoom?.code, currentRoom?.matches?.length, myUserId, deck.length]);

 // Handle Room Creation
 const handleCreateRoom = async (e) => {
  e.preventDefault();
  if (!hostName.trim()) {
   setErrorMsg("Please enter your name.");
   return;
  }
  setIsLoading(true);
  setErrorMsg('');
  try {
   localStorage.setItem('movienight_name', hostName.trim());
   const res = await api.post('/rooms/create', {
    host_name: hostName.trim(),
    host_id: myUserId,
    media_type: mediaType,
    genre: genre,
    room_name: roomName.trim() || undefined,
    match_threshold: matchThreshold
   });

   if (res.data?.room) {
    setCurrentRoom(res.data.room);
    setDeck(res.data.room.unswiped_deck || []);
    setCurrentIndex(0);
    setMode('room');
    setShowShareModal(true); // Open share & promote modal immediately
    if (onShowToast) {
     onShowToast({ message: `Room ${res.data.room.code} created! Invite your friends.` });
    }
   }
  } catch (err) {
   console.error("Failed to create room:", err);
   setErrorMsg(err.response?.data?.detail || "Failed to create room. Please try again.");
  } finally {
   setIsLoading(false);
  }
 };

 // Handle Joining a Room
 const handleJoinRoom = async (e) => {
  e.preventDefault();
  if (!joinCode.trim()) {
   setErrorMsg("Please enter a 4-letter room code.");
   return;
  }
  if (!joinName.trim()) {
   setErrorMsg("Please enter your name.");
   return;
  }
  setIsLoading(true);
  setErrorMsg('');
  try {
   localStorage.setItem('movienight_name', joinName.trim());
   const code = joinCode.trim().toUpperCase();
   const res = await api.post(`/rooms/${code}/join`, {
    user_name: joinName.trim(),
    user_id: myUserId
   });

   if (res.data?.room) {
    setCurrentRoom(res.data.room);
    setDeck(res.data.room.unswiped_deck || []);
    setCurrentIndex(0);
    setMode('room');
    if (onShowToast) {
     onShowToast({ message: `Joined room ${code}!` });
    }
   }
  } catch (err) {
   console.error("Failed to join room:", err);
   setErrorMsg(err.response?.data?.detail || "Room not found or expired. Check your code.");
  } finally {
   setIsLoading(false);
  }
 };

 // Handle User Swipe (Liked or Passed)
 const handleSwipe = async (liked) => {
  if (currentIndex >= deck.length ||!currentRoom) return;

  const movie = deck[currentIndex];
  // Optimistically advance to next card immediately
  setCurrentIndex(prev => prev + 1);
  setDragOffset({ x: 0, y: 0 });
  setShowDetails(false);

  try {
   const res = await api.post(`/rooms/${currentRoom.code}/swipe`, {
    user_id: myUserId,
    movie_id: movie.id,
    liked: liked
   });

   const swipeResult = res.data?.result;
   if (swipeResult?.is_match && swipeResult.matched_movie) {
    setActiveMatchOverlay({
     movie: swipeResult.matched_movie,
     liked_by: swipeResult.liked_by,
     matched_at: Date.now() / 1000
    });
   }
  } catch (err) {
   console.error("Failed to submit swipe:", err);
  }
 };

 // Copy or natively share join link
 const handleCopyLink = async () => {
  if (!currentRoom?.code) return;
  const shareUrl = `${window.location.origin}/?room=${currentRoom.code}`;
  if (typeof navigator!== 'undefined' && navigator.share) {
   try {
    await navigator.share({
     title: `Join Movie Night (Room ${currentRoom.code})`,
     text: ` Join our Movie Night on MovieRecommendation! Swipe movies together and find a match in Room ${currentRoom.code}:`,
     url: shareUrl,
    });
    if (onShowToast) {
     onShowToast({ message: "Invitation sent! " });
    }
    return;
   } catch (err) {
    if (err.name === 'AbortError') return;
   }
  }
  try {
   await navigator.clipboard.writeText(shareUrl);
   setCopiedLink(true);
   setTimeout(() => setCopiedLink(false), 2500);
   if (onShowToast) {
    onShowToast({ message: `Share link copied: ${shareUrl}` });
   }
  } catch (_) {
   if (onShowToast) {
    onShowToast({ message: `Room link: ${shareUrl}` });
   }
  }
 };

 // Copy 4-letter room code only
 const handleCopyCode = () => {
  if (!currentRoom?.code) return;
  navigator.clipboard.writeText(currentRoom.code);
  setCopiedShareCode(true);
  setTimeout(() => setCopiedShareCode(false), 2500);
  if (onShowToast) {
   onShowToast({ message: `Room code ${currentRoom.code} copied!` });
  }
 };

 // Promote on TikTok
 const handleShareTikTok = () => {
  if (!currentRoom?.code) return;
  const shareUrl = `${window.location.origin}/?room=${currentRoom.code}`;
  const caption = ` Join my Movie Night on MovieRecommendation! Code: ${currentRoom.code} ${shareUrl} #MovieNight #MovieRecommendation #Movies #WhatToWatch`;
  navigator.clipboard.writeText(caption);
  if (onShowToast) {
   onShowToast({ message: "TikTok caption & link copied to clipboard! Opening TikTok..." });
  }
  window.open('https://www.tiktok.com/', '_blank', 'noopener,noreferrer');
 };

 // Promote on LinkedIn
 const handleShareLinkedIn = () => {
  if (!currentRoom?.code) return;
  const shareUrl = `${window.location.origin}/?room=${currentRoom.code}`;
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600');
  if (onShowToast) {
   onShowToast({ message: "Opening LinkedIn share..." });
  }
 };

 // Promote on Instagram
 const handleShareInstagram = () => {
  if (!currentRoom?.code) return;
  const shareUrl = `${window.location.origin}/?room=${currentRoom.code}`;
  const caption = ` Join my Movie Night room on MovieRecommendation! Code: ${currentRoom.code} ${shareUrl}`;
  navigator.clipboard.writeText(caption);
  if (onShowToast) {
   onShowToast({ message: "Room link copied! Paste into your Instagram Story or DM." });
  }
  window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
 };

 // Promote on Facebook
 const handleShareFacebook = () => {
  if (!currentRoom?.code) return;
  const shareUrl = `${window.location.origin}/?room=${currentRoom.code}`;
  const quote = `Join my Movie Night group swipe room on MovieRecommendation! Room Code: ${currentRoom.code}`;
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(quote)}`;
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600');
  if (onShowToast) {
   onShowToast({ message: "Opening Facebook share..." });
  }
 };

 // Native Web Share (for Mobile & Supported Browsers)
 const handleNativeShare = async () => {
  if (!currentRoom?.code) return;
  const shareUrl = `${window.location.origin}/?room=${currentRoom.code}`;
  if (typeof navigator!== 'undefined' && navigator.share) {
   try {
    await navigator.share({
     title: `Movie Night on MovieRecommendation (${currentRoom.code})`,
     text: `Join my Movie Night room with code ${currentRoom.code}! Swipe together to find our next movie:`,
     url: shareUrl
    });
    return;
   } catch (err) {
    if (err.name!== 'AbortError') console.error("Native share error:", err);
   }
  }
  handleCopyLink();
 };

 // Leave Room
 const handleLeaveRoom = async () => {
  if (!currentRoom?.code) return;
  try {
   await api.post(`/rooms/${currentRoom.code}/leave`, { user_id: myUserId });
  } catch (err) {
   console.error("Error leaving room:", err);
  }
  setCurrentRoom(null);
  setDeck([]);
  setCurrentIndex(0);
  setMode('lobby');
  setShowShareModal(false);
 };

 // Touch / Drag Handlers for Card Swiping
 const handleTouchStart = (e) => {
  const touch = e.touches[0];
  dragStartRef.current = { x: touch.clientX, y: touch.clientY };
  setIsDragging(true);
 };

 const handleTouchMove = (e) => {
  if (!isDragging) return;
  const touch = e.touches[0];
  const deltaX = touch.clientX - dragStartRef.current.x;
  const deltaY = touch.clientY - dragStartRef.current.y;
  setDragOffset({ x: deltaX, y: deltaY });
 };

 const handleTouchEnd = () => {
  if (!isDragging) return;
  setIsDragging(false);
  if (dragOffset.x > 90) {
   handleSwipe(true); // Swiped right -> Like
  } else if (dragOffset.x < -90) {
   handleSwipe(false); // Swiped left -> Pass
  } else {
   setDragOffset({ x: 0, y: 0 }); // Snap back
  }
 };

 // Keyboard controls
 useEffect(() => {
  if (!isOpen || mode!== 'room' || activeMatchOverlay || showMatchesSheet || showShareModal) return;

  const handleKeyDown = (e) => {
   if (e.key === 'ArrowRight') {
    handleSwipe(true);
   } else if (e.key === 'ArrowLeft') {
    handleSwipe(false);
   } else if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    setShowDetails(prev =>!prev);
   }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [isOpen, mode, currentIndex, deck.length, activeMatchOverlay, showMatchesSheet, showShareModal]);

 const currentMovie = deck[currentIndex];
 const hasFinishedDeck = deck.length > 0 && currentIndex >= deck.length;

 if (!isOpen) return null;

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
   <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">

    {/* Modal Header */}
    <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-zinc-800/80 bg-zinc-900/60">
     <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white text-base shadow-md shadow-rose-950/40 shrink-0">
       
      </div>
      <div className="min-w-0">
       <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
        <span>Movie Night</span>
        {mode === 'room' && currentRoom && (
         <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
          {currentRoom.code}
         </span>
        )}
       </h2>
       <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
        {mode === 'room' ? (currentRoom?.name || 'Group Swiping Session') : 'Swipe together with friends or couples'}
       </p>
      </div>
     </div>

     <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {mode === 'room' && (
       <>
        <button
         type="button"
         onClick={() => setShowShareModal(true)}
         className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/20 to-orange-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold hover:bg-rose-500/30 transition-all active:scale-95"
         title="Share & Invite Friends"
        >
         <Share2 className="w-3.5 h-3.5" />
         <span className="hidden xs:inline">Share</span>
        </button>

        <button
         type="button"
         onClick={() => setShowMatchesSheet(prev =>!prev)}
         className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all active:scale-95"
        >
         <Sparkles className="w-3.5 h-3.5" />
         <span className="hidden xs:inline">Matches </span>
         <span>({currentRoom?.matches?.length || 0})</span>
        </button>
       </>
      )}

      <button
       onClick={onClose}
       className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
       title="Close (Esc)"
      >
       <X className="w-5 h-5" />
      </button>
     </div>
    </div>

    {/* Modal Body */}
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col justify-center">

     {/* ========================================================================= */}
     {/* LOBBY MODE: HOST OR JOIN ROOM                       */}
     {/* ========================================================================= */}
     {mode === 'lobby' && (
      <div className="space-y-5">
       {/* Tab Selector: Host a Room vs Join Room */}
       <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
        <button
         type="button"
         onClick={() => { setActiveLobbyTab('create'); setErrorMsg(''); }}
         className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
          activeLobbyTab === 'create'
           ? 'bg-rose-600 text-white shadow-md'
           : 'text-zinc-400 hover:text-zinc-200'
         }`}
        >
         🚀 Host a Room
        </button>
        <button
         type="button"
         onClick={() => { setActiveLobbyTab('join'); setErrorMsg(''); }}
         className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
          activeLobbyTab === 'join'
           ? 'bg-rose-600 text-white shadow-md'
           : 'text-zinc-400 hover:text-zinc-200'
         }`}
        >
          Join with Code
        </button>
       </div>

       {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
         <AlertCircle className="w-4 h-4 shrink-0" />
         <span>{errorMsg}</span>
        </div>
       )}

       {/* Host Form */}
       {activeLobbyTab === 'create' && (
        <form onSubmit={handleCreateRoom} className="space-y-4">
         <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">Your Nickname</label>
          <input
           type="text"
           required
           placeholder="e.g. Alex or MovieBuff"
           value={hostName}
           onChange={(e) => setHostName(e.target.value)}
           className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
         </div>

         <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">Room Name (Optional)</label>
          <input
           type="text"
           placeholder="e.g. Friday Pizza & Movies"
           value={roomName}
           onChange={(e) => setRoomName(e.target.value)}
           className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
         </div>

         <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
           <label className="text-xs font-semibold text-zinc-300">What to Watch</label>
           <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-medium focus:outline-none focus:border-rose-500"
           >
            <option value="all"> Any (Movies & TV)</option>
            <option value="movie"> Movies Only</option>
            <option value="tv">📺 TV Series Only</option>
            <option value="anime"> Anime Only</option>
           </select>
          </div>

          <div className="space-y-1.5">
           <label className="text-xs font-semibold text-zinc-300">Vibe / Genre</label>
           <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-medium focus:outline-none focus:border-rose-500"
           >
            <option value="All">All Genres</option>
            <option value="Comedy">Comedy</option>
            <option value="Action">Action</option>
            <option value="Horror">Horror</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Romance">Romance</option>
            <option value="Drama">Drama</option>
            <option value="Thriller">Thriller</option>
            <option value="Animation">Animation</option>
           </select>
          </div>
         </div>

         <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-zinc-300">Match Rule</label>
          <div className="grid grid-cols-2 gap-2">
           <button
            type="button"
            onClick={() => setMatchThreshold('everyone')}
            className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
             matchThreshold === 'everyone'
              ? 'bg-rose-950/40 border-rose-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
           >
            <div className="font-semibold">Unanimous</div>
            <div className="text-[10px] text-zinc-400">Everyone must like</div>
           </button>
           <button
            type="button"
            onClick={() => setMatchThreshold('at_least_2')}
            className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
             matchThreshold === 'at_least_2'
              ? 'bg-rose-950/40 border-rose-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
           >
            <div className="font-semibold">Any 2 People</div>
            <div className="text-[10px] text-zinc-400">Match on 2+ votes</div>
           </button>
          </div>
         </div>

         <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-sm font-bold shadow-lg shadow-rose-950/50 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
         >
          {isLoading ? (
           <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Seeding Deck...</span>
           </>
          ) : (
           <>
            <span>Create Room & Start Swiping</span>
            <ChevronRight className="w-4 h-4" />
           </>
          )}
         </button>
        </form>
       )}

       {/* Join Form */}
       {activeLobbyTab === 'join' && (
        <form onSubmit={handleJoinRoom} className="space-y-4">
         {initialRoomCode && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-orange-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
           <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
           <div>
            <div className="font-bold text-white flex items-center gap-1.5">
             <span>Invited to Room:</span>
             <span className="font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {initialRoomCode}
             </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
             Enter your nickname below to join your group and start matching!
            </p>
           </div>
          </div>
         )}

         <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">4-Letter Room Code</label>
          <input
           type="text"
           required
           maxLength={5}
           placeholder="e.g. FILM or CINE"
           value={joinCode}
           onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
           className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-center font-mono font-bold tracking-widest text-xl focus:outline-none focus:border-rose-500 uppercase transition-colors"
          />
         </div>

         <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">Your Nickname</label>
          <input
           type="text"
           required
           placeholder="e.g. Alex"
           value={joinName}
           onChange={(e) => setJoinName(e.target.value)}
           className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
         </div>

         <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-sm font-bold shadow-lg shadow-rose-950/50 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
         >
          {isLoading ? (
           <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Joining Room...</span>
           </>
          ) : (
           <>
            <span>Join Room </span>
            <ChevronRight className="w-4 h-4" />
           </>
          )}
         </button>
        </form>
       )}
      </div>
     )}

     {/* ========================================================================= */}
     {/* ROOM MODE: SWIPING INTERFACE                        */}
     {/* ========================================================================= */}
     {mode === 'room' && currentRoom && (
      <div className="space-y-4 flex flex-col h-full">

       {/* Room Live Bar: Participants & Share Code */}
       <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
         <div className="flex items-center gap-1 font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
          <span>Code: {currentRoom.code}</span>
          <button
           type="button"
           onClick={handleCopyLink}
           className="ml-0.5 p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
           title="Quick Copy Link"
          >
           {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
           type="button"
           onClick={() => setShowShareModal(true)}
           className="ml-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-rose-600/30 to-amber-500/30 hover:from-rose-600/40 hover:to-amber-500/40 text-[11px] font-sans font-semibold text-rose-300 border border-rose-500/40 flex items-center gap-1 transition-all active:scale-95"
           title="Share & Promote on Social Media"
          >
           <Share2 className="w-3 h-3" />
           <span>Share</span>
          </button>
         </div>

         {/* Participant Chips */}
         <div className="flex items-center gap-1 flex-wrap">
          {currentRoom.participants?.map((p) => (
           <span
            key={p.user_id}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 border ${
             p.is_you
              ? 'bg-rose-950/50 border-rose-700/50 text-rose-300 font-semibold'
              : 'bg-zinc-850 border-zinc-700/60 text-zinc-300'
            }`}
           >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            {p.name} {p.swipe_count > 0 && <span className="opacity-70 font-mono">({p.swipe_count})</span>}
           </span>
          ))}
         </div>
        </div>

        <button
         onClick={handleLeaveRoom}
         className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 transition-colors ml-auto"
        >
         <LogOut className="w-3 h-3" />
         <span>Leave</span>
        </button>
       </div>

       {/* Deck Swiping View */}
       {!hasFinishedDeck && currentMovie ? (
        <div className="relative flex-1 flex flex-col items-center justify-center">

         {/* Card Container */}
         <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
           transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y * 0.3}px) rotate(${dragOffset.x * 0.08}deg)`,
           transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
           touchAction: 'none'
          }}
          className="relative w-full max-w-[270px] xs:max-w-xs sm:max-w-sm aspect-[2/3] max-h-[46dvh] sm:max-h-[54vh] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl select-none cursor-grab active:cursor-grabbing group"
         >
          {/* Visual Swipe Indicators */}
          {dragOffset.x > 30 && (
           <div className="absolute top-4 left-4 z-30 px-3 py-1.5 rounded-xl bg-emerald-500/90 text-black font-black text-sm uppercase tracking-wider shadow-lg border-2 border-white/40 transform -rotate-12 pointer-events-none">
            LIKE ❤️
           </div>
          )}
          {dragOffset.x < -30 && (
           <div className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-xl bg-rose-600/90 text-white font-black text-sm uppercase tracking-wider shadow-lg border-2 border-white/40 transform rotate-12 pointer-events-none">
            NOPE ❌
           </div>
          )}

          {/* Movie Poster Background */}
          <img
           src={currentMovie.poster_url}
           alt={currentMovie.title}
           className="w-full h-full object-cover pointer-events-none"
          />

          {/* Card Content Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-3.5 sm:p-5 pointer-events-none">
           <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-zinc-300 border border-white/15">
             {currentMovie.year || 'N/A'}
            </span>
            {currentMovie.imdb_rating && (
             <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 stroke-none" />
              {currentMovie.imdb_rating}
             </span>
            )}
            {currentMovie.rotten_tomatoes && (
             <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40">
              🍅 {currentMovie.rotten_tomatoes}
             </span>
            )}
           </div>

           <h3 className="text-base sm:text-xl font-black text-white leading-tight drop-shadow-md line-clamp-2">
            {currentMovie.title}
           </h3>

           {currentMovie.genres?.length > 0 && (
            <p className="text-[11px] sm:text-xs text-zinc-300 mt-1 font-medium truncate">
             {currentMovie.genres.slice(0, 3).join(' • ')}
            </p>
           )}

           {/* Expandable Overview */}
           {showDetails && currentMovie.overview && (
            <p className="text-xs text-zinc-300 mt-2 bg-black/70 backdrop-blur-md p-2 rounded-lg border border-white/10 max-h-24 overflow-y-auto leading-relaxed animate-in fade-in">
             {currentMovie.overview}
            </p>
           )}
          </div>
         </div>

         {/* Tactical Action Buttons */}
         <div className="flex items-center justify-center gap-3.5 sm:gap-5 mt-3 sm:mt-4">
          {/* Pass Button */}
          <button
           onClick={() => handleSwipe(false)}
           className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-900 border-2 border-rose-500/50 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-lg active:scale-90 flex items-center justify-center"
           title="Pass (Left Arrow)"
          >
           <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>

          {/* Toggle Info Button */}
          <button
           onClick={() => setShowDetails(prev =>!prev)}
           className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all active:scale-90 flex items-center justify-center"
           title="Show Synopsis (Space)"
          >
           <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Watchlist Bookmark */}
          <button
           onClick={() => {
            toggleWatchlist(currentMovie);
            if (onShowToast) {
             onShowToast({ message: `Saved "${currentMovie.title}" to Watchlist` });
            }
           }}
           className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900 border transition-all active:scale-90 flex items-center justify-center ${
            watchlistIds?.has(currentMovie.id)
             ? 'border-amber-500 text-amber-400 bg-amber-500/10'
             : 'border-zinc-700 text-zinc-400 hover:text-white'
           }`}
           title="Save to Personal Watchlist"
          >
           <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${watchlistIds?.has(currentMovie.id) ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Like Button */}
          <button
           onClick={() => handleSwipe(true)}
           className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-900 border-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-lg active:scale-90 flex items-center justify-center"
           title="Like (Right Arrow)"
          >
           <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-current stroke-none" />
          </button>
         </div>

         <p className="text-[10px] sm:text-[11px] text-zinc-500 text-center mt-2">
          Card {currentIndex + 1} of {deck.length} • Swipe right to Like, left to Pass
         </p>
        </div>
       ) : (
        /* Finished Deck View */
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
         <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
          
         </div>
         <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">You've Swiped All Titles!</h3>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
           You've completed this session's candidate deck. Check your matches below to see what everyone agreed on!
          </p>
         </div>

         <div className="flex items-center gap-2.5 flex-wrap justify-center pt-1">
          <button
           type="button"
           onClick={() => setShowMatchesSheet(true)}
           className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs shadow-lg shadow-amber-950/40 hover:opacity-95 transition-all active:scale-95"
          >
           View Matches ({currentRoom?.matches?.length || 0}) 
          </button>
          <button
           type="button"
           onClick={() => setShowShareModal(true)}
           className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs border border-zinc-800 transition-all flex items-center gap-1.5 active:scale-95"
          >
           <Share2 className="w-3.5 h-3.5 text-rose-400" />
           <span>Invite More Friends</span>
          </button>
         </div>
        </div>
       )}
      </div>
     )}
    </div>

    {/* ========================================================================= */}
    {/* MATCH CELEBRATION OVERLAY                         */}
    {/* ========================================================================= */}
    {activeMatchOverlay && (
     <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-orange-500 flex items-center justify-center text-3xl shadow-xl shadow-rose-950/80 animate-bounce mb-3">
       
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">
       Mutual Selection
      </span>
      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
       IT'S A MATCH!
      </h2>
      <p className="text-xs text-zinc-300 mt-1 max-w-xs">
       Agreed upon by <strong className="text-amber-300">{activeMatchOverlay.liked_by?.join(' & ') || 'your group'}</strong>
      </p>

      {/* Matched Movie Card Preview */}
      <div className="flex items-center gap-3 bg-zinc-900/90 border border-amber-500/40 p-3 rounded-2xl max-w-sm w-full my-4 text-left shadow-xl">
       <img
        src={activeMatchOverlay.movie?.poster_url}
        alt={activeMatchOverlay.movie?.title}
        className="w-16 h-24 object-cover rounded-xl shrink-0"
       />
       <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-white truncate">{activeMatchOverlay.movie?.title}</h4>
        <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 font-mono">
         <span>{activeMatchOverlay.movie?.year}</span>
         {activeMatchOverlay.movie?.imdb_rating && (
          <span className="text-amber-400">★ {activeMatchOverlay.movie.imdb_rating}</span>
         )}
         {activeMatchOverlay.movie?.rotten_tomatoes && (
          <span className="text-rose-400">🍅 {activeMatchOverlay.movie.rotten_tomatoes}</span>
         )}
        </div>
        {activeMatchOverlay.movie?.overview && (
         <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
          {activeMatchOverlay.movie.overview}
         </p>
        )}
       </div>
      </div>

      <div className="flex flex-col gap-2.5 w-full max-w-xs">
       <button
        type="button"
        onClick={() => {
         if (onStartWatchParty && activeMatchOverlay.movie) {
          onStartWatchParty(activeMatchOverlay.movie, currentRoom?.code);
         }
         setActiveMatchOverlay(null);
        }}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-rose-600 to-purple-600 text-xs sm:text-sm font-bold text-white shadow-xl shadow-rose-950/60 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
       >
        <span className="text-base"></span>
        <span>Start Watch Party Now!</span>
       </button>

       <div className="flex items-center gap-2 w-full">
        <button
         onClick={() => {
          if (activeMatchOverlay.movie) {
           toggleWatchlist(activeMatchOverlay.movie);
           if (onShowToast) onShowToast({ message: `Saved "${activeMatchOverlay.movie.title}" to Watchlist` });
          }
          setActiveMatchOverlay(null);
         }}
         className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition-all"
        >
         Save 
        </button>
        <button
         onClick={() => setActiveMatchOverlay(null)}
         className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 text-xs font-bold text-white shadow-lg transition-all"
        >
         Keep Swiping 
        </button>
       </div>
      </div>

      <button
       type="button"
       onClick={() => {
        const title = activeMatchOverlay.movie?.title;
        const code = currentRoom?.code || '';
        const shareUrl = `${window.location.origin}/?room=${code}`;
        const text = ` We mutually matched on "${title}" in Movie Night on MovieRecommendation! Join our room (${code}) to pick what to watch: ${shareUrl}`;
        if (typeof navigator!== 'undefined' && navigator.share) {
         navigator.share({ title: `We matched on ${title}!`, text, url: shareUrl }).catch(() => {});
        } else {
         navigator.clipboard.writeText(text);
         if (onShowToast) onShowToast({ message: `Match link for "${title}" copied!` });
        }
       }}
       className="mt-2.5 text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
      >
       <Share2 className="w-3.5 h-3.5 text-amber-400" />
       <span>Share this Match!</span>
      </button>
     </div>
    )}

    {/* ========================================================================= */}
    {/* MATCHES DRAWER / SHEET                          */}
    {/* ========================================================================= */}
    {showMatchesSheet && (
     <div className="absolute inset-0 z-30 bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/60">
       <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-white">
         Group Matches ({currentRoom?.matches?.length || 0})
        </h3>
       </div>
       <button
        onClick={() => setShowMatchesSheet(false)}
        className="p-1 rounded-lg text-zinc-400 hover:text-white"
       >
        <X className="w-5 h-5" />
       </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-zinc-850">
       {(!currentRoom?.matches || currentRoom.matches.length === 0) ? (
        <div className="py-16 text-center space-y-2">
         <div className="text-3xl"></div>
         <h4 className="text-sm font-semibold text-zinc-300">No mutual matches yet</h4>
         <p className="text-xs text-zinc-500 max-w-xs mx-auto">
          Keep swiping! When everyone in your room likes the same title, it will appear right here.
         </p>
        </div>
       ) : (
        currentRoom.matches.map((match, idx) => (
         <div
          key={match.movie?.id || idx}
          className="pt-3 first:pt-0 flex items-center justify-between gap-3 group"
         >
          <div
           onClick={() => {
            setShowMatchesSheet(false);
            if (onSelectMovie && match.movie) {
             onSelectMovie(match.movie);
            }
           }}
           className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          >
           <img
            src={match.movie?.poster_url}
            alt={match.movie?.title}
            className="w-12 h-16 object-cover rounded-lg shrink-0 border border-zinc-800 group-hover:border-amber-500/50 transition-colors"
           />
           <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-amber-400 transition-colors truncate">
             {match.movie?.title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
             {match.movie?.year && <span>{match.movie.year}</span>}
             {match.movie?.rotten_tomatoes && (
              <span className="text-rose-400 font-mono text-[11px]">🍅 {match.movie.rotten_tomatoes}</span>
             )}
             {match.movie?.imdb_rating && (
              <span className="text-amber-400 font-mono text-[11px]">★ {match.movie.imdb_rating}</span>
             )}
            </div>
            <p className="text-[11px] text-emerald-400 mt-0.5 truncate">
             Liked by {match.liked_by?.join(', ') || 'everyone'}
            </p>
           </div>
          </div>

          <div className="flex items-center gap-1.5">
           <button
            type="button"
            onClick={() => {
             setShowMatchesSheet(false);
             if (onStartWatchParty && match.movie) {
              onStartWatchParty(match.movie, currentRoom?.code);
             }
            }}
            className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-semibold shadow flex items-center gap-1 transition-all active:scale-95"
            title="Start Watch Party "
           >
            <span></span>
            <span className="hidden sm:inline">Watch Party</span>
           </button>

           <button
            onClick={() => {
             if (match.movie) {
              toggleWatchlist(match.movie);
              if (onShowToast) onShowToast({ message: `Saved "${match.movie.title}" to Watchlist` });
             }
            }}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 hover:bg-zinc-800 transition-colors"
            title="Save to Watchlist"
           >
            <Bookmark className="w-4 h-4 fill-amber-400" />
           </button>
          </div>
         </div>
        ))
       )}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/40">
       <button
        onClick={() => setShowMatchesSheet(false)}
        className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
       >
        Back to Swiping
       </button>
      </div>
     </div>
    )}

    {/* ========================================================================= */}
    {/* SHARE & PROMOTE MODAL / SHEET                       */}
    {/* ========================================================================= */}
    {showShareModal && (
     <div className="absolute inset-0 z-35 bg-zinc-950/95 backdrop-blur-xl flex flex-col animate-in zoom-in-95 duration-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/70 sticky top-0 z-10 backdrop-blur-md">
       <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-500 flex items-center justify-center text-white text-sm shadow-md shadow-rose-950/40 shrink-0">
         <Share2 className="w-4 h-4" />
        </div>
        <div>
         <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
          Invite & Promote Room
         </h3>
         <p className="text-[11px] text-zinc-400">
          Share your room code so friends & followers can join and match
         </p>
        </div>
       </div>
       <button
        type="button"
        onClick={() => setShowShareModal(false)}
        className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Close"
       >
        <X className="w-5 h-5" />
       </button>
      </div>

      <div className="p-4 sm:p-5 space-y-5 flex-1">
       {/* Room Code Showcase Card */}
       <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-900/80 to-zinc-950 border border-zinc-800 text-center space-y-3 shadow-xl">
        <div className="flex items-center justify-center gap-2">
         <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Room Active
         </span>
         <span className="text-xs text-zinc-400 font-medium">
          {currentRoom?.name || 'Group Swiping Session'}
         </span>
        </div>

        <div className="space-y-1">
         <div className="text-[10px] uppercase font-mono font-bold tracking-widest text-zinc-400">
          Room Code
         </div>
         <div
          onClick={handleCopyCode}
          className="cursor-pointer inline-flex items-center justify-center gap-2.5 text-3xl sm:text-4xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-rose-400 hover:scale-105 transition-transform"
          title="Click to copy code"
         >
          <span>{currentRoom?.code}</span>
          <button
           type="button"
           className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/90 border border-zinc-700 text-xs shadow-sm"
          >
           {copiedShareCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
         </div>
         <p className="text-[11px] text-zinc-500">
          Friends can enter this code in the "Join with Code" tab
         </p>
        </div>

        {/* Direct Link Bar */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800/90 max-w-md mx-auto shadow-inner">
         <div className="flex-1 px-2.5 py-1 text-left font-mono text-xs text-zinc-300 truncate select-all">
          {window.location.origin}/?room={currentRoom?.code}
         </div>
         <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0 transition-colors shadow-md active:scale-95"
         >
          {copiedLink ? (
           <>
            <Check className="w-3.5 h-3.5" />
            <span>Copied!</span>
           </>
          ) : (
           <>
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Link</span>
           </>
          )}
         </button>
        </div>
       </div>

       {/* Social Media Share / Promote Grid */}
       <div className="space-y-3">
        <div className="flex items-center justify-between">
         <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span>Promote & Share on Social Media</span>
         </h4>
         <span className="text-[10px] text-zinc-500">1-Tap Share</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
         {/* TikTok Button */}
         <button
          type="button"
          onClick={handleShareTikTok}
          className="flex flex-col p-3 rounded-xl bg-black border border-zinc-800 hover:border-cyan-400/80 hover:shadow-[0_0_15px_rgba(37,244,238,0.2)] text-left transition-all active:scale-[0.98] group"
         >
          <div className="flex items-center justify-between mb-1.5">
           <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white group-hover:text-cyan-400 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
             <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.88 2.89 2.89 0 0 1-2.89-2.88 2.89 2.89 0 0 1 2.89-2.89c.31 0.61.05.89.14v-3.5a6.37 6.37 0 0 0-.89-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.41a8.16 8.16 0 0 0 3.76.92V6.69z"/>
            </svg>
           </div>
           <span className="text-[10px] font-mono text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform">Copy & Open ↗</span>
          </div>
          <span className="text-xs font-bold text-white">TikTok</span>
          <span className="text-[10px] text-zinc-400">Copy caption & hashtags</span>
         </button>

         {/* Instagram Button */}
         <button
          type="button"
          onClick={handleShareInstagram}
          className="flex flex-col p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-pink-500/70 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)] text-left transition-all active:scale-[0.98] group"
         >
          <div className="flex items-center justify-between mb-1.5">
           <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
             <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
           </div>
           <span className="text-[10px] font-mono text-rose-400 font-semibold group-hover:translate-x-0.5 transition-transform">Story / DM ↗</span>
          </div>
          <span className="text-xs font-bold text-white">Instagram</span>
          <span className="text-[10px] text-zinc-400">Copy link for Story or DM</span>
         </button>

         {/* Facebook Button */}
         <button
          type="button"
          onClick={handleShareFacebook}
          className="flex flex-col p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#1877F2]/80 hover:shadow-[0_0_15px_rgba(24,119,242,0.2)] text-left transition-all active:scale-[0.98] group"
         >
          <div className="flex items-center justify-between mb-1.5">
           <div className="w-7 h-7 rounded-lg bg-[#1877F2] flex items-center justify-center text-white">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
             <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
           </div>
           <span className="text-[10px] font-mono text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform">Post ↗</span>
          </div>
          <span className="text-xs font-bold text-white">Facebook</span>
          <span className="text-[10px] text-zinc-400">Share to feed & groups</span>
         </button>

         {/* LinkedIn Button */}
         <button
          type="button"
          onClick={handleShareLinkedIn}
          className="flex flex-col p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#0A66C2]/80 hover:shadow-[0_0_15px_rgba(10,102,194,0.2)] text-left transition-all active:scale-[0.98] group"
         >
          <div className="flex items-center justify-between mb-1.5">
           <div className="w-7 h-7 rounded-lg bg-[#0A66C2] flex items-center justify-center text-white">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
             <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
            </svg>
           </div>
           <span className="text-[10px] font-mono text-sky-400 font-semibold group-hover:translate-x-0.5 transition-transform">Share ↗</span>
          </div>
          <span className="text-xs font-bold text-white">LinkedIn</span>
          <span className="text-[10px] text-zinc-400">Share with connections</span>
         </button>
        </div>

        {/* More Apps / Native Share Button */}
        {typeof navigator!== 'undefined' && navigator.share && (
         <button
          type="button"
          onClick={handleNativeShare}
          className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
         >
          <Share2 className="w-3.5 h-3.5 text-rose-400" />
          <span>More Sharing Apps (WhatsApp, Messages, AirDrop)</span>
         </button>
        )}
       </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/70 sticky bottom-0 z-10 flex items-center gap-3 backdrop-blur-md">
       <button
        type="button"
        onClick={() => setShowShareModal(false)}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-sm shadow-lg shadow-rose-950/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
       >
        <span>Start Swiping with Friends </span>
        <ChevronRight className="w-4 h-4" />
       </button>
      </div>
     </div>
    )}

   </div>
  </div>
 );
}
