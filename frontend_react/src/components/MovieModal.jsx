import React, { useState, useEffect } from 'react';
import { X, Play, Star, Check, Bookmark, Clock, Calendar, Tv, Layers, ExternalLink, Globe, EyeOff } from 'lucide-react';
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

export default function MovieModal({ movie, onClose, onSelectMovie, onShowToast, onSelectActor }) {
  const {
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
  const [loading, setLoading] = useState(true);

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
            {showTrailerPlayer && activeTrailer ? (
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
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex items-center gap-3">
                  {activeTrailer && (
                    <button
                      onClick={() => setShowTrailerPlayer(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-rose-950/60 transition-all active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Watch Official Trailer</span>
                    </button>
                  )}
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

                  {details?.runtime > 0 && !details?.seasons_count && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {details.runtime} min
                    </span>
                  )}

                  {/* Rotten Tomatoes Badge */}
                  {(details?.rotten_tomatoes || movie.rotten_tomatoes) && (
                    <span className="flex items-center gap-1 text-rose-400 font-semibold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                      🍅 {details?.rotten_tomatoes || movie.rotten_tomatoes} Rotten Tomatoes
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

            {/* Rate & Review Hub (In-App Rating + External IMDb & Letterboxd Review Portals) */}
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
                {!showReviewInput && !userReview ? (
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
                    {[...(providers.rent || []), ...(providers.buy || [])]
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
