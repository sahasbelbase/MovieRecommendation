import React, { useState, useEffect, useRef } from 'react';
import { Search, Film, Check, Bookmark, Download, User, LogOut, X, Tv, ArrowLeft, ChevronRight, ExternalLink } from 'lucide-react';
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
}) {
  const { user, logout, watchedMovies, watchlistMovies } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personCredits, setPersonCredits] = useState(null);
  const [loadingPersonCredits, setLoadingPersonCredits] = useState(false);
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

        {/* Global Multi-Search Input (Movies, Series, Anime, Actors) */}
        <div className="relative flex-1 max-w-lg">
          <div className="relative flex items-center z-50">
            <Search className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
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
              placeholder="Search movies, series, actors, directors... (Press '/' to focus)"
              className="w-full pl-10 pr-10 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/50 transition-all"
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

          {/* Autocomplete Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in duration-100 max-h-[75vh] flex flex-col">
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
                /* General Suggestions (Movies + Actors) */
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

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Swipe Mode Button (Signed-In Only) */}
          {user && (
            <button
              onClick={onOpenSwipe}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/20 to-orange-600/20 border border-rose-500/40 text-xs font-semibold text-rose-300 hover:from-rose-600/30 hover:to-orange-600/30 transition-all shadow-sm active:scale-95"
              title="Swipe Mode: Calibrate your FYP"
            >
              <span className="text-sm">🔥</span>
              <span className="hidden sm:inline">Swipe Mode</span>
            </button>
          )}

          {/* Watchlist Button */}
          <button
            onClick={onToggleWatchlistShelf || (() => onOpenWatched('watchlist'))}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-all active:scale-95"
            title="Toggle Watchlist shelf below navigation"
          >
            <Bookmark className={`w-3.5 h-3.5 ${watchlistMovies.length > 0 ? 'text-amber-400 fill-amber-400' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">Watchlist:</span>
            <span className="font-mono text-white font-semibold">{watchlistMovies.length}</span>
          </button>

          {/* Watched Button */}
          <button
            onClick={() => onOpenWatched('watched')}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-all active:scale-95"
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
