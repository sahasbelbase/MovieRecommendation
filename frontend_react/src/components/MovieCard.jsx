import React, { useState, useEffect } from 'react';
import { Star, Check, Bookmark, Film, Tv, EyeOff, Play, Info, Share2, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getItemProgress, subscribeContinueWatching } from '../services/continueWatching';

export default function MovieCard({ movie, onSelect, onShowToast, isVip = false }) {
 const { user, watchedIds, toggleWatched, watchlistIds, toggleWatchlist, notInterestedIds, toggleNotInterested } = useAuth();
 const movieId = movie?.id || movie?.item_id || movie?.tmdb_id || movie?.movieId;
 const isWatched = watchedIds.has(movieId);
 const isWatchlist = watchlistIds.has(movieId);
 const isNotInterested = notInterestedIds?.has(movieId);
 const mediaType = movie.media_type || (movie.is_movie || movie.stream_type === 'movie' ? 'movie' : 'movie');
 const isSeries = mediaType === 'tv' || mediaType === 'anime' || mediaType === 'kdrama';

 const [progress, setProgress] = useState(() => getItemProgress(movieId));

 useEffect(() => {
  setProgress(getItemProgress(movieId));
  return subscribeContinueWatching(() => {
   setProgress(getItemProgress(movieId));
  });
 }, [movieId]);

 const handleCardClick = (e) => {
  // If Ctrl, Cmd, Shift, or Middle Click (button === 1), allow native browser action to open new tab
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
   return;
  }
  e.preventDefault();
  onSelect(movie, false, progress);
 };

 const handleShareClick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const shareUrl = `${window.location.origin}/?item=${movieId}&type=${mediaType}`;
  if (navigator.share) {
   try {
    await navigator.share({
     title: movie.title,
     url: shareUrl
    });
    return;
   } catch (err) {}
  }
  try {
   await navigator.clipboard.writeText(shareUrl);
   if (onShowToast) {
    onShowToast({ message: `Link copied for "${movie.title}"! Share it with friends 🍿`, movie });
   }
  } catch (err) {
   if (onShowToast) onShowToast({ message: 'Failed to copy link', movie });
  }
 };

 const handleWatchedClick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const nowWatched = await toggleWatched(movie);
  if (onShowToast) {
   onShowToast({
    message: nowWatched
     ? `Marked "${movie.title}" as watched`
     : `Removed "${movie.title}" from watched`,
    movie,
   });
  }
 };

 const handleWatchlistClick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const nowInWatchlist = await toggleWatchlist(movie);
  if (onShowToast) {
   onShowToast({
    message: nowInWatchlist
     ? `Added "${movie.title}" to Watchlist`
     : `Removed "${movie.title}" from Watchlist`,
    movie,
   });
  }
 };

 const handleNotInterestedClick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const nowNotInterested = await toggleNotInterested(movie);
  if (onShowToast) {
   onShowToast({
    message: nowNotInterested
     ? `Marked "${movie.title}" as Not Interested`
     : `Restored "${movie.title}"`,
    movie,
   });
  }
 };

 return (
  <a
   href={`/?item=${movieId}&type=${mediaType}`}
   tabIndex={0}
   onClick={handleCardClick}
   onFocus={(e) => e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
   onKeyDown={(e) => {
    if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23) {
     if (e.ctrlKey || e.metaKey) return;
     e.preventDefault();
     onSelect(movie, false, progress);
    }
   }}
   className="group relative flex flex-col rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-2.5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:scale-[1.03] cursor-pointer shadow-sm hover:shadow-xl block no-underline text-inherit"
  >
   {/* Poster with 2:3 Aspect Ratio */}
   <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-800 flex items-center justify-center">
    {movie.poster_url ? (
     <img
      src={movie.poster_url}
      alt={movie.title}
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
     />
    ) : (
     <div className="flex flex-col items-center justify-center text-zinc-600 gap-2 p-4 text-center">
      {mediaType === 'tv' ? <Tv className="w-8 h-8 stroke-1" /> : <Film className="w-8 h-8 stroke-1" />}
      <span className="text-xs line-clamp-2">{movie.title}</span>
     </div>
    )}

    {/* Bottom Progress Bar if in-progress */}
    {progress && progress.progress_percent > 0 && (
     <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/70 z-20 overflow-hidden">
      <div
       className="h-full bg-gradient-to-r from-rose-500 via-purple-500 to-amber-400 rounded-r-full transition-all duration-300"
       style={{ width: `${Math.min(100, Math.max(5, progress.progress_percent))}%` }}
      />
     </div>
    )}

    {/* In-Progress Continue Chip */}
    {progress && (
     <div className="absolute bottom-2.5 left-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-rose-500/40 text-rose-300 font-mono text-[9px] font-bold shadow-lg group-hover:opacity-0 transition-opacity">
      <RotateCcw className="w-2.5 h-2.5 text-rose-400 animate-spin-once" />
      <span>{isSeries ? `Resume S${progress.season} E${progress.episode}` : `${progress.progress_percent}%`}</span>
     </div>
    )}

    {/* Netflix-Style 1-Click Hover Action Overlay */}
    <div className="absolute inset-x-0 bottom-0 top-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end gap-2 p-3 z-20 pointer-events-none group-hover:pointer-events-auto rounded-b-lg">
     {user && isVip ? (
      <div className="w-full flex items-center gap-2">
       <button
        type="button"
        onClick={(e) => {
         e.preventDefault();
         e.stopPropagation();
         onSelect(movie, true, progress);
        }}
        className="flex-1 py-1.5 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60 transition-transform active:scale-95"
       >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>{progress ? (isSeries ? `Resume E${progress.episode}` : 'Resume') : 'Play'}</span>
       </button>
       <button
        type="button"
        onClick={(e) => {
         e.preventDefault();
         e.stopPropagation();
         onSelect(movie, false, progress);
        }}
        className="py-1.5 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1 border border-zinc-700/60 transition-transform active:scale-95"
       >
        <Info className="w-3.5 h-3.5" />
        <span>Details</span>
       </button>
      </div>
     ) : (
      <button
       type="button"
       onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(movie, false, progress);
       }}
       className="w-full py-1.5 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-zinc-700/60 transition-transform active:scale-95"
      >
       <Info className="w-3.5 h-3.5" />
       <span>Details</span>
      </button>
     )}
    </div>

    {/* Quick Actions: Share, Not Interested, Watchlist & Watched (z-30 ensures top layer clickability) */}
    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-30">
     {/* Share Link Tooltip & Button */}
     <div className="relative group/tip">
      <button
       type="button"
       onClick={handleShareClick}
       aria-label="Share title link"
       className="rounded-full p-2 transition-all active:scale-90 bg-black/60 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/90 border border-white/10 opacity-70 group-hover:opacity-100"
       title="Share link with friends"
      >
       <Share2 className="w-3.5 h-3.5" />
      </button>
      <span className="pointer-events-none absolute top-full mt-1 right-0 z-30 hidden group-hover/tip:inline-flex items-center px-2 py-0.5 rounded bg-zinc-950/95 border border-zinc-700 text-[10px] font-medium text-zinc-200 shadow-xl whitespace-nowrap">
       Share Link
      </span>
     </div>

     {/* Not Interested Tooltip & Button */}
     <div className="relative group/tip">
      <button
       type="button"
       onClick={handleNotInterestedClick}
       aria-label="Not interested"
       className="rounded-full p-2 transition-all active:scale-90 bg-black/60 backdrop-blur-md text-zinc-400 hover:text-rose-400 hover:bg-black/90 border border-white/10 opacity-70 group-hover:opacity-100"
       title="Not interested (Hide permanently)"
      >
       <EyeOff className="w-3.5 h-3.5" />
      </button>
      <span className="pointer-events-none absolute top-full mt-1 right-0 z-30 hidden group-hover/tip:inline-flex items-center px-2 py-0.5 rounded bg-zinc-950/95 border border-zinc-700 text-[10px] font-medium text-zinc-200 shadow-xl whitespace-nowrap">
       Not Interested
      </span>
     </div>

     {/* Watchlist Tooltip & Button */}
     <div className="relative group/tip">
      <button
       type="button"
       onClick={handleWatchlistClick}
       aria-label={isWatchlist ? "In Watchlist" : "Add to Watchlist"}
       className={`rounded-full p-2 transition-all active:scale-90 ${
        isWatchlist
         ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/50'
         : 'bg-black/60 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/90 border border-white/10'
       }`}
       title={isWatchlist ? "In Watchlist (Click to remove)" : "Add to Watchlist"}
      >
       <Bookmark className={`w-3.5 h-3.5 ${isWatchlist ? 'fill-black stroke-black' : ''}`} />
      </button>
      <span className="pointer-events-none absolute top-full mt-1 right-0 z-30 hidden group-hover/tip:inline-flex items-center px-2 py-0.5 rounded bg-zinc-950/95 border border-zinc-700 text-[10px] font-medium text-zinc-200 shadow-xl whitespace-nowrap">
       {isWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
      </span>
     </div>

     {/* Watched Tooltip & Button */}
     <div className="relative group/tip">
      <button
       type="button"
       onClick={handleWatchedClick}
       aria-label={isWatched ? "Marked as watched" : "Mark as watched"}
       className={`rounded-full p-2 transition-all active:scale-90 ${
        isWatched
         ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
         : 'bg-black/60 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/90 border border-white/10'
       }`}
       title={isWatched ? "Watched (Click to remove)" : "Mark as Watched"}
      >
       <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isWatched ? 'text-white' : ''}`} />
      </button>
      <span className="pointer-events-none absolute top-full mt-1 right-0 z-30 hidden group-hover/tip:inline-flex items-center px-2 py-0.5 rounded bg-zinc-950/95 border border-zinc-700 text-[10px] font-medium text-zinc-200 shadow-xl whitespace-nowrap">
       {isWatched ? 'Watched (Undo)' : 'Mark as Watched'}
      </span>
     </div>
    </div>

    {/* Top Left Badges: Media Type & Year */}
    <div className="absolute top-2 left-2 flex items-center gap-1.5">
     {mediaType === 'anime' && (
      <span className="rounded-md bg-indigo-950/80 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-indigo-300 border border-indigo-700/40">
       {movie.is_movie || movie.stream_type === 'movie' ? 'Anime Movie' : 'Anime'}
      </span>
     )}
     {mediaType === 'tv' && (
      <span className="rounded-md bg-purple-950/80 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-300 border border-purple-700/40">
       TV
      </span>
     )}
     {mediaType === 'kdrama' && (
      <span className="rounded-md bg-pink-950/80 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-pink-300 border border-pink-700/40">
       K-Drama
      </span>
     )}
     {movie.year && (
      <span className="rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[11px] font-mono text-zinc-300 border border-white/10">
       {movie.year}
      </span>
     )}
    </div>
   </div>

   {/* Clean Metadata Block */}
   <div className="mt-2.5 flex flex-col gap-1">
    <h3 className="text-sm font-medium text-zinc-100 line-clamp-1 group-hover:text-white transition-colors" title={movie.title}>
     {movie.title}
    </h3>
    <div className="flex items-center justify-between text-xs text-zinc-400">
     <div className="flex items-center gap-1 line-clamp-1 text-[11px] text-zinc-500">
      {movie.genres && movie.genres.length > 0 ? movie.genres.slice(0, 2).join(" • ") : "Cinema"}
     </div>

     {/* Ratings: Rotten Tomatoes 🍅 & IMDb/TMDB ★ */}
     <div className="flex items-center gap-2 font-mono text-[11px]">
      {movie.rotten_tomatoes && (
       <span className="text-rose-400 font-semibold" title="Rotten Tomatoes Score">
        🍅 {movie.rotten_tomatoes}
       </span>
      )}
      {(movie.imdb_rating || movie.vote_average > 0) && (
       <span className="flex items-center gap-0.5 text-amber-400 font-semibold" title="IMDb Rating">
        <Star className="w-3 h-3 fill-amber-400 stroke-none" />
        {movie.imdb_rating || movie.vote_average.toFixed(1)}
       </span>
      )}
     </div>
    </div>
   </div>
  </a>
 );
}
