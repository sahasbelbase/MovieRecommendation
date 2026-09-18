import React from 'react';
import { X, Trash2, Film, Download, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WatchedDrawer({ isOpen, onClose, onSelectMovie, onOpenDataModal }) {
  const { watchedMovies, toggleWatched } = useAuth();

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
              <h3 className="text-lg font-bold text-white">Your Watched Movies</h3>
              <p className="text-xs text-zinc-400">
                {watchedMovies.length} {watchedMovies.length === 1 ? 'film' : 'films'} recorded
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenDataModal();
                }}
                className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                title="Export or Import data"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-zinc-800/40">
            {watchedMovies.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                  <Film className="w-6 h-6 stroke-1" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-zinc-200">No watched movies yet</h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                    Click the checkmark on any movie card to mark it as watched and remove it from your recommendations feed.
                  </p>
                </div>
              </div>
            ) : (
              watchedMovies.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between pt-3 group"
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
                      <h4 className="text-sm font-medium text-zinc-200 truncate group-hover:text-rose-400 transition-colors">
                        {m.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                        {m.year && <span>{m.year}</span>}
                        {m.rating ? (
                          <span className="flex items-center gap-0.5 text-amber-400 font-mono">
                            <Star className="w-3 h-3 fill-amber-400 stroke-none" /> {m.rating}
                          </span>
                        ) : m.vote_average ? (
                          <span className="text-zinc-500 font-mono">★ {m.vote_average}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleWatched(m)}
                    className="p-2 text-zinc-600 hover:text-rose-400 transition-colors rounded-lg hover:bg-zinc-900"
                    title="Remove from watched"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
