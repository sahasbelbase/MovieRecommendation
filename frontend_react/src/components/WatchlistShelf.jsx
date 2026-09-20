import React from 'react';
import { Bookmark, ChevronDown, ChevronUp, Check, Trash2, Film, Star, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WatchlistShelf({
  isExpanded,
  onToggleExpand,
  onSelectMovie,
  onOpenDrawer,
  onShowToast
}) {
  const { watchlistMovies, toggleWatchlist, toggleWatched } = useAuth();

  if (!isExpanded) {
    return null;
  }

  const handleMarkWatched = (e, movie) => {
    e.stopPropagation();
    toggleWatched(movie);
    if (onShowToast) {
      onShowToast(`Moved "${movie.title}" to Watched list!`);
    }
  };

  const handleRemove = (e, movie) => {
    e.stopPropagation();
    toggleWatchlist(movie);
    if (onShowToast) {
      onShowToast(`Removed "${movie.title}" from Watchlist`);
    }
  };

  return (
    <div className="w-full bg-zinc-950/80 border-b border-zinc-800/80 backdrop-blur-md transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Shelf Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Bookmark className="w-4 h-4 fill-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight truncate">
                  Your Watchlist
                </h3>
                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {watchlistMovies.length} {watchlistMovies.length === 1 ? 'title' : 'titles'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
                Queued for later — excluded from discovery feeds below.
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenDrawer('watchlist')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded-lg border border-zinc-800 transition-colors"
              title="Open full drawer view"
            >
              <span className="hidden sm:inline">Manage All</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-700/80 transition-all"
            >
              <span>{isExpanded ? 'Collapse' : 'View List'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Vertical Scroll Container */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-zinc-800/60 animate-in fade-in slide-in-from-top-2 duration-200">
            {watchlistMovies.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                Your watchlist is empty. Click the bookmark icon on any title below to save it here for later!
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto pr-2 space-y-2 divide-y divide-zinc-850 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
                {watchlistMovies.map((movie) => (
                  <div
                    key={`watchlist_shelf_${movie.id}`}
                    onClick={() => onSelectMovie(movie)}
                    className="pt-2 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-zinc-900/80 cursor-pointer transition-colors group"
                  >
                    {/* Poster + Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-14 rounded-lg bg-zinc-900 overflow-hidden shrink-0 border border-zinc-800 group-hover:border-amber-500/50 transition-colors">
                        {movie.poster_url ? (
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <Film className="w-4 h-4 m-auto text-zinc-600 mt-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors truncate">
                            {movie.title}
                          </h4>
                          {movie.media_type === 'anime' && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-700/50 rounded">
                              Anime
                            </span>
                          )}
                          {movie.media_type === 'tv' && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-purple-950 text-purple-300 border border-purple-700/50 rounded">
                              TV
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-1">
                          {movie.year && <span>{movie.year}</span>}
                          {movie.genres?.length > 0 && (
                            <span className="hidden sm:inline text-zinc-500">
                              • {movie.genres.slice(0, 2).join(', ')}
                            </span>
                          )}
                          {movie.rotten_tomatoes && (
                            <span className="flex items-center gap-1 font-mono text-[11px] text-rose-400 bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-800/40">
                              🍅 {movie.rotten_tomatoes}
                            </span>
                          )}
                          {movie.imdb_rating && (
                            <span className="flex items-center gap-1 font-mono text-[11px] text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/40">
                              IMDb {movie.imdb_rating}
                            </span>
                          )}
                          {!movie.rotten_tomatoes && !movie.imdb_rating && movie.vote_average > 0 && (
                            <span className="flex items-center gap-0.5 font-mono text-[11px] text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400 stroke-none" />
                              {Number(movie.vote_average).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleMarkWatched(e, movie)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all text-xs font-medium active:scale-95"
                        title="Mark as watched (removes from watchlist)"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="hidden md:inline">Watched</span>
                      </button>

                      <button
                        onClick={(e) => handleRemove(e, movie)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
