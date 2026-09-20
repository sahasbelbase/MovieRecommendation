import React, { useState, useEffect } from 'react';
import { X, Play, Star, Check, Bookmark, Clock, Calendar, Tv, Layers, ExternalLink, Globe, EyeOff, Film, ChevronDown, Users, ArrowUpDown, Search, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import MovieCard from './MovieCard';

const COUNTRY_OPTIONS = [
 { code: 'NP', label: '🇳🇵 Nepal' },
 { code: 'US', label: '🇺🇸 United States' },
 { code: 'GB', label: '🇬🇧 United Kingdom' },
 { code: 'CA', label: '🇨🇦 Canada' },
 { code: 'AU', label: '🇦🇺 Australia' },
 { code: 'JP', label: '🇯🇵 Japan' },
 { code: 'KR', label: '🇰🇷 South Korea' },
 { code: 'IN', label: '🇮🇳 India' },
 { code: 'DE', label: '🇩🇪 Germany' },
 { code: 'FR', label: '🇫🇷 France' },
];

const EMBED_SERVERS = [
  {
    id: 'vidlink_pro',
    name: 'Server 1 (VidLink HD ⭐)',
    sandbox: null, // VidLink requires non-sandboxed frame to render player without error
    getUrl: (id, type, s = 1, e = 1) => ['tv', 'anime', 'kdrama'].includes(type)
      ? `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid`
      : `https://vidlink.pro/movie/${id}?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid`
  },
  {
    id: 'vidsrc_sbs',
    name: 'Server 2 (VidSrc)',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-forms',
    getUrl: (id, type, s = 1, e = 1) => ['tv', 'anime', 'kdrama'].includes(type) ? `https://vidsrc.sbs/embed/tv/${id}/${s}/${e}` : `https://vidsrc.sbs/embed/movie/${id}`
  },
  {
    id: 'vidsrc_pro',
    name: 'Server 3 (Pro)',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-forms',
    getUrl: (id, type, s = 1, e = 1) => ['tv', 'anime', 'kdrama'].includes(type) ? `https://vidsrc.pro/embed/tv/${id}/${s}/${e}` : `https://vidsrc.pro/embed/movie/${id}`
  },
  {
    id: 'vidsrc_cc',
    name: 'Server 4 (HD)',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-forms',
    getUrl: (id, type, s = 1, e = 1) => ['tv', 'anime', 'kdrama'].includes(type) ? `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` : `https://vidsrc.cc/v2/embed/movie/${id}`
  },
  {
    id: 'vidsrc_me',
    name: 'Server 5 (Fast)',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-forms',
    getUrl: (id, type, s = 1, e = 1) => ['tv', 'anime', 'kdrama'].includes(type) ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?tmdb=${id}`
  },
];

export default function MovieModal({ movie, onClose, onSelectMovie, onShowToast, onSelectActor, onStartWatchParty, onRequireAuth }) {
 const {
  user,
  watchedIds,
  watchedMovies,
  toggleWatched,
  watchlistIds,
  toggleWatchlist,
  notInterestedIds,
  toggleNotInterested,
  saveReview
 } = useAuth();
 const [details, setDetails] = useState(null);
 const [credits, setCredits] = useState(null);
 const [trailers, setTrailers] = useState([]);
 const [providers, setProviders] = useState(null);
 const [country, setCountry] = useState('US');
 const [providersLoading, setProvidersLoading] = useState(false);
 const [similarItems, setSimilarItems] = useState([]);
 const [showTrailerPlayer, setShowTrailerPlayer] = useState(false);
 const [showStreamPlayer, setShowStreamPlayer] = useState(false);
 const [streamServerIndex, setStreamServerIndex] = useState(0);
 const [selectedSeason, setSelectedSeason] = useState(1);
 const [selectedEpisode, setSelectedEpisode] = useState(1);
 const [seasonData, setSeasonData] = useState(null);
 const [episodesLoading, setEpisodesLoading] = useState(false);
 const [loading, setLoading] = useState(true);

 // Episode sorting, range chunking & search jump for long-running series / anime
 const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
 const [selectedChunkIndex, setSelectedChunkIndex] = useState(0);
 const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');

 const watchedRecord = watchedMovies.find(m => m.id === movie.id);
 const isWatched = watchedIds.has(movie.id);
 const isWatchlist = watchlistIds.has(movie.id);
 const isNotInterested = notInterestedIds?.has(movie.id);
 const mediaType = movie.media_type || 'movie';

 const [userRating, setUserRating] = useState(watchedRecord?.rating || 0);
 const [userReview, setUserReview] = useState(watchedRecord?.review || '');
 const [hoverRating, setHoverRating] = useState(0);
 const [isReviewSaved, setIsReviewSaved] = useState(false);
 const [showReviewInput, setShowReviewInput] = useState(Boolean(watchedRecord?.review));

 useEffect(() => {
  if (watchedRecord) {
   setUserRating(watchedRecord.rating || 0);
   setUserReview(watchedRecord.review || '');
   if (watchedRecord.review) setShowReviewInput(true);
  } else {
   setUserRating(0);
   setUserReview('');
   setShowReviewInput(false);
  }
 }, [watchedRecord]);

 const handleRatingClick = async (score) => {
  setUserRating(score);
  await saveReview(movie, score, userReview);
  setIsReviewSaved(true);
  setTimeout(() => setIsReviewSaved(false), 2500);
  if (onShowToast) {
   onShowToast({
    message: `Rated "${movie.title}" ★ ${score}/10`,
    movie
   });
  }
 };

 const handleSaveReview = async () => {
  await saveReview(movie, userRating, userReview);
  setIsReviewSaved(true);
  setTimeout(() => setIsReviewSaved(false), 2500);
  if (onShowToast) {
   onShowToast({
    message: `Saved review for "${movie.title}"`,
    movie
   });
  }
 };

 const handleNotInterestedToggle = async () => {
  const nowNotInterested = await toggleNotInterested(movie);
  if (onShowToast) {
   onShowToast({
    message: nowNotInterested ? `Marked "${movie.title}" as Not Interested` : `Restored "${movie.title}"`,
    movie
   });
  }
  if (nowNotInterested) {
   onClose();
  }
 };

 // Keyboard shortcut: Escape to close
 useEffect(() => {
  const handleKeyDown = (e) => {
   if (e.key === 'Escape') onClose();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose]);

 // Fetch complete details, credits, trailers, watch providers, and similar items
 useEffect(() => {
  if (!movie?.id) return;
  setLoading(true);
  setShowTrailerPlayer(false);
  setShowStreamPlayer(false);
  setSelectedSeason(1);
  setSelectedEpisode(1);
  setSelectedChunkIndex(0);
  setEpisodeSearchQuery('');

  const fetchData = async () => {
   try {
    const [detailsRes, creditsRes, trailersRes, similarRes] = await Promise.allSettled([
     api.get(`/movies/${movie.id}/details?media_type=${mediaType}`),
     api.get(`/movies/${movie.id}/credits?media_type=${mediaType}`),
     api.get(`/movies/${movie.id}/trailers?media_type=${mediaType}`),
     api.get(`/recommendations/similar/${movie.id}?media_type=${mediaType}`),
    ]);

    if (detailsRes.status === 'fulfilled') setDetails(detailsRes.value.data);
    if (creditsRes.status === 'fulfilled') setCredits(creditsRes.value.data);
    if (trailersRes.status === 'fulfilled') setTrailers(trailersRes.value.data);
    if (similarRes.status === 'fulfilled') setSimilarItems(similarRes.value.data);
   } catch (err) {
    console.error("Error fetching modal media details:", err);
   } finally {
    setLoading(false);
   }
  };

  fetchData();
 }, [movie.id, mediaType]);

 // Dynamically fetch watch providers whenever movie, mediaType, or country changes
 useEffect(() => {
  if (!movie?.id) return;
  let isMounted = true;
  setProvidersLoading(true);

  const fetchProviders = async () => {
   try {
    const encodedTitle = encodeURIComponent(movie.title || details?.title || '');
    const res = await api.get(
     `/movies/${movie.id}/providers?media_type=${mediaType}&country=${country}&title=${encodedTitle}`
    );
    if (isMounted) {
     setProviders(res.data);
    }
   } catch (err) {
    console.error("Error fetching providers for country:", country, err);
   } finally {
    if (isMounted) setProvidersLoading(false);
   }
  };

  fetchProviders();
  return () => {
   isMounted = false;
  };
 }, [movie.id, mediaType, country, movie.title, details?.title]);

 // Dynamically fetch TV Series / Anime Season Episodes for Netflix-style selector
 useEffect(() => {
  if (!movie?.id || !['tv', 'anime', 'kdrama'].includes(mediaType)) return;
  let isMounted = true;
  setEpisodesLoading(true);
  setSelectedChunkIndex(0);
  setEpisodeSearchQuery('');

  const fetchSeasonEpisodes = async () => {
   try {
    const res = await api.get(`/movies/${movie.id}/season/${selectedSeason}`);
    if (isMounted) {
     setSeasonData(res.data);
    }
   } catch (err) {
    console.warn(`Failed fetching season ${selectedSeason} episodes:`, err);
   } finally {
    if (isMounted) setEpisodesLoading(false);
   }
  };

  fetchSeasonEpisodes();
  return () => {
   isMounted = false;
  };
 }, [movie?.id, mediaType, selectedSeason]);

 const activeTrailer = trailers.length > 0 ? trailers[0] : null;

 const handleWatchedToggle = async () => {
  const nowWatched = await toggleWatched(movie);
  if (onShowToast) {
   onShowToast({
    message: nowWatched ? `Marked "${movie.title}" as watched` : `Removed "${movie.title}" from watched`,
    movie
   });
  }
 };

 const handleWatchlistToggle = async () => {
  const nowInWatchlist = await toggleWatchlist(movie);
   if (onShowToast) {
    onShowToast({
     message: nowInWatchlist ? `Added "${movie.title}" to Watchlist` : `Removed "${movie.title}" from Watchlist`,
     movie
    });
   }
  };

  // Episode sorting, range chunking & search filtering for long-running series / anime
 const rawEpisodes = seasonData?.episodes || [];

 const sortedEpisodes = [...rawEpisodes].sort((a, b) => {
  const epA = a.episode_number || 0;
  const epB = b.episode_number || 0;
  return sortOrder === 'desc' ? epB - epA : epA - epB;
 });

 const filteredEpisodes = episodeSearchQuery.trim()
  ? sortedEpisodes.filter(ep => {
      const q = episodeSearchQuery.trim().toLowerCase();
      return (
       ep.episode_number?.toString() === q ||
       ep.episode_number?.toString().includes(q) ||
       ep.name?.toLowerCase().includes(q)
      );
    })
  : sortedEpisodes;

 const CHUNK_SIZE = 50;
 const shouldChunk = sortedEpisodes.length > 30 && !episodeSearchQuery.trim();
 const episodeChunks = [];

 if (shouldChunk) {
  for (let i = 0; i < sortedEpisodes.length; i += CHUNK_SIZE) {
   const chunkEps = sortedEpisodes.slice(i, i + CHUNK_SIZE);
   const minEp = Math.min(...chunkEps.map(e => e.episode_number || 0));
   const maxEp = Math.max(...chunkEps.map(e => e.episode_number || 0));
   const label = sortOrder === 'desc'
    ? `Ep ${maxEp}–${minEp}`
    : `Ep ${minEp}–${maxEp}`;
   episodeChunks.push({
    label: i === 0 && sortOrder === 'desc' ? `${label} (Latest)` : label,
    episodes: chunkEps
   });
  }
 }

 const displayedEpisodes = shouldChunk
  ? (episodeChunks[selectedChunkIndex]?.episodes || sortedEpisodes)
  : filteredEpisodes;

 const latestEpisodeNumber = rawEpisodes.length > 0
  ? Math.max(...rawEpisodes.map(e => e.episode_number || 0))
  : 1;

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
   {/* Backdrop Light-Dismiss Click Area */}
   <div className="fixed inset-0" onClick={onClose} />

   {/* Modal Card */}
   <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
    {/* Close Button */}
    <button
     onClick={onClose}
     className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 rounded-full p-2 bg-black/70 border border-white/10 text-zinc-400 hover:text-white hover:bg-black transition-colors"
    >
     <X className="w-5 h-5" />
    </button>

    {/* Scrollable Content Container */}
    <div className="overflow-y-auto flex-1">
      {/* Backdrop Header / Video Player */}
      <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
       {showStreamPlayer ? (
        <div className="relative w-full h-full bg-black flex flex-col">
         {/* Server Selector Bar */}
         <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-xs z-10">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
           <span className="text-zinc-400 font-mono text-[11px] hidden sm:inline">Stream Server:</span>
           {['tv', 'anime', 'kdrama'].includes(mediaType) && (
            <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-700/50 text-purple-300 font-mono text-[11px] font-bold shrink-0">
             S{selectedSeason} E{selectedEpisode}
            </span>
           )}
           {EMBED_SERVERS.map((srv, idx) => (
            <button
             key={srv.id}
             onClick={() => setStreamServerIndex(idx)}
             className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
              streamServerIndex === idx
               ? 'bg-purple-600 text-white shadow-md'
               : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
             }`}
            >
             {srv.name}
            </button>
           ))}
          </div>
          <button
           onClick={() => setShowStreamPlayer(false)}
           className="text-zinc-400 hover:text-white px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] shrink-0 ml-2"
          >
           Close Stream ✕
          </button>
         </div>

         {/* Stream Player */}
         <div className="relative flex-1 w-full h-full bg-black overflow-hidden">
          <iframe
           key={`${EMBED_SERVERS[streamServerIndex].id}_${movie.id}_s${selectedSeason}_e${selectedEpisode}`}
           src={EMBED_SERVERS[streamServerIndex].getUrl(movie.id, mediaType, selectedSeason, selectedEpisode)}
           title={`${movie.title} Stream`}
           allow="autoplay; encrypted-media; picture-in-picture"
           allowFullScreen
           {...(EMBED_SERVERS[streamServerIndex].sandbox ? { sandbox: EMBED_SERVERS[streamServerIndex].sandbox } : {})}
           className="w-full h-full border-0"
          />
         </div>
        </div>
       ) : showTrailerPlayer && activeTrailer ? (
        <iframe
         src={`${activeTrailer.embed_url}?autoplay=1`}
         title={activeTrailer.name}
         allow="autoplay; encrypted-media"
         allowFullScreen
         className="w-full h-full border-0"
        />
       ) : (
        <>
         <img
          src={details?.backdrop_url || movie.backdrop_url || movie.poster_url}
          alt={movie.title}
          className="w-full h-full object-cover opacity-60"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
         <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
           onClick={() => {
            if (!user) {
             if (onRequireAuth) onRequireAuth();
             if (onShowToast) onShowToast({ message: 'Please sign in to stream full titles' });
             return;
            }
            setShowTrailerPlayer(false);
            setShowStreamPlayer(true);
           }}
           className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/60 transition-all active:scale-95"
          >
           <Play className="w-4 h-4 fill-white" />
           <span>
            {['tv', 'anime', 'kdrama'].includes(mediaType)
             ? `Play S${selectedSeason} E${selectedEpisode}`
             : 'Play Stream'}
           </span>
          </button>
          {activeTrailer && (
           <button
            onClick={() => {
             setShowStreamPlayer(false);
             setShowTrailerPlayer(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-white text-xs sm:text-sm font-semibold shadow-lg transition-all active:scale-95"
           >
            <Film className="w-4 h-4 text-rose-400" />
            <span>Trailer</span>
           </button>
          )}
          <button
           onClick={() => {
            if (onStartWatchParty) {
             onStartWatchParty(movie);
            }
           }}
           className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-amber-950/60 transition-all active:scale-95"
          >
           <Users className="w-4 h-4 text-amber-100" />
           <span>Watch Party</span>
          </button>
         </div>
        </>
       )}
      </div>

     {/* Core Info Section */}
     <div className="p-4 sm:p-8 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
       <div className="space-y-1.5 flex-1">
        <div className="flex items-center gap-2">
         <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-white">
          {details?.title || movie.title}
         </h2>
         {mediaType === 'anime' && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/40">
           Anime
          </span>
         )}
         {mediaType === 'tv' && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-950/80 text-purple-300 border border-purple-700/40">
           TV Series
          </span>
         )}
        </div>

        {details?.tagline && (
         <p className="text-xs sm:text-sm italic text-zinc-400">"{details.tagline}"</p>
        )}

        {/* Metadata Pills */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1 sm:pt-2 text-xs font-mono text-zinc-400">
         {movie.year && (
          <span className="flex items-center gap-1">
           <Calendar className="w-3.5 h-3.5" />
           {movie.year}
          </span>
         )}

         {/* TV Seasons and Episodes */}
         {details?.seasons_count && (
          <span className="flex items-center gap-1 text-purple-300 font-semibold">
           <Layers className="w-3.5 h-3.5" />
           {details.seasons_count} {details.seasons_count === 1 ? 'Season' : 'Seasons'}
           {details.episodes_count ? ` (${details.episodes_count} eps)` : ''}
          </span>
         )}

         {details?.runtime > 0 &&!details?.seasons_count && (
          <span className="flex items-center gap-1">
           <Clock className="w-3.5 h-3.5" />
           {details.runtime} min
          </span>
         )}

          {/* Rotten Tomatoes Badge */}
          {(details?.rotten_tomatoes || movie.rotten_tomatoes) && (
           <span className="flex items-center gap-1 text-rose-400 font-semibold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40 font-mono text-[11px]">
            Rotten Tomatoes {details?.rotten_tomatoes || movie.rotten_tomatoes}%
           </span>
          )}

         {/* IMDb / Critic Rating */}
         {(details?.imdb_rating || movie.imdb_rating || movie.vote_average > 0) && (
          <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
           <Star className="w-3.5 h-3.5 fill-amber-400 stroke-none" />
           IMDb {details?.imdb_rating || movie.imdb_rating || movie.vote_average.toFixed(1)} / 10
          </span>
         )}

         {details?.networks?.length > 0 && (
          <span className="text-zinc-300 font-sans">
           Network: <strong className="text-white">{details.networks.join(", ")}</strong>
          </span>
         )}

         {credits?.directors?.length > 0 && (
          <span className="text-zinc-400 font-sans">
           Creator: <strong className="text-zinc-200">{credits.directors.join(", ")}</strong>
          </span>
         )}
        </div>
       </div>

       {/* Watchlist, Watched & Not Interested Actions */}
       <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
        <button
         onClick={handleNotInterestedToggle}
         className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all active:scale-95 ${
          isNotInterested
           ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 hover:bg-rose-500/30'
           : 'bg-zinc-900 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 border border-zinc-700'
         }`}
         title={isNotInterested ? "Remove from Not Interested" : "Not Interested (Hide everywhere)"}
        >
         <EyeOff className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isNotInterested ? 'text-rose-400' : ''}`} />
         <span className="hidden xs:inline">Not Interested</span>
         <span className="xs:hidden">Hide</span>
        </button>

        <button
         onClick={handleWatchlistToggle}
         className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all active:scale-95 ${
          isWatchlist
           ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
           : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-700'
         }`}
         title={isWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
        >
         <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isWatchlist ? 'fill-amber-400 text-amber-400' : ''}`} />
         <span className="hidden xs:inline">{isWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
         <span className="xs:hidden">{isWatchlist ? 'Saved' : 'Watchlist'}</span>
        </button>

        <button
         onClick={handleWatchedToggle}
         className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all active:scale-95 ${
          isWatched
           ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30'
           : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
         }`}
        >
         <Check className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0 ${isWatched ? 'text-emerald-400' : ''}`} />
         <span className="hidden xs:inline">{isWatched ? 'Watched' : 'Mark Watched'}</span>
         <span className="xs:hidden">{isWatched ? 'Watched' : 'Watched'}</span>
        </button>
       </div>
      </div>

      {/* Rate & Review Hub (In-App Rating External IMDb & Letterboxd Review Portals) */}
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-900/90 border border-zinc-800 p-4 sm:p-5 space-y-4 shadow-xl">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="space-y-0.5">
         <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">
           {isWatched ? 'Your Review & Rating' : 'Leave a Review & Rate'}
          </h3>
          {userRating > 0 && (
           <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
            ★ {userRating} / 10
           </span>
          )}
         </div>
         <p className="text-xs text-zinc-400">
          Rate here or publish your review directly to IMDb and Letterboxd.
         </p>
        </div>

        {/* External Review Platforms */}
        <div className="flex items-center gap-2">
         <a
          href={`https://letterboxd.com/search/${encodeURIComponent(movie.title || details?.title || '')}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#202830] hover:bg-[#2c3742] text-white text-xs font-semibold border border-[#3b4c5e] transition-all hover:scale-105 active:scale-95 shadow-sm"
          title="Open on Letterboxd to log & review"
         >
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-orange-400 to-blue-400" />
          <span>Letterboxd</span>
          <ExternalLink className="w-3 h-3 text-zinc-400" />
         </a>

         <a
          href={
           details?.imdb_id || movie.imdb_id
            ? `https://www.imdb.com/title/${details?.imdb_id || movie.imdb_id}/reviews`
            : `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title || details?.title || '')}&s=tt`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5C518] hover:bg-[#e0b414] text-black text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
          title="Open on IMDb to write a review"
         >
          <span>IMDb Reviews</span>
          <ExternalLink className="w-3 h-3 text-black/70" />
         </a>
        </div>
       </div>

       {/* Interactive 1 to 10 Star Rating Selector */}
       <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
         <span>Score this title (1 to 10):</span>
         {hoverRating > 0 ? (
          <span className="text-amber-300 font-mono font-semibold">★ {hoverRating} / 10</span>
         ) : userRating > 0 ? (
          <span className="text-amber-400 font-mono font-semibold">★ {userRating} / 10</span>
         ) : (
          <span className="text-zinc-500">Tap a score</span>
         )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 no-scrollbar">
         {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
          <button
           key={star}
           type="button"
           onClick={() => handleRatingClick(star)}
           onMouseEnter={() => setHoverRating(star)}
           onMouseLeave={() => setHoverRating(0)}
           className={`flex-1 min-w-[28px] py-1.5 px-1 rounded-lg text-xs font-mono font-bold transition-all active:scale-90 text-center ${
            (hoverRating || userRating) >= star
             ? 'bg-amber-500 text-black shadow-md shadow-amber-950/50'
             : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700/50'
           }`}
           title={`Rate ${star}/10`}
          >
           {star}
          </button>
         ))}
        </div>
       </div>

       {/* In-App Personal Review Notes Field */}
       <div className="space-y-2 pt-1">
        {!showReviewInput &&!userReview ? (
         <button
          onClick={() => setShowReviewInput(true)}
          className="text-xs text-zinc-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
         >
          <span>+ Write a review or add personal notes</span>
         </button>
        ) : (
         <div className="space-y-2">
          <textarea
           value={userReview}
           onChange={(e) => setUserReview(e.target.value)}
           placeholder="Write your review, memorable quotes, or personal notes here..."
           rows={3}
           className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 resize-none transition-all"
          />
          <div className="flex items-center justify-between">
           <span className="text-[11px] text-zinc-500">
            {isReviewSaved ? '✓ Saved to your library & Google Drive' : 'Syncs automatically across devices & cloud'}
           </span>
           <button
            onClick={handleSaveReview}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all active:scale-95 shadow"
           >
            {isReviewSaved ? 'Saved!' : 'Save Review'}
           </button>
          </div>
         </div>
        )}
       </div>
      </div>

      {/* Genres */}
      <div className="flex flex-wrap gap-2">
       {(details?.genres || movie.genres || []).map((genre) => (
        <span
         key={genre}
         className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300"
        >
         {genre}
        </span>
       ))}
      </div>

      {/* Synopsis / Overview */}
      <div className="space-y-2">
       <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Overview</h4>
       <p className="text-sm leading-relaxed text-zinc-300">
        {details?.overview || movie.overview || "No synopsis available for this title."}
       </p>
      </div>

      {/* TV Series, Anime & K-Drama Episodes Browser with Fast Sort, Range Chunks & Jump Search */}
      {['tv', 'anime', 'kdrama'].includes(mediaType) && (
       <div className="space-y-4 pt-4 pb-2 border-t border-b border-zinc-800/80">
        {/* Header & Quick Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80">
         {/* Season Selector & Play Latest Button */}
         <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-1">
           <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Layers className="w-4 h-4" />
           </div>
           <span className="text-xs font-bold text-white uppercase tracking-wider hidden sm:inline">Episodes</span>
          </div>

          <div className="relative">
           <select
            value={selectedSeason}
            onChange={(e) => {
             setSelectedSeason(Number(e.target.value));
             setSelectedEpisode(1);
             setSelectedChunkIndex(0);
             setEpisodeSearchQuery('');
            }}
            className="appearance-none bg-zinc-950 border border-zinc-700 hover:border-purple-500/60 text-white text-xs sm:text-sm font-bold rounded-xl pl-3.5 pr-9 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer shadow-md transition-all"
           >
            {(details?.seasons?.length > 0
             ? details.seasons
             : Array.from({ length: details?.seasons_count || 1 }, (_, i) => ({
                season_number: i + 1,
                name: `Season ${i + 1}`,
                episode_count: 0
               }))
            ).map((s) => (
             <option key={s.season_number} value={s.season_number}>
              {s.name || `Season ${s.season_number}`} {s.episode_count ? `(${s.episode_count} eps)` : ''}
             </option>
            ))}
           </select>
           <ChevronDown className="w-4 h-4 text-purple-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Play Latest Episode */}
          {rawEpisodes.length > 0 && (
           <button
            onClick={() => {
             if (!user) {
              if (onRequireAuth) onRequireAuth();
              if (onShowToast) onShowToast({ message: 'Please sign in to stream' });
              return;
             }
             setSelectedEpisode(latestEpisodeNumber);
             setShowTrailerPlayer(false);
             setShowStreamPlayer(true);
             const container = document.querySelector('.overflow-y-auto');
             if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all active:scale-95 shadow-sm"
            title={`Play latest episode (${latestEpisodeNumber})`}
           >
            <Zap className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
            <span>Play Latest (Ep {latestEpisodeNumber})</span>
           </button>
          )}
         </div>

         {/* Sort Toggle & Episode Jump Search Input */}
         <div className="flex items-center gap-2 self-stretch md:self-auto">
          {/* Sort Order Toggle */}
          <button
           onClick={() => {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
            setSelectedChunkIndex(0);
           }}
           className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 hover:border-purple-500/50 text-zinc-300 hover:text-white text-xs font-medium transition-all shrink-0"
           title={sortOrder === 'desc' ? "Showing newest episodes first" : "Showing oldest episodes first"}
          >
           <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
           <span className="font-mono text-[11px]">{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>

          {/* Jump to Episode Search */}
          <div className="relative flex-1 sm:w-44">
           <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
           <input
            type="text"
            placeholder="Jump to Ep #..."
            value={episodeSearchQuery}
            onChange={(e) => {
             setEpisodeSearchQuery(e.target.value);
             setSelectedChunkIndex(0);
            }}
            className="w-full bg-zinc-950 border border-zinc-700 text-white text-xs rounded-xl pl-8 pr-7 py-2 focus:outline-none focus:border-purple-500/60 placeholder-zinc-500 font-mono transition-all"
           />
           {episodeSearchQuery && (
            <button
             onClick={() => setEpisodeSearchQuery('')}
             className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
            >
             ✕
            </button>
           )}
          </div>
         </div>
        </div>

        {/* Episode Range Chunks / Tabs (Shown when season has > 30 episodes and no search filter) */}
        {shouldChunk && episodeChunks.length > 1 && (
         <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
           <span>Select Episode Range ({rawEpisodes.length} total):</span>
           <span>Batch {selectedChunkIndex + 1} of {episodeChunks.length}</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
           {episodeChunks.map((chunk, idx) => (
            <button
             key={chunk.label}
             onClick={() => setSelectedChunkIndex(idx)}
             className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap transition-all ${
              selectedChunkIndex === idx
               ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50 border border-purple-400/30'
               : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
             }`}
            >
             {chunk.label}
            </button>
           ))}
          </div>
         </div>
        )}

        {/* Episode Cards List */}
        {episodesLoading ? (
         <div className="space-y-3">
          {[1, 2, 3].map((i) => (
           <div key={i} className="h-24 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 animate-pulse p-3 flex gap-4">
            <div className="w-36 aspect-video bg-zinc-800/60 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2 py-1">
             <div className="h-4 w-1/3 bg-zinc-800/60 rounded" />
             <div className="h-3 w-2/3 bg-zinc-800/40 rounded" />
            </div>
           </div>
          ))}
         </div>
        ) : displayedEpisodes.length > 0 ? (
         <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-purple-600">
          {displayedEpisodes.map((ep) => {
           const isSelected = selectedSeason === ep.season_number && selectedEpisode === ep.episode_number;
           return (
            <div
             key={ep.id || ep.episode_number}
             onClick={() => {
              if (!user) {
               if (onRequireAuth) onRequireAuth();
               if (onShowToast) onShowToast({ message: 'Please sign in to stream full episodes' });
               return;
              }
              setSelectedEpisode(ep.episode_number);
              setShowTrailerPlayer(false);
              setShowStreamPlayer(true);
              const container = document.querySelector('.overflow-y-auto');
              if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
             }}
             className={`group flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3 rounded-2xl border transition-all cursor-pointer ${
              isSelected
               ? 'bg-purple-950/40 border-purple-500/70 shadow-lg shadow-purple-950/30'
               : 'bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800/80 hover:border-zinc-700'
             }`}
            >
             {/* Thumbnail */}
             <div className="relative w-full sm:w-40 aspect-video rounded-xl overflow-hidden shrink-0 bg-zinc-950 shadow-inner">
              {ep.still_url ? (
               <img
                src={ep.still_url}
                alt={ep.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
               />
              ) : (
               <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900 p-2 text-center">
                <Tv className="w-6 h-6 mb-1 text-zinc-700" />
                <span className="text-[10px] font-mono">Episode {ep.episode_number}</span>
               </div>
              )}
              {/* Play Overlay */}
              <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
               isSelected ? 'opacity-100 bg-purple-950/60' : 'opacity-0 group-hover:opacity-100'
              }`}>
               <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                isSelected ? 'bg-purple-600 text-white scale-110' : 'bg-white/90 text-black group-hover:scale-110'
               }`}>
                <Play className="w-4 h-4 fill-current translate-x-0.5" />
               </div>
              </div>
              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono font-bold text-white border border-white/10">
               E{ep.episode_number}
              </span>
             </div>

             {/* Episode Details */}
             <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
               <h5 className={`text-xs sm:text-sm font-bold transition-colors ${
                isSelected ? 'text-purple-300' : 'text-white group-hover:text-purple-300'
               }`}>
                {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
               </h5>
               <div className="flex items-center gap-2">
                {ep.vote_average > 0 && (
                 <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                  <Star className="w-3 h-3 fill-amber-400 stroke-none" />
                  {ep.vote_average.toFixed(1)}
                 </span>
                )}
                {ep.runtime > 0 && (
                 <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  {ep.runtime}m
                 </span>
                )}
               </div>
              </div>

              {ep.overview && (
               <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                {ep.overview}
               </p>
              )}

              <div className="flex items-center justify-between pt-0.5 text-[11px] text-zinc-500 font-mono">
               {ep.air_date ? <span>Aired: {ep.air_date}</span> : <span />}
               <span className={`font-semibold ${isSelected ? 'text-purple-400' : 'text-zinc-400 group-hover:text-purple-300'}`}>
                {isSelected ? 'Playing Now' : 'Click to Stream'}
               </span>
              </div>
             </div>
            </div>
           );
          })}
         </div>
        ) : (
         <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-2">
          <p className="text-xs text-zinc-400 font-mono">
           {episodeSearchQuery ? `No episodes found matching "${episodeSearchQuery}"` : `Season ${selectedSeason} details ready for streaming.`}
          </p>
          <button
           onClick={() => {
            if (!user) {
             if (onRequireAuth) onRequireAuth();
             if (onShowToast) onShowToast({ message: 'Please sign in to stream full episodes' });
             return;
            }
            setShowStreamPlayer(true);
           }}
           className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition-colors shadow-lg shadow-purple-950/50"
          >
           Play Season {selectedSeason} Stream
          </button>
         </div>
        )}
       </div>
      )}

      {/* Streaming Availability (Where to Stream & Direct Platform Access) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-lg">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
         <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <Tv className="w-4 h-4" />
         </div>
         <div>
          <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
           Where to Stream & Watch
           {providersLoading && <span className="text-[11px] font-normal text-zinc-500 animate-pulse">Checking streams...</span>}
          </h3>
          <p className="text-[11px] text-zinc-400">Direct streaming access & platform launch links</p>
         </div>
        </div>

        {/* Country / Region Selector */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
         <Globe className="w-3.5 h-3.5 text-zinc-400" />
         <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-rose-500 font-medium cursor-pointer"
         >
          {COUNTRY_OPTIONS.map((c) => (
           <option key={c.code} value={c.code}>
            {c.label}
           </option>
          ))}
         </select>
        </div>
       </div>

       {/* Subscription Streaming (Flatrate) */}
       {providers?.flatrate?.length > 0 && (
        <div className="space-y-2">
         <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Included with Subscription
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {providers.flatrate.map((p) => (
           <a
            key={p.id || p.name}
            href={p.direct_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-rose-500/60 hover:bg-zinc-900 transition-all shadow-sm active:scale-95"
           >
            <div className="flex items-center gap-2.5 min-w-0">
             {p.logo_url ? (
              <img src={p.logo_url} alt={p.name} className="w-6 h-6 rounded-md shadow-sm shrink-0 object-cover" />
             ) : (
              <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
               {p.name[0]}
              </div>
             )}
             <span className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
              {p.name}
             </span>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400 group-hover:text-rose-300 shrink-0">
             Watch
             <ExternalLink className="w-3 h-3" />
            </span>
           </a>
          ))}
         </div>
        </div>
       )}

       {/* Free With Ads */}
       {providers?.free?.length > 0 && (
        <div className="space-y-2">
         <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Free With Ads
         </div>
         <div className="flex flex-wrap gap-2">
          {providers.free.map((p) => (
           <a
            key={p.id || p.name}
            href={p.direct_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-cyan-500/40 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
           >
            {p.logo_url && <img src={p.logo_url} alt={p.name} className="w-4 h-4 rounded" />}
            <span>{p.name}</span>
            <ExternalLink className="w-3 h-3 text-cyan-400" />
           </a>
          ))}
         </div>
        </div>
       )}

       {/* Rent or Buy */}
       {(providers?.rent?.length > 0 || providers?.buy?.length > 0) && (
        <div className="space-y-1.5">
         <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
          Rent or Buy
         </span>
         <div className="flex flex-wrap gap-2">
          {[...(providers.rent || []),...(providers.buy || [])]
           .filter((v, i, a) => a.findIndex(t => t.name === v.name) === i)
           .slice(0, 6)
           .map((p) => (
            <a
             key={p.name}
             href={p.direct_url}
             target="_blank"
             rel="noopener noreferrer"
             className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/90 border border-zinc-800/90 hover:border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
             {p.logo_url && <img src={p.logo_url} alt={p.name} className="w-3.5 h-3.5 rounded opacity-80" />}
             <span>{p.name}</span>
             <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
            </a>
           ))}
         </div>
        </div>
       )}

       {/* Direct Platform Quick Launch Links */}
       {(!providers?.flatrate || providers.flatrate.length === 0) && providers?.quick_search_links?.length > 0 && (
        <div className="space-y-2 pt-1">
         <p className="text-xs text-zinc-400">
          Not currently included in standard {country} subscriptions. Check availability or launch directly:
         </p>
         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {providers.quick_search_links.map((qs) => (
           <a
            key={qs.name}
            href={qs.direct_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-xs font-medium text-zinc-300 transition-all"
           >
            <span className="truncate group-hover:text-white">{qs.name}</span>
            <span className="text-[10px] text-zinc-500 group-hover:text-rose-400 flex items-center gap-0.5">
             Launch
             <ExternalLink className="w-2.5 h-2.5" />
            </span>
           </a>
          ))}
         </div>
        </div>
       )}

       {/* Attribution */}
       <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40 text-[11px] text-zinc-500">
        <span>Streaming availability updated dynamically</span>
        <span className="font-mono text-zinc-600">Region: {country}</span>
       </div>
      </div>

      {/* Top Cast */}
      {credits?.cast?.length > 0 && (
       <div className="space-y-3">
        <div className="flex items-center justify-between">
         <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Top Cast</h4>
         {onSelectActor && (
          <span className="text-[11px] text-zinc-500 font-mono">Click actor for filmography</span>
         )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
         {credits.cast.map((actor) => (
          <div
           key={actor.id}
           onClick={() => onSelectActor && onSelectActor(actor)}
           className={`flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50 ${
            onSelectActor ? 'cursor-pointer hover:border-amber-500/50 hover:bg-zinc-900 transition-all group' : ''
           }`}
           title={onSelectActor ? `View filmography for ${actor.name}` : actor.name}
          >
           {actor.profile_url ? (
            <img src={actor.profile_url} alt={actor.name} className="w-9 h-9 rounded-full object-cover" />
           ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400">
             {actor.name[0]}
            </div>
           )}
           <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-200 group-hover:text-amber-400 transition-colors truncate">
             {actor.name}
            </p>
            <p className="text-[11px] text-zinc-500 truncate">{actor.character}</p>
           </div>
          </div>
         ))}
        </div>
       </div>
      )}

      {/* Similar Movies / Series / Anime (Excluding Watched) */}
      {similarItems.length > 0 && (
       <div className="space-y-3 pt-4 border-t border-zinc-800/80">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
         Similar {mediaType === 'anime' ? 'Anime' : mediaType === 'tv' ? 'Series' : 'Movies'} (Watched Excluded)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
         {similarItems.slice(0, 4).map((simItem) => (
          <MovieCard
           key={simItem.id}
           movie={simItem}
           onSelect={(m) => onSelectMovie(m)}
           onShowToast={onShowToast}
          />
         ))}
        </div>
       </div>
      )}
     </div>
    </div>
   </div>
  </div>
 );
}
