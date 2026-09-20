import React, { useState, useEffect, useMemo } from 'react';
import { X, Trophy, Star, Check, Bookmark, EyeOff, Search, Film, Tv, Sparkles, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const TOP_250_CATEGORIES = [
  { id: 'movies', label: 'Top 250 Movies', icon: Film, subtitle: 'The greatest cinematic masterpieces in history' },
  { id: 'tv', label: 'Top 250 TV Series', icon: Tv, subtitle: 'The highest-rated television shows of all time' },
  { id: 'anime', label: 'Top 250 Anime', icon: Sparkles, subtitle: 'Legendary anime series and groundbreaking films' }
];

export default function Top250Modal({ isOpen, onClose, onSelectMovie, onShowToast }) {
  const { watchedIds, toggleWatched, watchlistIds, toggleWatchlist, notInterestedIds, toggleNotInterested } = useAuth();
  const [activeCategory, setActiveCategory] = useState('movies');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unwatched' | 'watched'

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch all 250 items for the selected category
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setPage(1);
    setSearchQuery('');

    const fetchTop250 = async () => {
      try {
        const res = await api.get(`/movies/top-250?category=${activeCategory}&limit=250&page=1`);
        setItems(res.data?.items || []);
      } catch (err) {
        console.error("Failed to load Top 250 rankings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTop250();
  }, [isOpen, activeCategory]);

  // Filter items by search query and watch status
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesYear = item.year?.includes(q);
        const matchesGenre = item.genres?.some(g => g.toLowerCase().includes(q));
        if (!matchesTitle && !matchesYear && !matchesGenre) return false;
      }

      // 2. Filter mode
      const isWatched = watchedIds?.has(item.id);
      if (filterMode === 'watched' && !isWatched) return false;
      if (filterMode === 'unwatched' && isWatched) return false;

      // 3. Filter out not-interested if marked
      if (notInterestedIds?.has(item.id)) return false;

      return true;
    });
  }, [items, searchQuery, filterMode, watchedIds, notInterestedIds]);

  // Calculate watched stats within current Top 250 list
  const watchedCount = useMemo(() => {
    return items.filter(m => watchedIds?.has(m.id)).length;
  }, [items, watchedIds]);

  const watchedPercentage = items.length > 0 ? Math.round((watchedCount / items.length) * 100) : 0;

  // Pagination (50 items per page)
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPageItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative w-full max-w-6xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Trophy className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  All-Time Hall of Fame
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Top 250
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  The highest-rated cinema, television, and anime titles in entertainment history.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Progress Tracker */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-3 sm:p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono text-xs font-bold shrink-0">
                {watchedPercentage}%
              </div>
              <div className="text-xs">
                <span className="text-zinc-200 font-semibold">
                  You've watched {watchedCount} of {items.length} titles
                </span>
                <span className="text-zinc-400 ml-1.5">
                  ({items.length - watchedCount} remaining to complete the 250)
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full sm:w-64 h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${watchedPercentage}%` }}
              />
            </div>
          </div>

          {/* Segmented Category Tabs & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Category Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 shrink-0">
              {TOP_250_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-500 text-black shadow-md font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & Watch Filters */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by title, year, or genre..."
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <select
                value={filterMode}
                onChange={(e) => {
                  setFilterMode(e.target.value);
                  setPage(1);
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 py-1.5 px-2.5 focus:outline-none focus:border-amber-500/60 shrink-0"
              >
                <option value="all">All Titles</option>
                <option value="unwatched">Unwatched Only</option>
                <option value="watched">Watched Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Media Grid / List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-zinc-900/60 rounded-xl animate-pulse border border-zinc-800/50" />
              ))}
            </div>
          ) : currentPageItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
              <Trophy className="w-10 h-10 text-zinc-600 stroke-1" />
              <p className="text-sm font-medium text-zinc-300">No matching titles found.</p>
              <p className="text-xs text-zinc-500">Try adjusting your search query or filter options.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {currentPageItems.map((movie) => {
                const isWatched = watchedIds?.has(movie.id);
                const isWatchlist = watchlistIds?.has(movie.id);
                const rank = movie.rank;

                return (
                  <div
                    key={`${movie.media_type || 'movie'}_${movie.id}`}
                    onClick={() => {
                      onClose();
                      onSelectMovie(movie);
                    }}
                    className="group relative flex flex-col rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-2.5 transition-all duration-150 hover:border-amber-500/40 hover:bg-zinc-900 hover:scale-[1.02] cursor-pointer"
                  >
                    {/* Poster with 2:3 Aspect Ratio */}
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-800 flex items-center justify-center">
                      {movie.poster_url ? (
                        <img
                          src={movie.poster_url}
                          alt={movie.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-opacity duration-200"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-zinc-600 gap-2 p-4 text-center">
                          <Film className="w-8 h-8 stroke-1" />
                          <span className="text-xs line-clamp-2">{movie.title}</span>
                        </div>
                      )}

                      {/* Rank Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        {rank === 1 ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-black font-mono text-[11px] font-black shadow-lg shadow-amber-950/80 flex items-center gap-1">
                            #1 👑
                          </span>
                        ) : rank === 2 ? (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-300 text-black font-mono text-[11px] font-bold shadow-md flex items-center gap-1">
                            #2 🥈
                          </span>
                        ) : rank === 3 ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-700 text-white font-mono text-[11px] font-bold shadow-md flex items-center gap-1">
                            #3 🥉
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-zinc-200 font-mono text-[11px] font-bold border border-white/10">
                            #{rank}
                          </span>
                        )}
                      </div>

                      {/* Card Quick Actions with Tooltips */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        {/* Not Interested */}
                        <div className="relative group/tip">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await toggleNotInterested(movie);
                              if (onShowToast) {
                                onShowToast({
                                  message: `Marked "${movie.title}" as Not Interested`,
                                  movie
                                });
                              }
                            }}
                            className="rounded-full p-1.5 transition-all active:scale-90 bg-black/60 backdrop-blur-md text-zinc-400 hover:text-rose-400 hover:bg-black/90 border border-white/10 opacity-70 group-hover:opacity-100"
                            title="Not interested (Hide)"
                          >
                            <EyeOff className="w-3 h-3" />
                          </button>
                          <span className="pointer-events-none absolute top-full mt-1 right-0 z-30 hidden group-hover/tip:inline-flex items-center px-2 py-0.5 rounded bg-zinc-950/95 border border-zinc-700 text-[10px] font-medium text-zinc-200 shadow-xl whitespace-nowrap">
                            Not Interested
                          </span>
                        </div>

                        {/* Watchlist */}
                        <div className="relative group/tip">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const added = await toggleWatchlist(movie);
                              if (onShowToast) {
                                onShowToast({
                                  message: added ? `Added "${movie.title}" to Watchlist` : `Removed from Watchlist`,
                                  movie
                                });
                              }
                            }}
                            className={`rounded-full p-1.5 transition-all active:scale-90 ${
                              isWatchlist
                                ? 'bg-amber-500 text-black shadow'
                                : 'bg-black/60 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/90 border border-white/10'
                            }`}
                            title={isWatchlist ? "In Watchlist" : "Add to Watchlist"}
                          >
                            <Bookmark className={`w-3 h-3 ${isWatchlist ? 'fill-black' : ''}`} />
                          </button>
                          <span className="pointer-events-none absolute top-full mt-1 right-0 z-30 hidden group-hover/tip:inline-flex items-center px-2 py-0.5 rounded bg-zinc-950/95 border border-zinc-700 text-[10px] font-medium text-zinc-200 shadow-xl whitespace-nowrap">
                            {isWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                          </span>
                        </div>

                        {/* Watched */}
                        <div className="relative group/tip">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const watched = await toggleWatched(movie);
                              if (onShowToast) {
                                onShowToast({
                                  message: watched ? `Marked "${movie.title}" as Watched` : `Removed from Watched`,
                                  movie
                                });
                              }
                            }}
                            className={`rounded-full p-1.5 transition-all active:scale-90 ${
                              isWatched
                                ? 'bg-emerald-600 text-white shadow'
                                : 'bg-black/60 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/90 border border-white/10'
                            }`}
                            title={isWatched ? "Watched" : "Mark as Watched"}
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </button>
                          <span className="pointer-events-none absolute top-full mt-1 right-0 z-30 hidden group-hover/tip:inline-flex items-center px-2 py-0.5 rounded bg-zinc-950/95 border border-zinc-700 text-[10px] font-medium text-zinc-200 shadow-xl whitespace-nowrap">
                            {isWatched ? 'Watched (Undo)' : 'Mark as Watched'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Block */}
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-amber-400 transition-colors" title={movie.title}>
                          {movie.title}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="text-[11px] font-mono text-zinc-500">{movie.year || "Classic"}</span>

                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          {movie.rotten_tomatoes && (
                            <span className="text-rose-400 font-semibold" title="Rotten Tomatoes">
                              🍅 {movie.rotten_tomatoes}
                            </span>
                          )}
                          {(movie.imdb_rating || movie.vote_average > 0) && (
                            <span className="flex items-center gap-0.5 text-amber-400 font-semibold" title="IMDb Score">
                              <Star className="w-3 h-3 fill-amber-400 stroke-none" />
                              {movie.imdb_rating || movie.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Pagination Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
          <div>
            Showing <strong className="text-white">{currentPageItems.length}</strong> of{' '}
            <strong className="text-white">{filteredItems.length}</strong> titles
            {filteredItems.length < items.length && ` (filtered from ${items.length})`}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            <span className="font-mono px-2 py-1 text-zinc-300">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
