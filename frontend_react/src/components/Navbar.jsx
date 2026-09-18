import React, { useState, useEffect, useRef } from 'react';
import { Search, Film, Check, Download, User, LogOut, X, Tv } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Navbar({
  onSelectMovie,
  onOpenWatched,
  onOpenDataModal,
  onOpenAuthModal,
  onOpenSwipe,
}) {
  const { user, logout, watchedMovies } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);

  // Global keyboard shortcut: Pressing '/' focuses search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === '/' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search typeahead across Movies, TV Series, and Anime
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/movies/search?query=${encodeURIComponent(query)}`);
        setSuggestions(res.data.slice(0, 6));
        setShowDropdown(true);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item) => {
    setShowDropdown(false);
    setQuery('');
    onSelectMovie(item);
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Project Title */}
        <div className="flex items-center gap-3 cursor-pointer flex-shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-950/50">
            <Film className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
              Movie Recommendation Engine
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
              <span className="text-[10px] font-mono text-zinc-400">
                {user ? 'Tailored Mode' : 'Guest Mode'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Multi-Search Input (Movies, Series, Anime) */}
        <div className="relative flex-1 max-w-lg">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim() && setShowDropdown(true)}
              placeholder="Search movies, TV series, anime, directors... (Press '/' to focus)"
              className="w-full pl-10 pr-10 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/50 transition-all"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setShowDropdown(false);
                }}
                className="absolute right-3 p-1 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in duration-100 divide-y divide-zinc-800/50">
              {suggestions.map((m) => (
                <div
                  key={`${m.media_type || 'movie'}_${m.id}`}
                  onClick={() => handleSelect(m)}
                  className="flex items-center gap-3 p-2.5 hover:bg-zinc-800/70 cursor-pointer transition-colors"
                >
                  <div className="w-9 h-13 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                    {m.poster_url ? (
                      <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-4 h-4 m-auto text-zinc-600 mt-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200 truncate">{m.title}</p>
                      {m.media_type === 'anime' && (
                        <span className="text-[10px] font-mono font-semibold px-1 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-700/50 rounded">
                          Anime
                        </span>
                      )}
                      {m.media_type === 'tv' && (
                        <span className="text-[10px] font-mono font-semibold px-1 py-0.2 bg-purple-950 text-purple-300 border border-purple-700/50 rounded">
                          TV
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{m.year}</span>
                      {m.genres?.length > 0 && <span>• {m.genres.slice(0, 2).join(', ')}</span>}
                    </div>
                  </div>
                  {m.vote_average > 0 && (
                    <span className="text-xs font-mono font-medium text-amber-400">
                      ★ {m.vote_average}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Swipe Taste Calibration Button (Signed-In Only) */}
          {user && (
            <button
              onClick={onOpenSwipe}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/20 to-orange-600/20 border border-rose-500/40 text-xs font-semibold text-rose-300 hover:from-rose-600/30 hover:to-orange-600/30 transition-all shadow-sm active:scale-95"
              title="Tinder-style Taste Calibration Swipe"
            >
              <span className="text-sm">🔥</span>
              <span className="hidden sm:inline">Swipe FYP</span>
            </button>
          )}

          {/* Watched Button */}
          <button
            onClick={onOpenWatched}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
            title="View watched movies & series"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
            <span className="hidden sm:inline">Watched:</span>
            <span className="font-mono text-white font-semibold">{watchedMovies.length}</span>
          </button>

          {/* Import / Export Button */}
          <button
            onClick={onOpenDataModal}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
            title="Import or Export Watch Data"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* User Auth */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-zinc-700" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-xs font-medium text-rose-300">
                    {user.displayName[0]?.toUpperCase()}
                  </div>
                )}
                <span className="hidden md:inline text-xs font-medium text-zinc-300 truncate max-w-[120px]">
                  {user.displayName}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium shadow-md shadow-rose-950/40 transition-all active:scale-95"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
