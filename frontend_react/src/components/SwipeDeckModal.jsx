import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Star, Sparkles, ArrowRight, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const SWIPE_GENRES = ["All", "Anime", "Action", "Drama", "Sci-Fi", "Comedy", "Thriller", "K-Drama"];

export default function SwipeDeckModal({ isOpen, onClose, onCompleteCalibration, onShowToast }) {
  const { user, toggleWatched, markUnwatched, watchedIds, unwatchedIds } = useAuth();
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [genreIndex, setGenreIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [swipedCount, setSwipedCount] = useState(0);

  const cardRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const selectedGenre = SWIPE_GENRES[genreIndex];

  // Load swipe deck for signed in user with optional genre filtering
  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    setCurrentIndex(0);

    const fetchDeck = async () => {
      try {
        const genreParam = selectedGenre !== "All" ? `&genre=${encodeURIComponent(selectedGenre)}` : '';
        const res = await api.get(`/recommendations/swipe-deck?limit=30${genreParam}`);
        // Filter out any titles already watched or marked unwatched/skipped
        const filtered = (res.data || []).filter(
          (m) => !watchedIds?.has(m.id) && !unwatchedIds?.has(m.id)
        );
        setDeck(filtered);
      } catch (err) {
        console.error("Failed to load swipe deck:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeck();
  }, [isOpen, user, selectedGenre, watchedIds, unwatchedIds]);

  const currentCard = deck[currentIndex];

  // Keyboard navigation:
  // - Left Arrow: Skip (Unwatched)
  // - Right Arrow: Watched
  // - Down Arrow: Next Genre
  // - Up Arrow: Previous Genre
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipe('right');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipe('left');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setGenreIndex((prev) => (prev + 1) % SWIPE_GENRES.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setGenreIndex((prev) => (prev - 1 + SWIPE_GENRES.length) % SWIPE_GENRES.length);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, deck, genreIndex]);

  // Execute swipe logic
  const handleSwipe = async (direction, rating = null) => {
    if (!currentCard) return;

    const item = currentCard;
    const isWatched = direction === 'right' || direction === 'up';

    setCurrentIndex((prev) => prev + 1);
    setSwipedCount((prev) => prev + 1);
    setDragOffset({ x: 0, y: 0 });

    try {
      if (isWatched) {
        await toggleWatched(item, rating);
        if (onShowToast) {
          onShowToast({
            message: `Marked "${item.title}" as Watched!`,
            movie: item
          });
        }
      } else {
        // Track unwatched / skipped internally
        if (markUnwatched) {
          await markUnwatched(item);
        }
      }
      // Record swipe on server
      await api.post('/recommendations/swipe', {
        item,
        watched: isWatched,
        rating
      });
    } catch (err) {
      console.error("Error recording swipe:", err);
    }
  };

  // Drag handlers (Mouse & Touch & Trackpad)
  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 90;
    if (dragOffset.x > threshold) {
      handleSwipe('right');
    } else if (dragOffset.x < -threshold) {
      handleSwipe('left');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  if (!isOpen) return null;

  // Calculate dynamic rotation and stamp opacities
  const rotationDeg = dragOffset.x * 0.08;
  const rightOpacity = Math.min(1, Math.max(0, dragOffset.x / 80));
  const leftOpacity = Math.min(1, Math.max(0, -dragOffset.x / 80));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      {/* Container */}
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-5 flex flex-col items-center overflow-hidden">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-2.5 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">Swipe Mode</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/40">
                Calibrate FYP
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Swipe or use arrow keys (← Skip, → Watched, ↑↓ Genre)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Genre Selector Bar with Up / Down indicator */}
        <div className="w-full flex items-center justify-between gap-2 py-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-mono text-zinc-500 shrink-0">Genre:</span>
            {SWIPE_GENRES.map((g, idx) => (
              <button
                key={g}
                onClick={() => setGenreIndex(idx)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all shrink-0 ${
                  genreIndex === idx
                    ? 'bg-rose-600 text-white font-semibold shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0 text-[11px] font-mono text-zinc-500 hidden sm:flex">
            <button
              onClick={() => setGenreIndex((prev) => (prev - 1 + SWIPE_GENRES.length) % SWIPE_GENRES.length)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
              title="Previous Genre (↑)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGenreIndex((prev) => (prev + 1) % SWIPE_GENRES.length)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
              title="Next Genre (↓)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="w-full my-2.5">
          <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
            <span>Calibrating FYP</span>
            <span className="font-semibold text-zinc-200">{swipedCount} calibrated</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (swipedCount / 8) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card Deck Area with Floating Left / Right Buttons */}
        <div className="relative w-full aspect-[2/3] max-h-[460px] my-1 flex items-center justify-center">
          {/* Floating Left Arrow Button */}
          {currentCard && (
            <button
              onClick={() => handleSwipe('left')}
              className="absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-zinc-950/90 border border-zinc-700 hover:border-rose-500 hover:bg-zinc-900 text-zinc-400 hover:text-rose-400 flex items-center justify-center shadow-2xl transition-all active:scale-90"
              title="Skip / Haven't Watched (Click or press ←)"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {/* Floating Right Arrow Button */}
          {currentCard && (
            <button
              onClick={() => handleSwipe('right')}
              className="absolute -right-2 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-zinc-950/90 border border-zinc-700 hover:border-emerald-500 hover:bg-zinc-900 text-zinc-400 hover:text-emerald-400 flex items-center justify-center shadow-2xl transition-all active:scale-90"
              title="I Watched This (Click or press →)"
            >
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {loading ? (
            <div className="w-full h-full rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800 flex items-center justify-center">
              <p className="text-xs text-zinc-500 font-mono">Loading {selectedGenre} titles...</p>
            </div>
          ) : currentCard ? (
            <>
              {/* Peek Card Behind */}
              {deck[currentIndex + 1] && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 scale-95 translate-y-3 opacity-60 pointer-events-none shadow-lg">
                  <img
                    src={deck[currentIndex + 1].poster_url}
                    alt="Next"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Active Interactive Top Card */}
              <div
                ref={cardRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotationDeg}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  touchAction: 'none'
                }}
                className="absolute inset-0 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-700/80 shadow-2xl flex flex-col select-none"
              >
                {/* Poster Background */}
                <div className="relative flex-1 w-full overflow-hidden bg-zinc-800">
                  <img
                    src={currentCard.poster_url || currentCard.backdrop_url}
                    alt={currentCard.title}
                    draggable="false"
                    className="w-full h-full object-cover pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

                  {/* Stamp: WATCHED (Right) */}
                  <div
                    style={{ opacity: rightOpacity }}
                    className="absolute top-6 left-6 -rotate-12 px-3 py-1.5 rounded-lg border-2 border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider text-sm shadow-xl pointer-events-none"
                  >
                    I Watched This
                  </div>

                  {/* Stamp: SKIP (Left) */}
                  <div
                    style={{ opacity: leftOpacity }}
                    className="absolute top-6 right-6 rotate-12 px-3 py-1.5 rounded-lg border-2 border-rose-500 bg-rose-500/20 text-rose-300 font-bold uppercase tracking-wider text-sm shadow-xl pointer-events-none"
                  >
                    Haven't Watched
                  </div>

                  {/* Badges: Format & Ratings */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {currentCard.media_type === 'anime' && (
                        <span className="px-2 py-0.5 rounded bg-indigo-950/90 text-indigo-300 font-mono font-semibold border border-indigo-700/50">
                          Anime
                        </span>
                      )}
                      {currentCard.media_type === 'tv' && (
                        <span className="px-2 py-0.5 rounded bg-purple-950/90 text-purple-300 font-mono font-semibold border border-purple-700/50">
                          TV Series
                        </span>
                      )}
                      {currentCard.media_type === 'kdrama' && (
                        <span className="px-2 py-0.5 rounded bg-pink-950/90 text-pink-300 font-mono font-semibold border border-pink-700/50">
                          K-Drama
                        </span>
                      )}
                      {currentCard.year && (
                        <span className="px-2 py-0.5 rounded bg-black/70 text-zinc-300 font-mono border border-white/10">
                          {currentCard.year}
                        </span>
                      )}
                    </div>

                    {/* Rotten Tomatoes & IMDb Badges */}
                    <div className="flex items-center gap-2">
                      {currentCard.rotten_tomatoes && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/80 text-rose-300 font-semibold font-mono border border-rose-500/30">
                          🍅 {currentCard.rotten_tomatoes}
                        </span>
                      )}
                      {currentCard.imdb_rating && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/80 text-amber-300 font-semibold font-mono border border-amber-500/30">
                          ★ {currentCard.imdb_rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom Info */}
                <div className="p-4 bg-zinc-950 space-y-1">
                  <h3 className="text-base font-bold text-white truncate" title={currentCard.title}>
                    {currentCard.title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {currentCard.overview || "Iconic masterpiece to calibrate your personalized FYP."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">{selectedGenre} Calibrated!</h4>
              <p className="text-xs text-zinc-400 max-w-xs">
                Your recommendations have been tailored with your latest movie, series, and anime preferences.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGenreIndex((prev) => (prev + 1) % SWIPE_GENRES.length)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700"
                >
                  Try Next Genre (↓)
                </button>
                <button
                  onClick={() => {
                    onClose();
                    if (onCompleteCalibration) onCompleteCalibration();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40"
                >
                  Go to FYP
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls with Clickable Left and Right Arrow Buttons */}
        {currentCard && (
          <div className="w-full flex items-center justify-between gap-3 pt-3">
            {/* Left Button: Skip / Haven't Watched */}
            <button
              onClick={() => handleSwipe('left')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-rose-500/60 text-zinc-300 hover:text-rose-400 font-medium text-xs shadow-lg transition-all active:scale-95 group"
              title="Skip / Haven't Watched (Click or press ←)"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Skip (←)</span>
            </button>

            {/* Middle Button: Watched & Loved It (Star) */}
            <button
              onClick={() => handleSwipe('right', 9.5)}
              className="w-12 h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
              title="Watched & Loved It! (9.5 Rating)"
            >
              <Star className="w-5 h-5 fill-amber-400 stroke-none" />
            </button>

            {/* Right Button: I Watched This */}
            <button
              onClick={() => handleSwipe('right')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 hover:text-emerald-200 font-semibold text-xs shadow-lg transition-all active:scale-95 group"
              title="I Watched This (Click or press →)"
            >
              <span>Watched (→)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Bottom Navigation Hints */}
        <div className="w-full flex items-center justify-between text-[11px] text-zinc-500 pt-3 mt-2 border-t border-zinc-800/60 font-mono">
          <span>Keys: <kbd className="text-zinc-300">←</kbd> Skip • <kbd className="text-zinc-300">→</kbd> Watched • <kbd className="text-zinc-300">↑</kbd><kbd className="text-zinc-300">↓</kbd> Genre</span>
          <button
            onClick={() => {
              onClose();
              if (onCompleteCalibration) onCompleteCalibration();
            }}
            className="text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2"
          >
            Done Calibrating
          </button>
        </div>
      </div>
    </div>
  );
}
