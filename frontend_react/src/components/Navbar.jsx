import React, { useState, useEffect, useRef } from 'react';
import { Search, Film, Check, Bookmark, Download, User, LogOut, X, Tv, ArrowLeft, ChevronRight, ExternalLink, Trophy, Flame, Popcorn, Compass, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Navbar({
  onSelectMovie,
  onSelectActor,
  onOpenWatched,
  onOpenDataModal,
  onOpenAuthModal,
  onOpenSwipe,
  onToggleWatchlistShelf,
  onOpenTop250,
  onOpenMovieNight,
}) {
  const { user, logout, watchedMovies, watchlistMovies } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personCredits, setPersonCredits] = useState(null);
  const [loadingPersonCredits, setLoadingPersonCredits] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
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

  // Debounced search typeahead across Movies, TV Series, Anime, and Actors
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      setSelectedPerson(null);
      setPersonCredits(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/movies/search?query=${encodeURIComponent(query)}`);
        setSuggestions(res.data.slice(0, 8));
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
    setSelectedPerson(null);
    setPersonCredits(null);
    onSelectMovie(item);
  };

  const handleSelectPerson = async (person) => {
    setSelectedPerson(person);
    setLoadingPersonCredits(true);
    setShowDropdown(true);
    try {
      const res = await api.get(`/movies/person/${person.id}/credits`);
      setPersonCredits(res.data);
    } catch (err) {
      console.error("Error loading actor filmography:", err);
    } finally {
      setLoadingPersonCredits(false);
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full md:w-64 md:h-screen bg-zinc-950/95 border-b md:border-b-0 md:border-r border-zinc-800/80 backdrop-blur-xl shrink-0 flex flex-col justify-between">
        
        {/* Top Header & Global Search Section (Non-scrollable, allows dropdowns to pop out without clipping) */}
        <div className="w-full px-3.5 sm:px-5 py-3 md:py-5 flex flex-col gap-3 md:gap-4 shrink-0 relative z-50">
          
          {/* Logo Bar (Flex row on mobile, stacked on desktop) */}
          <div className="flex items-center justify-between md:justify-start gap-3 w-full">
            <div 
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer flex-shrink-0" 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-950/50">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm sm:hidden tracking-tight text-white leading-tight">
                  Cinematch
                </span>
                <span className="hidden sm:inline text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                  Movie Recommendation Engine
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  <span className="text-[10px] font-mono text-zinc-400">
                    {user ? 'Tailored' : 'Guest'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile-only right avatar button */}
            {user ? (
              <button 
                onClick={() => setIsProfileMenuOpen(prev => !prev)}
                className="md:hidden p-0.5 rounded-full hover:bg-zinc-800 transition-colors"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-zinc-700 object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-xs font-semibold text-rose-300">
                    {user.displayName?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="md:hidden px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Global Multi-Search Input (Movies, Series, Anime, Actors) */}
          <div className="relative w-full z-50">
            <div className="relative flex items-center w-full">
              <Search className="absolute left-3 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedPerson(null);
                  setPersonCredits(null);
                }}
                onFocus={() => query.trim() && setShowDropdown(true)}
                placeholder="Search movies, series, anime, actors..."
                className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/50 transition-all"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setSelectedPerson(null);
                    setPersonCredits(null);
                    setShowDropdown(false);
                  }}
                  className="absolute right-3 p-1 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Backdrop Dismiss when Dropdown is Open */}
            {showDropdown && (
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => setShowDropdown(false)}
              />
            )}

            {/* Autocomplete Dropdown - Positioned as floating popover on both desktop & mobile */}
            {showDropdown && (
              <div className="fixed md:absolute top-16 md:top-0 left-3 md:left-full right-3 md:right-auto md:ml-3 md:w-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[75vh] flex flex-col">
                {selectedPerson ? (
                  /* Actor Filmography View in Search */
                  <div className="flex flex-col">
                    {/* Actor Header */}
                    <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={() => {
                            setSelectedPerson(null);
                            setPersonCredits(null);
                          }}
                          className="p-1.5 rounded-lg hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors"
                          title="Back to search results"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center">
                          {selectedPerson.profile_url ? (
                            <img src={selectedPerson.profile_url} alt={selectedPerson.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs sm:text-sm font-bold text-white truncate">
                              {selectedPerson.name}
                            </p>
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-amber-950/80 text-amber-300 border border-amber-700/50 rounded">
                              {selectedPerson.known_for_department || 'Actor'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            {loadingPersonCredits
                              ? 'Loading movies...'
                              : `${personCredits?.movies?.length || 0} titles in filmography`
                            }
                          </p>
                        </div>
                      </div>

                      {onSelectActor && (
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            onSelectActor(personCredits?.person || selectedPerson);
                          }}
                          className="text-[11px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0 px-2 py-1 rounded bg-amber-950/40 border border-amber-800/40 hover:bg-amber-950/70 transition-all"
                        >
                          <span>Full Profile</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Movies List */}
                    <div className="overflow-y-auto max-h-80 divide-y divide-zinc-800/40 p-1">
                      {loadingPersonCredits ? (
                        <div className="p-4 space-y-3">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                              <div className="w-9 h-12 bg-zinc-800 rounded" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-3/4 bg-zinc-800 rounded" />
                                <div className="h-2.5 w-1/2 bg-zinc-800/60 rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : personCredits?.movies?.length > 0 ? (
                        personCredits.movies.map((m) => (
                          <div
                            key={`${m.media_type || 'movie'}_${m.id}`}
                            onClick={() => handleSelect(m)}
                            className="flex items-center gap-3 p-2.5 hover:bg-zinc-800/70 cursor-pointer transition-colors rounded-lg group"
                          >
                            <div className="w-9 h-13 rounded bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-800">
                              {m.poster_url ? (
                                <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" />
                              ) : (
                                <Film className="w-4 h-4 m-auto text-zinc-600 mt-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-zinc-200 group-hover:text-amber-400 transition-colors truncate">
                                  {m.title}
                                </p>
                                {m.media_type === 'tv' && (
                                  <span className="text-[10px] font-mono font-semibold px-1 py-0.2 bg-purple-950 text-purple-300 border border-purple-700/50 rounded">
                                    TV
                                  </span>
                                )}
                                {m.media_type === 'anime' && (
                                  <span className="text-[10px] font-mono font-semibold px-1 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-700/50 rounded">
                                    Anime
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                                {m.year && <span>{m.year}</span>}
                                {m.character && (
                                  <span className="text-zinc-500 italic truncate max-w-[200px]">
                                    as {m.character}
                                  </span>
                                )}
                              </div>
                            </div>
                            {m.vote_average > 0 && (
                              <span className="text-xs font-mono font-medium text-amber-400 shrink-0">
                                ★ {m.vote_average.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-xs text-zinc-500">
                          No movie titles found for this artist.
                        </div>
                      )}
                    </div>
                  </div>
                ) : suggestions.length > 0 ? (
                  /* General Suggestions (Movies, TV, Anime, Actors) */
                  <div className="divide-y divide-zinc-800/50 max-h-96 overflow-y-auto">
                    {suggestions.map((m) => {
                      if (m.media_type === 'person') {
                        return (
                          <div
                            key={`person_${m.id}`}
                            onClick={() => handleSelectPerson(m)}
                            className="flex items-center justify-between gap-3 p-2.5 hover:bg-zinc-800/80 cursor-pointer transition-colors group bg-zinc-950/40"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-amber-700/40 flex items-center justify-center">
                                {m.profile_url ? (
                                  <img src={m.profile_url} alt={m.name} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-5 h-5 text-zinc-500" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors truncate">
                                    {m.name}
                                  </p>
                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-amber-950/80 text-amber-300 border border-amber-700/50 rounded">
                                    {m.known_for_department || 'Actor'}
                                  </span>
                                </div>
                                {m.known_for_text && (
                                  <p className="text-xs text-zinc-400 truncate max-w-sm">
                                    Known for: <span className="text-zinc-300">{m.known_for_text}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="flex items-center gap-1 text-xs text-amber-400 group-hover:translate-x-0.5 transition-transform font-medium shrink-0">
                              View Movies
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        );
                      }

                      return (
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
                              ★ {m.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Middle Scrollable Section: Navigation Links & Library Actions (Hidden on mobile top bar, visible in mobile bottom bar) */}
        <div className="hidden md:flex flex-col flex-1 overflow-y-auto no-scrollbar px-5 py-2 space-y-6">
          {/* Primary Navigation Links */}
          <div className="flex flex-col gap-1.5 w-full">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-all active:scale-95"
            >
              <Compass className="w-4 h-4 text-rose-400" />
              <span>Discover</span>
            </button>
            <button
              onClick={onOpenMovieNight}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/50 transition-all active:scale-95"
            >
              <Popcorn className="w-4 h-4 text-amber-400" />
              <span>Movie Night</span>
            </button>
            <button
              onClick={onOpenTop250}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/50 transition-all active:scale-95"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Top 250</span>
            </button>
            {user && (
              <button
                onClick={onOpenSwipe}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-rose-400 hover:bg-zinc-800/50 transition-all active:scale-95"
              >
                <Flame className="w-4 h-4 text-rose-400" />
                <span>Swipe FYP</span>
              </button>
            )}
            <button
              onClick={onOpenDataModal}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-purple-400 hover:bg-zinc-800/50 transition-all active:scale-95"
              title="Library Resources, Backup & Data Sync"
            >
              <Database className="w-4 h-4 text-purple-400" />
              <span>Resources & Data</span>
            </button>
          </div>

          {/* Desktop Library Links */}
          <div className="flex flex-col gap-1.5 w-full">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider px-2 mb-1">Your Library</p>
            <button
              onClick={onToggleWatchlistShelf || (() => onOpenWatched('watchlist'))}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-800/50 text-sm font-medium text-zinc-300 hover:text-white transition-all w-full"
            >
              <Bookmark className={`w-4 h-4 shrink-0 ${watchlistMovies.length > 0 ? 'text-amber-400 fill-amber-400' : 'text-zinc-400'}`} />
              <span className="flex-1 text-left">Watchlist</span>
              <span className="font-mono text-white bg-zinc-800 px-2 py-0.5 rounded-md text-xs">{watchlistMovies.length}</span>
            </button>
            <button
              onClick={() => onOpenWatched('watched')}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-800/50 text-sm font-medium text-zinc-300 hover:text-white transition-all w-full"
            >
              <Check className="w-4 h-4 text-emerald-400 stroke-[2.5] shrink-0" />
              <span className="flex-1 text-left">Watched</span>
              <span className="font-mono text-white bg-zinc-800 px-2 py-0.5 rounded-md text-xs">{watchedMovies.length}</span>
            </button>
            <button
              onClick={onOpenDataModal}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-800/50 text-sm font-medium text-zinc-400 hover:text-white transition-all w-full"
            >
              <Download className="w-4 h-4 text-zinc-400" />
              <span className="flex-1 text-left">Export Data</span>
            </button>
          </div>

          {/* Join Party by Code (Desktop) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.target.elements.roomCode.value;
              const trimmed = input.trim();
              if (trimmed === '9999') {
                localStorage.setItem('vip_activated', 'true');
                if (onVipActivated) onVipActivated();
                alert('You are activated 🤫');
                e.target.reset();
              } else if (trimmed.length === 4) {
                window.location.href = `/?party=${trimmed.toUpperCase()}`;
              }
            }}
            className="flex flex-col gap-2 w-full"
          >
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider px-2">Watch Party</p>
            <div className="flex w-full">
              <input
                name="roomCode"
                type="text"
                placeholder="Code"
                maxLength={4}
                className="w-full px-3 py-2 rounded-l-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors uppercase placeholder:normal-case placeholder:text-zinc-500"
                title="Enter 4-letter Party Code"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-r-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md transition-colors whitespace-nowrap"
              >
                Join
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Profile Section (Desktop Profile Card & Dropdown) */}
        <div className="hidden md:flex flex-col px-4 py-4 border-t border-zinc-800/80 shrink-0 relative z-50">
          {user ? (
            <div className="relative w-full">
              <button
                onClick={() => setIsProfileMenuOpen(prev => !prev)}
                className="flex items-center gap-3 p-1.5 w-full rounded-xl hover:bg-zinc-800/50 transition-all text-left group"
                title="Account Menu"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-9 h-9 rounded-full border border-zinc-700 shrink-0 object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-sm font-medium text-rose-300 shrink-0">
                    {user.displayName?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-white truncate group-hover:text-rose-400 transition-colors">
                    {user.displayName}
                  </span>
                  <span className="text-[10px] text-zinc-400 truncate">
                    {user.email}
                  </span>
                </div>
              </button>

              {/* Desktop Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsProfileMenuOpen(false)} />
                  <div className="absolute left-full bottom-0 ml-3 w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-800">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="w-9 h-9 rounded-full border border-zinc-700 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-sm font-semibold text-rose-300 shrink-0">
                          {user.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-white truncate">{user.displayName}</p>
                        <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-xs">
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onOpenWatched('watched');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/80 text-zinc-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                          <span>Watched Library</span>
                        </div>
                        <span className="font-mono text-emerald-400 font-semibold">{watchedMovies.length}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onOpenWatched('watchlist');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/80 text-zinc-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-amber-400" />
                          <span>Watchlist</span>
                        </div>
                        <span className="font-mono text-amber-400 font-semibold">{watchlistMovies.length}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onOpenDataModal();
                        }}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-zinc-800/80 text-zinc-300 transition-colors"
                      >
                        <Download className="w-4 h-4 text-zinc-400" />
                        <span>Import / Export Data</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="flex items-center justify-center gap-2 pt-2 border-t border-zinc-800 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors py-1.5 rounded-xl hover:bg-rose-950/30"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-sm font-bold shadow-lg shadow-rose-950/40 transition-all active:scale-95"
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Profile Menu Modal (when avatar is tapped on mobile header) */}
      {isProfileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsProfileMenuOpen(false)} />
          <div className="relative w-full max-w-xs p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 flex flex-col gap-3">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border border-zinc-700 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-base font-semibold text-rose-300 shrink-0">
                  {user?.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{user?.displayName}</p>
                <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onOpenWatched('watched');
                }}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-200"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span>Watched Library</span>
                </div>
                <span className="font-mono text-emerald-400 font-semibold">{watchedMovies.length}</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onOpenWatched('watchlist');
                }}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-200"
              >
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <span>Watchlist</span>
                </div>
                <span className="font-mono text-amber-400 font-semibold">{watchlistMovies.length}</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onOpenDataModal();
                }}
                className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-300"
              >
                <Download className="w-4 h-4 text-zinc-400" />
                <span>Import / Export Data</span>
              </button>
            </div>

            {/* Mobile Join Party by Code */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.elements.roomCode.value;
                const trimmed = input.trim();
                if (trimmed === '9999') {
                  localStorage.setItem('vip_activated', 'true');
                  if (onVipActivated) onVipActivated();
                  alert('You are activated 🤫');
                  e.target.reset();
                  setIsProfileMenuOpen(false);
                } else if (trimmed.length === 4) {
                  setIsProfileMenuOpen(false);
                  window.location.href = `/?party=${trimmed.toUpperCase()}`;
                }
              }}
              className="flex flex-col gap-2 pt-3 border-t border-zinc-800"
            >
              <div className="flex w-full">
                <input
                  name="roomCode"
                  type="text"
                  placeholder="Party Code"
                  maxLength={4}
                  className="w-full px-3 py-2 rounded-l-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors uppercase placeholder:normal-case placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-r-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  Join
                </button>
              </div>
            </form>

            <button
              onClick={() => {
                setIsProfileMenuOpen(false);
                logout();
              }}
              className="flex items-center justify-center gap-2 pt-3 border-t border-zinc-800 text-xs font-semibold text-rose-400 hover:text-rose-300 py-2 rounded-xl hover:bg-rose-950/30 mt-1"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-1.5 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
        {/* Discover / Feed */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl text-zinc-400 hover:text-white active:text-rose-400 transition-all active:scale-95 group"
        >
          <Compass className="w-5 h-5 group-hover:text-rose-400 transition-colors" />
          <span className="text-[10px] font-medium tracking-tight">Discover</span>
        </button>

        {/* Swipe FYP */}
        <button
          onClick={user ? onOpenSwipe : onOpenAuthModal}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl text-zinc-400 hover:text-rose-400 active:text-rose-400 transition-all active:scale-95 relative group"
        >
          <div className="relative">
            <Flame className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <span className="text-[10px] font-medium tracking-tight text-rose-300">Swipe</span>
        </button>

        {/* Movie Night */}
        <button
          onClick={onOpenMovieNight}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl text-zinc-400 hover:text-amber-400 active:text-amber-400 transition-all active:scale-95 group"
        >
          <Popcorn className="w-5 h-5 group-hover:text-amber-400 transition-colors" />
          <span className="text-[10px] font-medium tracking-tight">Night</span>
        </button>

        {/* Top 250 */}
        <button
          onClick={onOpenTop250}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl text-zinc-400 hover:text-amber-300 active:text-amber-300 transition-all active:scale-95 group"
        >
          <Trophy className="w-5 h-5 group-hover:text-amber-400 transition-colors" />
          <span className="text-[10px] font-medium tracking-tight">Top 250</span>
        </button>

        {/* Watchlist */}
        <button
          onClick={onToggleWatchlistShelf || (() => onOpenWatched('watchlist'))}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl text-zinc-400 hover:text-white active:text-amber-400 transition-all active:scale-95 relative group"
        >
          <div className="relative">
            <Bookmark className={`w-5 h-5 transition-colors ${watchlistMovies.length > 0 ? 'text-amber-400 fill-amber-400/30' : 'text-zinc-400 group-hover:text-white'}`} />
            {watchlistMovies.length > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[15px] h-3.5 flex items-center justify-center rounded-full bg-amber-500 text-black font-mono text-[9px] font-bold shadow-sm">
                {watchlistMovies.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight">Watchlist</span>
        </button>

        {/* Resources & Data */}
        <button
          onClick={onOpenDataModal}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl text-zinc-400 hover:text-purple-300 active:text-purple-300 transition-all active:scale-95 group"
          title="Library Resources & Data Backup"
        >
          <Database className="w-5 h-5 text-purple-400 group-hover:text-purple-300 transition-colors" />
          <span className="text-[10px] font-medium tracking-tight text-purple-300">Resources</span>
        </button>
      </div>
    </>
  );
}
