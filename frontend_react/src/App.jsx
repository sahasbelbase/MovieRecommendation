import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import api from './api/client';
import Navbar from './components/Navbar';
import MovieCard from './components/MovieCard';
import MovieModal from './components/MovieModal';
import ActorModal from './components/ActorModal';
import WatchedDrawer from './components/WatchedDrawer';
import DataModal from './components/DataModal';
import AuthModal from './components/AuthModal';
import Toast from './components/Toast';
import SwipeDeckModal from './components/SwipeDeckModal';
import WatchlistShelf from './components/WatchlistShelf';
import Top250Modal from './components/Top250Modal';
import MovieNightModal from './components/MovieNightModal';
import WatchPartyModal, { StandaloneChatCompanion } from './components/WatchPartyModal';
import Footer from './components/Footer';
import { touchUserLastUsed, setUserVipInCloud, checkUserVipInCloud } from './services/userService';
import { RefreshCw, Film, ChevronRight, Tv, Sparkles, Flame, Github, Linkedin, Trophy, Bookmark, Users, Play } from 'lucide-react';

const MEDIA_CATEGORIES = [
 { id: "all", label: "Discover", shortLabel: "Discover" },
 { id: "trending", label: "Trending Now 🔥", shortLabel: "Trending" },
 { id: "movie", label: "Movies", shortLabel: "Movies" },
 { id: "tv", label: "TV Series", shortLabel: "TV" },
 { id: "anime", label: "Anime", shortLabel: "Anime" }
];

const GENRES = [
 "All", "Action", "Drama", "Crime", "Sci-Fi", "Comedy", "Thriller", "Romance", "Animation", "Horror", "Mystery"
];

