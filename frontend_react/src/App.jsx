import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import api from './api/client';
import Navbar from './components/Navbar';
import MovieCard from './components/MovieCard';
import MovieModal from './components/MovieModal';
import WatchedDrawer from './components/WatchedDrawer';
import DataModal from './components/DataModal';
import AuthModal from './components/AuthModal';
import Toast from './components/Toast';
import SwipeDeckModal from './components/SwipeDeckModal';
import { RefreshCw, Film, ChevronRight, Tv, Sparkles, Flame, Github, Linkedin } from 'lucide-react';

const MEDIA_CATEGORIES = [
  { id: "all", label: "All Entertainment" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "TV Series" },
  { id: "anime", label: "Anime" }
];

const GENRES = [
  "All", "Action", "Drama", "Crime", "Sci-Fi", "Comedy", "Thriller", "Romance", "Animation", "Horror", "Mystery"
];

export default function App() {
  const { user, watchedMovies, toggleWatched, toggleWatchlist } = useAuth();

  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slowNotice, setSlowNotice] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isWatchedOpen, setIsWatchedOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState('watched');
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedMediaCategory, setSelectedMediaCategory] = useState("all");
  const [selectedGenre, setSelectedGenre] = useState("All");

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

  // Fetch recommendation feed whenever user state or media category changes
  const loadFeed = async () => {
    setLoading(true);
    try {
      const url = `/recommendations/feed?media_type=${selectedMediaCategory}`;
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
  }, [user, selectedMediaCategory]);

  // Auto-open taste calibration swipe deck when user logs in for the first time
  useEffect(() => {
    if (user?.uid) {
      const onboardingKey = `has_seen_calibration_${user.uid}`;
      const hasSeen = localStorage.getItem(onboardingKey);
      if (!hasSeen) {
        setIsSwipeOpen(true);
        localStorage.setItem(onboardingKey, 'true');
      }
    }
  }, [user?.uid]);

  // Toast helper
  const showToast = (toastObj) => {
    setToast(toastObj);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-canvas text-zinc-100 flex flex-col font-sans">
      {/* Navigation */}
      <Navbar
        onSelectMovie={(m) => setSelectedMovie(m)}
        onOpenWatched={(tab) => handleOpenLibrary(tab || 'watched')}
        onOpenDataModal={() => setIsDataOpen(true)}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onOpenSwipe={() => setIsSwipeOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Onboarding Taste Calibration Banner for Signed-In Users */}
        {user && watchedMovies.length < 5 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-rose-950/60 via-zinc-900 to-zinc-900 border border-rose-800/40 gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h2 className="text-base font-bold text-white">
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-xs font-semibold text-white shadow-lg shadow-rose-950/50 transition-all self-start sm:self-auto active:scale-95"
            >
              Open Swipe Mode
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Banner: Guest invitation vs Authenticated summary */}
        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-surface border border-border-subtle gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSwipeOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600/20 to-orange-600/20 hover:from-rose-600/30 hover:to-orange-600/30 text-xs font-semibold text-rose-300 border border-rose-500/40 transition-all active:scale-95"
              >
                <span>🔥 Swipe FYP</span>
              </button>
              <button
                onClick={loadFeed}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Movies, TV Series & Anime Discovery</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Guest Mode
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Sign in to save your watched history permanently and unlock a tailored taste profile across all media.
              </p>
            </div>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-950/40 transition-all self-start sm:self-auto active:scale-95"
            >
              Sign In / Register
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Media Category Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
            {MEDIA_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedMediaCategory(cat.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedMediaCategory === cat.id
                    ? 'bg-zinc-800 text-white shadow font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Genre Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="aspect-[2/3] bg-zinc-800/40 rounded-xl animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : feed?.sections && feed.sections.length > 0 ? (
          feed.sections.map((section, idx) => {
            // Filter section items by active category and active genre
            const movies = (section.movies || []).filter((m) => {
              // 1. Strict category filter
              if (selectedMediaCategory !== "all") {
                const mType = m.media_type || "movie";
                if (selectedMediaCategory === "anime" && mType !== "anime") return false;
                if (selectedMediaCategory === "tv" && mType !== "tv" && mType !== "kdrama") return false;
                if (selectedMediaCategory === "movie" && mType !== "movie") return false;
              }

              // 2. Genre matching (flexible matching for Action within Action & Adventure, etc.)
              if (selectedGenre === "All") return true;
              if (!m.genres || m.genres.length === 0) return false;
              return m.genres.some((g) =>
                g.toLowerCase().includes(selectedGenre.toLowerCase()) ||
                selectedGenre.toLowerCase().includes(g.toLowerCase())
              );
            });

            if (movies.length === 0) return null;

            return (
              <section key={idx} className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className="text-xs text-zinc-400 mt-0.5">{section.subtitle}</p>
                    )}
                  </div>
                </div>

                {/* Media Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {movies.map((movie) => (
                    <MovieCard
                      key={`${movie.media_type || 'movie'}_${movie.id}`}
                      movie={movie}
                      onSelect={(m) => setSelectedMovie(m)}
                      onShowToast={showToast}
                    />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
            <Film className="w-10 h-10 text-zinc-600 stroke-1" />
            <p className="text-sm font-medium text-zinc-300">No titles found for this category.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-8 px-4 text-center text-xs text-zinc-400 space-y-4">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <a
            href="https://github.com/sahasbelbase"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors py-1.5 px-3.5 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800"
          >
            <Github className="w-4 h-4" />
            <span className="font-medium text-xs">GitHub</span>
          </a>
          <a
            href="https://www.linkedin.com/in/sahasbelbase/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-sky-400 transition-colors py-1.5 px-3.5 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800"
          >
            <Linkedin className="w-4 h-4" />
            <span className="font-medium text-xs">LinkedIn</span>
          </a>
        </div>
        <p className="text-zinc-500 text-[11px]">
          Movie Recommendation Engine &bull; Curated Cinema &amp; Streaming Discovery
        </p>
      </footer>

      {/* Modals and Overlays */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
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
