import React, { useState, useEffect } from 'react';
import { X, Play, Star, Check, Clock, Calendar, Tv, Layers, ExternalLink, Globe } from 'lucide-react';
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

export default function MovieModal({ movie, onClose, onSelectMovie, onShowToast }) {
  const { watchedIds, toggleWatched } = useAuth();
  const [details, setDetails] = useState(null);
  const [credits, setCredits] = useState(null);
  const [trailers, setTrailers] = useState([]);
  const [providers, setProviders] = useState(null);
  const [country, setCountry] = useState('US');
  const [providersLoading, setProvidersLoading] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [showTrailerPlayer, setShowTrailerPlayer] = useState(false);
  const [loading, setLoading] = useState(true);

  const isWatched = watchedIds.has(movie.id);
  const mediaType = movie.media_type || 'movie';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Backdrop Light-Dismiss Click Area */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 my-auto max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close movie details"
          className="absolute top-4 right-4 z-20 rounded-full p-2 bg-black/70 border border-white/10 text-zinc-400 hover:text-white hover:bg-black transition-colors"
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

                {activeTrailer && (
                  <button
                    onClick={() => setShowTrailerPlayer(true)}
                    className="absolute inset-0 m-auto flex items-center justify-center gap-2 w-36 h-12 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white font-medium shadow-xl transition-transform active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Play Trailer
                  </button>
                )}
              </>
            )}
          </div>

          {/* Core Info Section */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
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
                  <p className="text-sm italic text-zinc-400">"{details.tagline}"</p>
                )}

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-zinc-400">
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

              {/* Watched Action Button */}
              <button
                onClick={handleWatchedToggle}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 ${
                  isWatched
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                <Check className={`w-4 h-4 stroke-[2.5] ${isWatched ? 'text-emerald-400' : ''}`} />
                {isWatched ? 'Watched' : 'Mark as Watched'}
              </button>
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
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Top Cast</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {credits.cast.map((actor) => (
                    <div key={actor.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                      {actor.profile_url ? (
                        <img src={actor.profile_url} alt={actor.name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400">
                          {actor.name[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{actor.name}</p>
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