export function formatTimeAgo(dateString) {
  if (!dateString) return null;
  const iso = dateString.replace(' ', 'T') + (dateString.includes('Z') ? '' : 'Z');
  const past = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export default function App() {
 const { user, loading: authLoading, watchedMovies, watchlistMovies, notInterestedMovies, toggleWatched, toggleWatchlist } = useAuth();

 const [feed, setFeed] = useState(null);
 const [loading, setLoading] = useState(true);
 const [slowNotice, setSlowNotice] = useState(false);
 const [selectedMovie, setSelectedMovie] = useState(null);
 const [autoPlayStream, setAutoPlayStream] = useState(false);
 const [selectedActor, setSelectedActor] = useState(null);
 const [isWatchedOpen, setIsWatchedOpen] = useState(false);
 const [libraryTab, setLibraryTab] = useState('watched');
 const [isWatchlistShelfOpen, setIsWatchlistShelfOpen] = useState(false);
 const [isDataOpen, setIsDataOpen] = useState(false);
 const [isAuthOpen, setIsAuthOpen] = useState(false);
 const [isSwipeOpen, setIsSwipeOpen] = useState(false);
 const [isTop250Open, setIsTop250Open] = useState(false);
 const [isVip, setIsVip] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('vip_activated') === 'true';
 });

 const handleActivateVip = async () => {
  if (user?.uid) {
    const vipCheck = await checkUserVipInCloud(user.uid);
    if (vipCheck.exists && (vipCheck.isBlocked || vipCheck.isVip === false)) {
      alert('VIP Access has been revoked for this account by administrator.');
      handleDeactivateVip();
      return false;
    }
    await setUserVipInCloud(user.uid, true);
  }
  localStorage.setItem('vip_activated', 'true');
  setIsVip(true);
  return true;
 };

 const handleDeactivateVip = async () => {
  if (user?.uid) {
    await setUserVipInCloud(user.uid, false);
  }
  localStorage.removeItem('vip_activated');
  setIsVip(false);
 };

 // Listen for VIP state events and synchronize with Firebase table
 useEffect(() => {
  const onVipRevoked = () => {
    setIsVip(false);
  };
  const onVipGranted = () => {
    setIsVip(true);
  };
  window.addEventListener('cinematch_vip_revoked', onVipRevoked);
  window.addEventListener('cinematch_vip_granted', onVipGranted);

  return () => {
    window.removeEventListener('cinematch_vip_revoked', onVipRevoked);
    window.removeEventListener('cinematch_vip_granted', onVipGranted);
  };
 }, []);

 // Periodically update user's last_used_date and verify VIP status against Firebase
 useEffect(() => {
  if (!user?.uid) return;

  // Touch user activity on initial mount/login
  touchUserLastUsed(user.uid);

  const interval = setInterval(async () => {
    touchUserLastUsed(user.uid);
    const vipCheck = await checkUserVipInCloud(user.uid);
    if (vipCheck.exists) {
      if (vipCheck.isBlocked || vipCheck.isVip === false) {
        setIsVip(false);
        localStorage.removeItem('vip_activated');
      } else if (vipCheck.isVip) {
        setIsVip(true);
        localStorage.setItem('vip_activated', 'true');
      }
    } else if (localStorage.getItem('vip_activated') === 'true') {
      // Document was deleted by administrator in Firebase table!
      setIsVip(false);
      localStorage.removeItem('vip_activated');
    }
  }, 2 * 60 * 1000); // Check every 2 minutes

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      touchUserLastUsed(user.uid);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
 }, [user?.uid]);

 const [initialRoomCode, setInitialRoomCode] = useState(() => {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('room') || '').toUpperCase();
 });
 const [isMovieNightOpen, setIsMovieNightOpen] = useState(() => {
  if (typeof window === 'undefined') return false;
  return Boolean(new URLSearchParams(window.location.search).get('room'));
 });
 const [watchPartyData, setWatchPartyData] = useState(() => {
  if (typeof window === 'undefined') {
   return { isOpen: false, roomCode: '', movie: null, videoSource: null };
  }
  const params = new URLSearchParams(window.location.search);
  const code = params.get('party') || params.get('theater');
  return {
   isOpen: Boolean(code),
   roomCode: code ? code.toUpperCase() : '',
   movie: null,
   videoSource: null,
  };
 });
 const [pendingPartyCode, setPendingPartyCode] = useState(null);

 const handleStartWatchParty = (movie, roomCode = null) => {
  const code = roomCode || Math.random().toString(36).substring(2, 6).toUpperCase();
  setWatchPartyData({
   isOpen: true,
   roomCode: code,
   movie: movie || null,
   videoSource: null,
  });
  if (!user) {
   setPendingPartyCode({ code, movie });
   showToast({ message: 'Please sign in to join or host a Watch Party ' });
   return;
  }
 };

  // Deep-link listener for Android TV Home Screen Widget & Notifications
  useEffect(() => {
   const handleOpenMovieEvent = async (e) => {
    const movieId = e?.detail?.movieId;
    if (!movieId) return;
    try {
     const res = await api.get(`/movies/${movieId}/details?media_type=movie`);
     setSelectedMovie(res.data);
     setAutoPlayStream(true);
    } catch (err) {
     console.warn("Failed fetching deep-linked movie:", err);
     setSelectedMovie({ id: movieId, title: "Media Item " + movieId });
     setAutoPlayStream(true);
    }
   };

   window.addEventListener('cinematch:open_movie', handleOpenMovieEvent);
   return () => window.removeEventListener('cinematch:open_movie', handleOpenMovieEvent);
  }, []);

 // Resume pending watch party after user signs in
 useEffect(() => {
  if (user && pendingPartyCode) {
   setWatchPartyData({
    isOpen: true,
    roomCode: pendingPartyCode.code,
    movie: pendingPartyCode.movie || null,
    videoSource: null,
   });
   setPendingPartyCode(null);
  }
 }, [user, pendingPartyCode]);
 const [toast, setToast] = useState(null);
 const [selectedMediaCategory, setSelectedMediaCategory] = useState("all");
 const [selectedGenre, setSelectedGenre] = useState("All");
 const [trendingSubFilter, setTrendingSubFilter] = useState('all'); // 'all' | 'movie' | 'tv'
 const [recentAnime, setRecentAnime] = useState([]);
 const [loadingRecentAnime, setLoadingRecentAnime] = useState(false);

 // Fetch real-time recent anime episodes when viewing the Anime category
 useEffect(() => {
  if (selectedMediaCategory !== 'anime') return;
  let isMounted = true;
  setLoadingRecentAnime(true);
  api.get('/movies/anime/anikoto/recent?page=1&per_page=24')
   .then((res) => {
    if (isMounted && res.data?.data) {
     setRecentAnime(res.data.data);
    }
   })
   .catch((err) => {
    console.warn('Failed fetching Anikoto recent anime:', err);
   })
   .finally(() => {
    if (isMounted) setLoadingRecentAnime(false);
   });
  return () => {
   isMounted = false;
  };
 }, [selectedMediaCategory]);

 // Efficient lookup set of all excluded IDs (watched watchlist not interested)
 const excludedIds = useMemo(() => {
  const ids = new Set();
  (watchedMovies || []).forEach(m => ids.add(Number(m.id)));
  (watchlistMovies || []).forEach(m => ids.add(Number(m.id)));
  (notInterestedMovies || []).forEach(m => ids.add(Number(m.id)));
  return ids;
 }, [watchedMovies, watchlistMovies, notInterestedMovies]);

 // Show cold-start wake-up message if request takes longer than 2.5s (free-tier spinup)
 useEffect(() => {
  let timer;
  if (loading) {
   timer = setTimeout(() => {
    setSlowNotice(true);
   }, 2500);
  } else {
   setSlowNotice(false);
  }
  return () => clearTimeout(timer);
 }, [loading]);

 const handleOpenLibrary = (tab = 'watched') => {
  setLibraryTab(tab);
  setIsWatchedOpen(true);
 };

 // Fetch recommendation feed whenever user state, media category, or genre changes
 const loadFeed = async () => {
  setLoading(true);
  try {
   const genreParam = selectedGenre && selectedGenre!== "All" ? `&genre=${encodeURIComponent(selectedGenre)}` : '';
   const url = `/recommendations/feed?media_type=${selectedMediaCategory}${genreParam}`;
   const res = await api.get(url);
   setFeed(res.data);
  } catch (err) {
   console.error("Failed to load recommendation feed:", err);
  } finally {
   setLoading(false);
  }
 };

 useEffect(() => {
  loadFeed();
 }, [user, selectedMediaCategory, selectedGenre]);

 // Auto-open taste calibration swipe deck when user logs in for the first time (skip if joining party/room)
 useEffect(() => {
  if (user?.uid) {
   const params = new URLSearchParams(window.location.search);
   const isDirectInvite = params.get('party') || params.get('theater') || params.get('room');
   if (isDirectInvite || pendingPartyCode || watchPartyData.isOpen || isMovieNightOpen) {
    return;
   }
   const onboardingKey = `has_seen_calibration_${user.uid}`;
   const hasSeen = localStorage.getItem(onboardingKey);
   if (!hasSeen) {
    setIsSwipeOpen(true);
    localStorage.setItem(onboardingKey, 'true');
   }
  }
 }, [user?.uid, pendingPartyCode, watchPartyData.isOpen, isMovieNightOpen]);

 // Handle direct share link: ?room=CODE or ?party=CODE
 useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  const partyParam = params.get('party') || params.get('theater');
  if (partyParam) {
   const code = partyParam.toUpperCase();
   setWatchPartyData((prev) => ({
    ...prev,
    isOpen: true,
    roomCode: code,
   }));
  } else if (roomParam) {
   setInitialRoomCode(roomParam.toUpperCase());
   setIsMovieNightOpen(true);
  }
 }, []);

 // Toast helper
 const showToast = (toastObj) => {
  setToast(toastObj);
  setTimeout(() => {
   setToast(null);
  }, 4000);
 };

 const isCompanionView = typeof window!== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'chat';
 const companionRoom = typeof window!== 'undefined' && (new URLSearchParams(window.location.search).get('party') || new URLSearchParams(window.location.search).get('theater'));

 if (isCompanionView && companionRoom) {
  return <StandaloneChatCompanion roomCode={companionRoom.toUpperCase()} />;
 }

 return (
  <div className="min-h-screen bg-canvas text-zinc-100 flex flex-col md:flex-row font-sans">
   {/* Navigation */}
   <Navbar
    isVip={isVip}
    onVipActivated={handleActivateVip}
    onVipDeactivated={handleDeactivateVip}
    selectedCategory={selectedMediaCategory}
    onSelectCategory={(cat) => setSelectedMediaCategory(cat)}
    onSelectMovie={(m, autoPlay = false) => {
     setSelectedMovie(m);
     setAutoPlayStream(Boolean(autoPlay));
    }}
    onSelectActor={(a) => setSelectedActor(a)}
    onOpenWatched={(tab) => handleOpenLibrary(tab || 'watched')}
    onOpenDataModal={() => setIsDataOpen(true)}
    onOpenAuthModal={() => setIsAuthOpen(true)}
    onOpenSwipe={() => setIsSwipeOpen(true)}
    onToggleWatchlistShelf={() => setIsWatchlistShelfOpen(prev => !prev)}
    onOpenTop250={() => setIsTop250Open(true)}
    onOpenMovieNight={() => setIsMovieNightOpen(true)}
    onStartWatchParty={(m) => handleStartWatchParty(m)}
   />

   {/* Content Area */}
   <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden">
     {/* Watchlist Shelf (Hidden for signed-out users) */}
     {user && (
      <WatchlistShelf
       isExpanded={isWatchlistShelfOpen}
       onToggleExpand={() => setIsWatchlistShelfOpen(prev => !prev)}
       onSelectMovie={(m) => setSelectedMovie(m)}
       onOpenDrawer={(tab) => handleOpenLibrary(tab || 'watchlist')}
       onShowToast={showToast}
      />
     )}

    {/* Main Container */}
    <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-8 space-y-6 sm:space-y-8">
     {/* Onboarding Taste Calibration Banner for Signed-In Users */}
     {user && watchedMovies.length < 5 && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/60 via-zinc-900 to-zinc-900 border border-rose-800/40 gap-3.5 sm:gap-4 shadow-xl">
       <div className="space-y-1">
        <div className="flex items-center gap-2">
         <span className="text-xl"></span>
         <h2 className="text-sm sm:text-base font-bold text-white">
          Calibrate Your For You Page ({watchedMovies.length}/5 titles rated)
         </h2>
         <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
          Swipe Mode
         </span>
        </div>
        <p className="text-xs text-zinc-300">
         Swipe right on titles you've watched, or swipe left to skip. Unwatched titles are tracked so they won't repeat!
        </p>
       </div>
       <button
        onClick={() => setIsSwipeOpen(true)}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-xs font-semibold text-white shadow-lg shadow-rose-950/50 transition-all self-stretch sm:self-auto active:scale-95"
       >
        Open Swipe Mode
        <ChevronRight className="w-4 h-4" />
       </button>
      </div>
     )}

     {/* Banner: Guest invitation vs Authenticated summary */}
     {user ? (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-surface border border-border-subtle gap-3.5 sm:gap-4">
       <div className="space-y-1">
        <div className="flex items-center gap-2">
         <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
          Welcome back, {user.displayName}
         </h1>
         <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Tailored Mode
         </span>
        </div>
        <p className="text-xs text-zinc-400">
         Your recommendation engine has analyzed your taste across movies, TV shows, and anime and strictly excluded your{' '}
         <strong className="text-zinc-200">{watchedMovies.length} watched titles</strong>.
        </p>
       </div>
       <div className="grid grid-cols-2 xs:flex xs:items-center gap-2 w-full xs:w-auto">
        <button
         onClick={() => setIsMovieNightOpen(true)}
         className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/20 hover:from-amber-500/25 hover:to-orange-500/30 text-xs font-semibold text-amber-300 border border-amber-500/40 transition-all active:scale-95"
        >
         <span> Movie Night</span>
        </button>
        <button
         onClick={() => setIsSwipeOpen(true)}
         className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600/20 to-orange-600/20 hover:from-rose-600/30 hover:to-orange-600/30 text-xs font-semibold text-rose-300 border border-rose-500/40 transition-all active:scale-95"
        >
         <span> Swipe FYP</span>
        </button>
        <button
         onClick={loadFeed}
         className="col-span-2 xs:col-span-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-all active:scale-95"
        >
         <RefreshCw className="w-3.5 h-3.5" />
         Refresh
        </button>
       </div>
      </div>
     ) : (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 gap-3.5 sm:gap-4">
       <div className="space-y-1">
        <div className="flex items-center gap-2">
         <h1 className="text-base sm:text-lg font-bold text-white">Movies, TV Series & Anime Discovery</h1>
         <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          Guest Mode
         </span>
        </div>
        <p className="text-xs text-zinc-400">
         Sign in to save your watched history permanently and unlock a tailored taste profile across all media.
        </p>
       </div>
       <div className="grid grid-cols-2 xs:flex xs:items-center gap-2 w-full xs:w-auto">
        <button
         onClick={() => setIsMovieNightOpen(true)}
         className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/20 hover:from-amber-500/25 hover:to-orange-500/30 text-xs font-semibold text-amber-300 border border-amber-500/40 transition-all active:scale-95"
        >
         <span> Movie Night</span>
        </button>
        <button
         onClick={() => setIsAuthOpen(true)}
         className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-950/40 transition-all active:scale-95"
        >
         <span>Sign In</span>
         <ChevronRight className="w-4 h-4" />
        </button>
       </div>
      </div>
     )}

     {/* Your Watchlist - Card Carousel View Below Main Picture/Banner */}
     {watchlistMovies && watchlistMovies.length > 0 && (
      <section className="space-y-3 p-4 sm:p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
         <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Bookmark className="w-4 h-4 fill-amber-400" />
         </div>
         <div>
          <div className="flex items-center gap-2">
           <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Your Watchlist</h2>
           <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {watchlistMovies.length} saved
           </span>
          </div>
          <p className="text-xs text-zinc-400 hidden sm:block">Titles queued for later — ready to watch</p>
         </div>
        </div>
        <button
         onClick={() => handleOpenLibrary('watchlist')}
         className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
        >
         View in Drawer →
        </button>
       </div>
       <div className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar snap-x snap-mandatory -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
         {watchlistMovies.map((movie) => (
          <div key={`watchlist_card_${movie.id}`} className="w-32 sm:w-44 shrink-0 snap-start">
           <MovieCard
            movie={movie}
            onSelect={(m, autoPlay = false) => {
             setSelectedMovie(m);
             setAutoPlayStream(Boolean(autoPlay));
            }}
            onShowToast={showToast}
            isVip={isVip}
           />
          </div>
         ))}
       </div>
      </section>
     )}

     {/* Media Category Switcher Tabs & Top 250 Launcher */}
     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-zinc-800/80 pb-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
       <div className="flex items-center gap-1 xs:gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shrink-0">
        {MEDIA_CATEGORIES.map((cat) => (
         <button
          key={cat.id}
          onClick={() => setSelectedMediaCategory(cat.id)}
          className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
           selectedMediaCategory === cat.id
            ? 'bg-zinc-800 text-white shadow font-semibold'
            : 'text-zinc-400 hover:text-zinc-200'
          }`}
         >
          <span className="xs:hidden">{cat.shortLabel || cat.label}</span>
          <span className="hidden xs:inline">{cat.label}</span>
         </button>
        ))}
       </div>

       <button
        onClick={() => setIsTop250Open(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:border-amber-500/60 hover:from-amber-500/25 hover:to-orange-500/30 transition-all shadow-sm active:scale-95 shrink-0"
        title="Explore Top 250 Movies, TV Series & Anime of All Time"
       >
        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="hidden xs:inline">Top 250 All-Time</span>
        <span className="xs:hidden">Top 250</span>
       </button>
      </div>

      {/* Genre Filter Chips */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
       {GENRES.map((genre) => (
        <button
         key={genre}
         onClick={() => setSelectedGenre(genre)}
         className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
          selectedGenre === genre
           ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 font-semibold'
           : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
         }`}
        >
         {genre}
        </button>
       ))}
      </div>
     </div>

     {/* Trending Now Mode Header & Sub-filter Switcher (All Trending, Movies Only, TV Series Only) */}
     {selectedMediaCategory === 'trending' && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-950/40 via-zinc-900 to-zinc-900 border border-orange-800/40 gap-3.5 shadow-xl">
       <div className="space-y-1">
        <div className="flex items-center gap-2">
         <Flame className="w-5 h-5 text-orange-400" />
         <h1 className="text-base sm:text-lg font-bold text-white">Trending Now Worldwide</h1>
         <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
          Live Buzz
         </span>
        </div>
        <p className="text-xs text-zinc-400">
         The most watched movies and viral TV shows dominating screens worldwide today.
        </p>
       </div>
       <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shrink-0 self-start sm:self-auto">
        <button
         onClick={() => setTrendingSubFilter('all')}
         className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          trendingSubFilter === 'all'
           ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow font-semibold'
           : 'text-zinc-400 hover:text-zinc-200'
         }`}
        >
         🔥 All Trending
        </button>
        <button
         onClick={() => setTrendingSubFilter('movie')}
         className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          trendingSubFilter === 'movie'
           ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow font-semibold'
           : 'text-zinc-400 hover:text-zinc-200'
         }`}
        >
         🎬 Movies Only
        </button>
        <button
         onClick={() => setTrendingSubFilter('tv')}
         className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          trendingSubFilter === 'tv'
           ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow font-semibold'
           : 'text-zinc-400 hover:text-zinc-200'
         }`}
        >
         📺 TV Series Only
        </button>
       </div>
      </div>
     )}

     {/* Anime Just Released Episodes Rail (VIP Mode Only) */}
     {selectedMediaCategory === 'anime' && isVip && recentAnime.length > 0 && (
      <section className="space-y-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-zinc-900 border border-indigo-800/40 shadow-xl">
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
         <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          <Sparkles className="w-4 h-4 text-indigo-400" />
         </div>
         <div>
          <div className="flex items-center gap-2">
           <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">⚡ Just Released Episodes</h2>
           <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Live Updates
           </span>
          </div>
          <p className="text-xs text-zinc-400 hidden sm:block">
           Freshly broadcast episodes updated live — click any title to watch the latest episode instantly
          </p>
         </div>
        </div>
       </div>

       {/* Horizontal Carousel */}
       <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar snap-x snap-mandatory -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        {recentAnime.map((item) => {
         const timeAgo = formatTimeAgo(item.updated_at);
         const epNum = item.is_sub || item.is_dub || 1;
         const isDub = Boolean(item.is_dub);
         const isSub = Boolean(item.is_sub);

         const animeMovieObj = {
          id: item.s_id || `anikoto_${item.id}`,
          anikoto_id: item.id,
          title: item.title,
          name: item.title,
          poster_path: item.poster,
          poster: item.poster,
          backdrop_path: item.background_image || item.poster,
          overview: item.description,
          media_type: 'anime',
          is_series: !item.terms_by_type?.type?.includes('Movie'),
          latest_episode: epNum,
          target_episode: epNum,
          latest_episode_updated_at: item.updated_at,
          score: item.score,
          vote_average: item.score ? parseFloat(item.score) : 8.0,
          release_date: item.aired || item.year,
          genres: item.terms_by_type?.genre || ['Animation', 'Action']
         };

         return (
          <div
           key={`recent_anime_${item.id}`}
           onClick={() => {
            setSelectedMovie(animeMovieObj);
            setAutoPlayStream(false);
           }}
           className="group relative w-36 sm:w-44 shrink-0 snap-start cursor-pointer rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-indigo-500/60 overflow-hidden shadow-lg transition-all duration-300 hover:scale-[1.03] hover:shadow-indigo-950/40"
          >
           {/* Poster Image */}
           <div className="aspect-[2/3] relative w-full overflow-hidden bg-zinc-950">
            <img
             src={item.poster}
             alt={item.title}
             loading="lazy"
             className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />

            {/* Episode Pill */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
             <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-600/90 text-white shadow-md backdrop-blur-sm border border-indigo-400/30">
              EP {epNum}
             </span>
             {isSub && !isDub && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-zinc-900/80 text-zinc-300 border border-zinc-700">
               SUB
              </span>
             )}
             {isDub && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/90 text-black border border-amber-300">
               DUB
              </span>
             )}
            </div>

            {/* Relative Time Badge */}
            {timeAgo && (
             <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-zinc-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {timeAgo}
             </div>
            )}

            {/* Quick Play Hover Icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
             <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-950/60 scale-90 group-hover:scale-100 transition-transform">
              <Play className="w-5 h-5 fill-current ml-0.5" />
             </div>
            </div>
           </div>

           {/* Anime Card Title & Info */}
           <div className="p-2.5 space-y-1">
            <h3 className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors" title={item.title}>
             {item.title}
            </h3>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
             <span>{item.score ? `★ ${item.score}` : 'Anime'}</span>
             <span className="text-emerald-400 font-medium">{timeAgo || 'New'}</span>
            </div>
           </div>
          </div>
         );
        })}
       </div>
      </section>
     )}

     {/* Dynamic Recommendation Sections */}
     {loading ? (
      <div className="space-y-6">
       {slowNotice && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs animate-in fade-in duration-300">
         <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
         <p>
          <strong className="font-semibold text-amber-300">Waking up API engine:</strong> Free hosting spins down when idle. Initial wake-up takes ~30 seconds, then subsequent browsing and queries will be lightning fast!
         </p>
        </div>
       )}
       <div className="space-y-10">
        {[1, 2, 3].map((row) => (
         <div key={row} className="space-y-4">
          <div className="h-6 w-48 bg-zinc-800/60 rounded-md animate-pulse" />
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
           {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[2/3] bg-zinc-800/40 rounded-xl animate-pulse" />
           ))}
          </div>
         </div>
        ))}
       </div>
      </div>
      ) : (() => {
       const validSections = (feed?.sections || []).map((section) => {
        const movies = (section.movies || []).filter((m) => {
         if (excludedIds.has(Number(m.id))) {
          return false;
         }
         if (selectedMediaCategory === "trending") {
          const mType = m.media_type || "movie";
          if (trendingSubFilter === "movie" && mType !== "movie") return false;
          if (trendingSubFilter === "tv" && mType !== "tv" && mType !== "kdrama") return false;
         } else if (selectedMediaCategory !== "all") {
          const mType = m.media_type || "movie";
          if (selectedMediaCategory === "anime" && mType !== "anime") return false;
          if (selectedMediaCategory === "tv" && mType !== "tv" && mType !== "kdrama") return false;
          if (selectedMediaCategory === "movie" && mType !== "movie") return false;
         }
         if (selectedGenre !== "All") {
          if (section.title?.toLowerCase().includes(selectedGenre.toLowerCase())) {
           return true;
          }
          if (m.genres && m.genres.length > 0) {
           return m.genres.some((g) =>
            g.toLowerCase().includes(selectedGenre.toLowerCase()) ||
            selectedGenre.toLowerCase().includes(g.toLowerCase())
           );
          }
          return true;
         }
         return true;
        });
        return { ...section, movies };
       }).filter(s => s.movies && s.movies.length > 0);

       if (validSections.length === 0) {
        return (
         <div className="h-64 flex flex-col items-center justify-center text-center space-y-3 px-4">
          <Film className="w-10 h-10 text-zinc-600 stroke-1" />
          <p className="text-sm font-medium text-zinc-300">No unwatched titles found for this category.</p>
          <p className="text-xs text-zinc-500 max-w-sm">You are a true cinema master! Try switching categories or clearing filters to discover more.</p>
         </div>
        );
       }

       return validSections.map((section, idx) => (
        <section key={idx} className="space-y-4">
         <div className="flex items-baseline justify-between">
          <div>
           <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
            {section.title}
           </h2>
           {section.subtitle && (
            <p className="text-xs text-zinc-400 mt-0.5">{section.subtitle}</p>
           )}
          </div>
         </div>

         {/* Media Grid */}
         <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
          {section.movies.map((movie) => (
           <MovieCard
            key={`${movie.media_type || 'movie'}_${movie.id}`}
            movie={movie}
            onSelect={(m, autoPlay = false) => {
             setSelectedMovie(m);
             setAutoPlayStream(Boolean(autoPlay));
            }}
            onShowToast={showToast}
            isVip={isVip}
           />
          ))}
         </div>
        </section>
       ));
      })()}
     </main>

    {/* Interactive Social Footer */}
    <Footer
     onShowToast={showToast}
     onStartWatchParty={(m) => handleStartWatchParty(m)}
     onOpenMovieNight={() => setIsMovieNightOpen(true)}
    />
   </div>

   {/* Modals and Overlays */}
   {selectedMovie && (
    <MovieModal
     isVip={isVip}
     onActivateVip={handleActivateVip}
     onDeactivateVip={handleDeactivateVip}
     movie={selectedMovie}
     autoPlayStream={autoPlayStream}
     onClose={() => {
      setSelectedMovie(null);
      setAutoPlayStream(false);
     }}
     onSelectMovie={(m, autoPlay = false) => {
      setSelectedMovie(m);
      setAutoPlayStream(Boolean(autoPlay));
     }}
     onSelectActor={(a) => setSelectedActor(a)}
     onShowToast={showToast}
     onStartWatchParty={(m) => handleStartWatchParty(m)}
     onRequireAuth={() => setIsAuthOpen(true)}
    />
   )}

   {selectedActor && (
    <ActorModal
     person={selectedActor}
     onClose={() => setSelectedActor(null)}
     onSelectMovie={(m) => setSelectedMovie(m)}
     onShowToast={showToast}
    />
   )}

   <WatchedDrawer
    isOpen={isWatchedOpen}
    onClose={() => setIsWatchedOpen(false)}
    onSelectMovie={(m) => setSelectedMovie(m)}
    onOpenDataModal={() => setIsDataOpen(true)}
    initialTab={libraryTab}
   />

   <DataModal
    isOpen={isDataOpen}
    onClose={() => setIsDataOpen(false)}
    onShowToast={showToast}
   />

   <AuthModal
    isOpen={isAuthOpen}
    onClose={() => setIsAuthOpen(false)}
   />

   <SwipeDeckModal
    isOpen={isSwipeOpen}
    onClose={() => setIsSwipeOpen(false)}
    onCompleteCalibration={loadFeed}
    onShowToast={showToast}
   />

   <Top250Modal
    isOpen={isTop250Open}
    onClose={() => setIsTop250Open(false)}
    onSelectMovie={(m) => setSelectedMovie(m)}
    onShowToast={showToast}
   />

   <MovieNightModal
    isOpen={isMovieNightOpen}
    onClose={() => setIsMovieNightOpen(false)}
    initialRoomCode={initialRoomCode}
    onShowToast={showToast}
    onSelectMovie={(m) => setSelectedMovie(m)}
    onStartWatchParty={(m, code) => {
     setIsMovieNightOpen(false);
     handleStartWatchParty(m, code);
    }}
   />

   <WatchPartyModal
    isVip={isVip}
    onActivateVip={handleActivateVip}
    onDeactivateVip={handleDeactivateVip}
    isOpen={watchPartyData.isOpen}
    onClose={() => {
     setWatchPartyData((prev) => ({...prev, isOpen: false }));
     setPendingPartyCode(null);
     const url = new URL(window.location);
     if (url.searchParams.has('party') || url.searchParams.has('theater')) {
      url.searchParams.delete('party');
      url.searchParams.delete('theater');
      window.history.replaceState({}, '', url.pathname (url.search ? url.search : ''));
     }
    }}
    roomCode={watchPartyData.roomCode}
    movie={watchPartyData.movie}
    initialVideoSource={watchPartyData.videoSource}
    onShowToast={showToast}
    onRequireAuth={() => setIsAuthOpen(true)}
   />

   <Toast
    toast={toast}
    onUndo={() => {
     if (toast?.movie) {
      if (toast.message?.includes('Watchlist')) {
       toggleWatchlist(toast.movie);
      } else {
       toggleWatched(toast.movie);
      }
      setToast(null);
     }
    }}
    onClose={() => setToast(null)}
   />
  </div>
 );
}
