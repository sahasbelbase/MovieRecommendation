import React, { useState, useEffect } from 'react';
import { Play, X, Clock, ChevronRight, RotateCcw } from 'lucide-react';
import { getContinueWatchingList, removeContinueWatchingProgress, subscribeContinueWatching } from '../services/continueWatching';

export default function ContinueWatchingShelf({ onSelectMovie, onShowToast, user, isVip }) {
  const [items, setItems] = useState(() => getContinueWatchingList());

  useEffect(() => {
    setItems(getContinueWatchingList());
    return subscribeContinueWatching((updated) => {
      setItems(updated);
    });
  }, []);

  if (!items || items.length === 0) {
    return null;
  }

  const handleDismiss = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    removeContinueWatchingProgress(item.id, user);
    if (onShowToast) {
      onShowToast({
        message: `Removed "${item.title}" from Continue Watching`,
        movie: item,
      });
    }
  };

  return (
    <section className="space-y-3.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-zinc-900/90 via-zinc-900/70 to-zinc-950 border border-zinc-800/80 shadow-xl mb-6 animate-in fade-in duration-200">
      {/* Shelf Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-purple-600/20 border border-rose-500/30 text-rose-400">
            <RotateCcw className="w-4 h-4 animate-spin-once" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Continue Watching
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                {items.length} {items.length === 1 ? 'in progress' : 'in progress'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Pick up right where you left off
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Rail */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700/60 scrollbar-track-transparent">
        {items.map((item) => {
          const isSeries = item.media_type === 'tv' || item.media_type === 'anime' || item.media_type === 'kdrama';
          const epLabel = isSeries ? `S${item.season || 1} E${item.episode || 1}` : null;

          return (
            <div
              key={item.id}
              onClick={() => onSelectMovie(item, true, item)}
              className="group relative flex-shrink-0 w-36 sm:w-44 bg-zinc-900/80 border border-zinc-800/90 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-950/20 hover:scale-[1.02]"
            >
              {/* Poster Container */}
              <div className="relative aspect-[2/3] w-full bg-zinc-800 overflow-hidden">
                {item.poster_url ? (
                  <img
                    src={item.poster_url}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-xs p-2 text-center">
                    {item.title}
                  </div>
                )}

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={(e) => handleDismiss(e, item)}
                  title="Remove from Continue Watching"
                  className="absolute top-1.5 right-1.5 z-20 p-1 rounded-full bg-black/70 hover:bg-rose-600 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Hover Play Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                  <div className="p-3 rounded-full bg-rose-600 text-white shadow-xl shadow-rose-950/60 transform group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Episode Chip */}
                {epLabel && (
                  <span className="absolute bottom-2 left-2 z-10 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-rose-300 border border-rose-500/30">
                    {epLabel}
                  </span>
                )}

                {/* Bottom Progress Bar */}
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/80 z-20 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-purple-500 to-amber-400"
                    style={{ width: `${Math.min(100, Math.max(5, item.progress_percent || 15))}%` }}
                  />
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="p-2 sm:p-2.5">
                <h4 className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-0.5 font-mono">
                  <span>{item.progress_percent}% watched</span>
                  <span className="text-rose-400 font-bold flex items-center gap-0.5">
                    <Play className="w-2.5 h-2.5 fill-current" /> Resume
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
