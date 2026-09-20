import React, { useState, useEffect } from 'react';
import { X, Trash2, Film, Download, Star, Check, Bookmark, Tv } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WatchedDrawer({
  isOpen,
  onClose,
  onSelectMovie,
  onOpenDataModal,
  initialTab = 'watched',
}) {
  const { user, watchedMovies, toggleWatched, watchlistMovies, toggleWatchlist } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync active tab whenever drawer is opened with a specific initialTab
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Your Cinema Library</h3>
              <p className="text-xs text-zinc-400">
                {activeTab === 'watchlist'
                  ? `${watchlistMovies.length} ${watchlistMovies.length === 1 ? 'title' : 'titles'} saved to watch`
                  : `${watchedMovies.length} ${watchedMovies.length === 1 ? 'title' : 'titles'} recorded`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenDataModal();
                }}
                className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                title="Export or Import data"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Library Segmented Tabs */}
          <div className="flex items-center p-2 bg-zinc-900/50 border-b border-zinc-800/80 gap-2">
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'watchlist'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${activeTab === 'watchlist' ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>Watchlist</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-black/40 text-amber-200">
                {watchlistMovies.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('watched')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'watched'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Watched</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-black/40 text-emerald-200">
                {watchedMovies.length}
              </span>
            </button>
          </div>

          {/* Tab Content: Watchlist View */}
          {activeTab === 'watchlist' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-zinc-800/40">
              {watchlistMovies.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-950/30 border border-amber-800/40 flex items-center justify-center text-amber-400">
                    <Bookmark className="w-6 h-6 stroke-1 fill-amber-400/20" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-zinc-200">Your Watchlist is empty</h4>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
                      Click the bookmark icon on any movie or series to save what you want to watch next.
                    </p>
                  </div>
                </div>
              ) : (
                watchlistMovies.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between pt-3 group gap-3"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => {
                        onClose();
                        onSelectMovie(m);
                      }}
                    >
                      <div className="w-10 h-14 rounded bg-zinc-900 overflow-hidden flex-shrink-0 border border-zinc-800">
                        {m.poster_url ? (
                          <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-4 h-4 m-auto text-zinc-700 mt-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
                          {m.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          {m.year && <span>{m.year}</span>}
                          {m.rotten_tomatoes && (
                            <span className="text-rose-400 font-mono text-[11px]">🍅 {m.rotten_tomatoes}</span>
                          )}
                          {(m.imdb_rating || m.vote_average > 0) && (
                            <span className="flex items-center gap-0.5 text-amber-400 font-mono text-[11px]">
                              <Star className="w-3 h-3 fill-amber-400 stroke-none" />
                              {m.imdb_rating || m.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick Move to Watched */}
                      <button
                        onClick={() => toggleWatched(m)}
                        className="p-2 text-zinc-400 hover:text-emerald-400 transition-colors rounded-lg hover:bg-emerald-950/30 border border-transparent hover:border-emerald-800/50"
                        title="Mark as Watched (moves from Watchlist to Watched)"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </button>

                      {/* Remove from Watchlist */}
                      <button
                        onClick={() => toggleWatchlist(m)}
                        className="p-2 text-zinc-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-zinc-900"
                        title="Remove from Watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab Content: Watched View */}
          {activeTab === 'watched' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-zinc-800/40">
              {watchedMovies.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                    <Film className="w-6 h-6 stroke-1" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-zinc-200">No watched movies yet</h4>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
                      Click the checkmark on any movie card to mark it as watched and exclude it from your recommendations.
                    </p>
                  </div>
                </div>
              ) : (
                watchedMovies.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between pt-3 group gap-3"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => {
                        onClose();
                        onSelectMovie(m);
                      }}
                    >
                      <div className="w-10 h-14 rounded bg-zinc-900 overflow-hidden flex-shrink-0 border border-zinc-800">
                        {m.poster_url ? (
                          <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-4 h-4 m-auto text-zinc-700 mt-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-zinc-200 truncate group-hover:text-emerald-400 transition-colors">
                          {m.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          {m.year && <span>{m.year}</span>}
                          {m.rating ? (
                            <span className="flex items-center gap-0.5 text-amber-400 font-mono text-[11px]">
                              <Star className="w-3 h-3 fill-amber-400 stroke-none" /> {m.rating}
                            </span>
                          ) : m.vote_average ? (
                            <span className="text-zinc-500 font-mono text-[11px]">★ {m.vote_average}</span>
                          ) : null}
                          {m.review && (
                            <span className="text-zinc-400 italic text-[11px] truncate max-w-[140px]" title={m.review}>
                              "{m.review}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleWatched(m)}
                      className="p-2 text-zinc-600 hover:text-rose-400 transition-colors rounded-lg hover:bg-zinc-900 shrink-0"
                      title="Remove from watched"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Library Status Footer */}
          <div className="p-3 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-400' : 'bg-amber-400/80'}`} />
              <span className="text-[11px]">
                {user ? 'Synced with your Google Account & Drive' : 'Stored locally on this browser'}
              </span>
            </div>
            {!user && (
              <span className="text-[10px] text-zinc-500 font-medium">Sign in to sync</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
