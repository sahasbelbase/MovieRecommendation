import React from 'react';
import { Star, Check, Bookmark, Film, Tv, EyeOff, Play, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MovieCard({ movie, onSelect, onShowToast, isVip = false }) {
 const { user, watchedIds, toggleWatched, watchlistIds, toggleWatchlist, notInterestedIds, toggleNotInterested } = useAuth();
 const isWatched = watchedIds.has(movie.id);
 const isWatchlist = watchlistIds.has(movie.id);
 const isNotInterested = notInterestedIds?.has(movie.id);

 const handleWatchedClick = async (e) => {
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

 const mediaType = movie.media_type || 'movie';

 return (
  <div
   onClick={() => onSelect(movie)}
   className="group relative flex flex-col rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-2.5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900 hover:scale-[1.03] cursor-pointer shadow-sm hover:shadow-xl"
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

    {/* Netflix-Style 1-Click Hover Action Overlay */}
    <div className="absolute inset-x-0 bottom-0 top-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end gap-2 p-3 z-20 pointer-events-none group-hover:pointer-events-auto rounded-b-lg">
     {user && isVip ? (
      <div className="w-full flex items-center gap-2">
       <button
        onClick={(e) => {
         e.stopPropagation();
         onSelect(movie, true);
        }}
        className="flex-1 py-1.5 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60 transition-transform active:scale-95"
       >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Play</span>
       </button>
       <button
        onClick={(e) => {
         e.stopPropagation();
         onSelect(movie, false);
        }}
        className="py-1.5 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1 border border-zinc-700/60 transition-transform active:scale-95"
       >
        <Info className="w-3.5 h-3.5" />
        <span>Details</span>
       </button>
      </div>
     ) : (
      <button
       onClick={(e) => {
        e.stopPropagation();
        onSelect(movie, false);
       }}
       className="w-full py-1.5 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-zinc-700/60 transition-transform active:scale-95"
      >
       <Info className="w-3.5 h-3.5" />
       <span>Details</span>
      </button>
     )}
    </div>

    {/* Quick Actions: Not Interested, Watchlist & Watched (z-30 ensures top layer clickability) */}
    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-30">
     {/* Not Interested Tooltip & Button */}
     <div className="relative group/tip">
      <button
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
       Anime
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
  </div>
 );
}
