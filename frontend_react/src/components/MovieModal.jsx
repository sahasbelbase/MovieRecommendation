import React, { useState, useEffect, useMemo } from 'react';
import { X, Play, Star, Check, Bookmark, Clock, Calendar, Tv, Layers, ExternalLink, Globe, EyeOff, Film, ChevronDown, Users, ArrowUpDown, Search, Zap, Lock, SkipBack, SkipForward, Sparkles, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import MovieCard from './MovieCard';
import TvVideoPlayer from './TvVideoPlayer';
import { getItemProgress, saveContinueWatchingProgress } from '../services/continueWatching';

const isTv = typeof window !== 'undefined' && (
  Boolean(window.Capacitor) ||
  /TV|SmartTV|GoogleTV|AndroidTV|CrKey/i.test(navigator.userAgent)
);

const COUNTRY_OPTIONS = [
 { code: 'NP', label: 'Nepal' },
 { code: 'US', label: 'United States' },
 { code: 'GB', label: 'United Kingdom' },
 { code: 'CA', label: 'Canada' },
 { code: 'AU', label: 'Australia' },
 { code: 'JP', label: 'Japan' },
 { code: 'KR', label: 'South Korea' },
 { code: 'IN', label: 'India' },
 { code: 'DE', label: 'Germany' },
 { code: 'FR', label: 'France' },
];

export function formatTimeAgo(dateString) {
  if (!dateString) return null;
  const iso = dateString.replace(' ', 'T') + (dateString.includes('Z') ? '' : 'Z');
  const past = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

const EMBED_SERVERS = [
  {
    id: 'vidlink_hd',
    name: 'Server 1 (VidLink HD)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1, audio = 'sub') => type === 'tv'
      ? `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid${audio === 'dub' ? '&dub=1' : ''}`
      : `https://vidlink.pro/movie/${id}?primaryColor=a855f7&secondaryColor=18181b&iconColor=ffffff&icons=vid`
  },
  {
    id: 'autoembed',
    name: 'Server 2 (AutoEmbed Multi)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1) => type === 'tv'
      ? `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
      : `https://player.autoembed.cc/embed/movie/${id}`
  },
  {
    id: 'vidsrc_cc',
    name: 'Server 3 (VidSrc CC)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1) => type === 'tv'
      ? `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
      : `https://vidsrc.cc/v2/embed/movie/${id}`
  },
  {
    id: 'embed_su',
    name: 'Server 4 (Embed SU)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1) => type === 'tv'
      ? `https://embed.su/embed/tv/${id}/${s}/${e}`
      : `https://embed.su/embed/movie/${id}`
  },
  {
    id: 'vidsrc_to',
    name: 'Server 5 (VidSrc TO)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1) => type === 'tv'
      ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
      : `https://vidsrc.to/embed/movie/${id}`
  },
  {
    id: 'vidsrc_sh',
    name: 'Server 6 (VidSrc SH)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1) => type === 'tv'
      ? `https://vidsrc.sh/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
      : `https://vidsrc.sh/embed/movie?tmdb=${id}`
  },
  {
    id: 'embed_2cc',
    name: 'Server 7 (2Embed)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1) => type === 'tv'
      ? `https://2embed.cc/embedtv/${id}&s=${s}&e=${e}`
      : `https://2embed.cc/embed/${id}`
  },
  {
    id: 'vidsrc_pro',
    name: 'Server 8 (VidSrc Pro)',
    sandbox: null,
    getUrl: (id, type, s = 1, e = 1) => type === 'tv'
      ? `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`
      : `https://vidsrc.pro/embed/movie/${id}`
  },
];

export default function MovieModal({ isVip, onActivateVip, onDeactivateVip, movie, onClose, onSelectMovie, onShowToast, onSelectActor, onStartWatchParty, onRequireAuth, autoPlayStream = false, isFullPage = false }) {
 const movieId = movie?.id || movie?.item_id || movie?.tmdb_id || movie?.movieId;
 if (!movie || !movieId) return null;

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
 const [showStreamPlayer, setShowStreamPlayer] = useState(Boolean(autoPlayStream && user && isVip));
 const [showTvDirectTestPlayer, setShowTvDirectTestPlayer] = useState(false);
 const [streamServerIndex, setStreamServerIndex] = useState(0);
 const [userSelectedServer, setUserSelectedServer] = useState(false);
 const [anikotoData, setAnikotoData] = useState(null);
 const [anikotoLoading, setAnikotoLoading] = useState(false);
 const [autoPlayNext, setAutoPlayNext] = useState(() => {
  try {
   return localStorage.getItem('cinematch_autoplay_next') !== 'false';
  } catch {
   return true;
  }
 });
 const [showWatchNextCountdown, setShowWatchNextCountdown] = useState(false);
 const [countdownSeconds, setCountdownSeconds] = useState(10);
 const [streamStatusData, setStreamStatusData] = useState(null);
 const [checkingStreamStatus, setCheckingStreamStatus] = useState(false);
 const [selectedSeason, setSelectedSeason] = useState(1);
 const [selectedEpisode, setSelectedEpisode] = useState(movie?.latest_episode || movie?.target_episode || 1);
 const [seasonData, setSeasonData] = useState(null);
 const [episodesLoading, setEpisodesLoading] = useState(false);
 const [loading, setLoading] = useState(true);
 const [resumeProgress, setResumeProgress] = useState(() => getItemProgress(movieId));

 // Reset modal states on movie selection change to prevent stale render flashes
 useEffect(() => {
  setDetails(null);
  setCredits(null);
  setTrailers([]);
  setProviders(null);
  setSeasonData(null);
  setStreamStatusData(null);
  setStreamServerIndex(0);
  setUserSelectedServer(false);
  setAnikotoData(null);
  const savedProgress = getItemProgress(movieId);
  setResumeProgress(savedProgress);
  if (savedProgress?.season) {
   setSelectedSeason(savedProgress.season);
  } else {
   setSelectedSeason(1);
  }
  if (savedProgress?.episode) {
   setSelectedEpisode(savedProgress.episode);
  } else {
   setSelectedEpisode(movie?.latest_episode || movie?.target_episode || 1);
  }
  setShowWatchNextCountdown(false);
  setCountdownSeconds(10);
  setShowTrailerPlayer(false);
  setShowStreamPlayer(Boolean(autoPlayStream && user && isVip));
 }, [movieId, autoPlayStream, user, isVip, movie?.latest_episode, movie?.target_episode]);

 // Synchronize playback status to Continue Watching store
 useEffect(() => {
  if (showStreamPlayer && movie && movieId) {
   saveContinueWatchingProgress({
    id: movieId,
    title: movie.title || details?.title,
    poster_url: movie.poster_url || details?.poster_url || movie.poster,
    backdrop_url: movie.backdrop_url || details?.backdrop_url,
    media_type: mediaType,
    is_series: isSeries,
    season: isSeries ? selectedSeason : null,
    episode: isSeries ? selectedEpisode : null,
    percent: resumeProgress?.percent || 50,
    user_id: user?.uid,
   });
  }
 }, [showStreamPlayer, selectedSeason, selectedEpisode, movieId, isSeries, mediaType, user?.uid]);

  const [tvVolumeInfo, setTvVolumeInfo] = useState(null);

  // Volume Synchronization Listener for Smart TV mode
  useEffect(() => {
   const handleVolumeChange = (e) => {
    const { volume, isMuted } = e.detail || {};
    setTvVolumeInfo({ volume, isMuted });
    setTimeout(() => setTvVolumeInfo(null), 3500);
   };

   window.addEventListener('tv:volume_change', handleVolumeChange);
   return () => window.removeEventListener('tv:volume_change', handleVolumeChange);
  }, []);

  // Episode sorting, range chunking & search jump for long-running series / anime
 const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
 const [selectedChunkIndex, setSelectedChunkIndex] = useState(0);
 const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');
 const [audioTrack, setAudioTrack] = useState('sub'); // 'sub' | 'dub'

 const watchedRecord = watchedMovies.find(m => (m.id || m.tmdb_id || m.item_id) === movieId);
 const isWatched = watchedIds.has(movieId);
 const isWatchlist = watchlistIds.has(movieId);
 const isNotInterested = notInterestedIds?.has(movieId);
 const initialMediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
 const effectiveMediaType = details?.media_type || initialMediaType;
 const mediaType = effectiveMediaType;

 // Accurately determine whether this title is an episodic series (TV show / Anime TV series / K-Drama series)
 // or a standalone movie (Feature film / Anime movie).
 const isSeries = (() => {
  // 1. Explicit flags from backend if available
  if (details?.is_movie === true || movie?.is_movie === true) return false;
  if (details?.stream_type === 'movie' || movie?.stream_type === 'movie') return false;
  if (details?.is_series === true || movie?.is_series === true) return true;
  if (details?.stream_type === 'tv' || movie?.stream_type === 'tv') return true;

  // 2. Concrete metadata indicators
  if ((details?.seasons_count && details.seasons_count > 0) || (details?.seasons && details.seasons.length > 0)) return true;
  if (movie?.seasons_count && movie.seasons_count > 0) return true;
  if (Boolean(details?.first_air_date) || Boolean(movie?.first_air_date)) return true;

  // 3. Movie indicators (has release_date, runtime > 0, and no seasons or first_air_date)
  if ((details?.release_date || movie?.release_date) && !details?.first_air_date && !movie?.first_air_date) return false;
  if (details?.runtime > 0 && !details?.seasons_count && !details?.first_air_date) return false;

  // 4. Default fallback: pure 'tv' and 'kdrama' default to series; 'anime' defaults to movie unless TV properties are present
  return effectiveMediaType === 'tv' || effectiveMediaType === 'kdrama';
 })();

 const streamType = isSeries ? 'tv' : 'movie';
 const isAnimeMovie = (effectiveMediaType === 'anime' || movie?.genres?.some(g => (typeof g === 'string' ? g : g?.name)?.toLowerCase() === 'animation')) && !isSeries;

 const anikotoEmbedUrl = anikotoData?.sources?.find(s => s.id === 'anikoto')?.url || null;

 const availableServers = useMemo(() => {
  const standardServers = EMBED_SERVERS;
  // Only include Anikoto server when an actual video stream URL was successfully resolved
  if ((effectiveMediaType === 'anime' || isAnimeMovie) && anikotoEmbedUrl) {
   const anikotoServer = {
    id: 'anikoto',
    name: 'Server 0 (Anime Stream ⭐)',
    sandbox: null,
    isAnikoto: true,
    getUrl: () => anikotoEmbedUrl
   };
   return [anikotoServer, ...standardServers];
  }
  return standardServers;
 }, [effectiveMediaType, isAnimeMovie, anikotoEmbedUrl]);

 // Optimal recommended server per content type:
 // • Movies: Server 1 (VidLink HD)
 // • TV Series: Server 2 (AutoEmbed Multi)
 // • Anime Series & Movies: Anikoto Stream (or VidLink HD if Anikoto unindexed)
 const recommendedServerId = useMemo(() => {
  if (effectiveMediaType === 'anime' || isAnimeMovie) {
   return anikotoEmbedUrl ? 'anikoto' : 'vidlink_hd';
  }
  if (isSeries) {
   return 'autoembed';
  }
  return 'vidlink_hd';
 }, [effectiveMediaType, isAnimeMovie, isSeries, anikotoEmbedUrl]);

 // Auto-choose optimal recommended server for user unless manually overridden
 useEffect(() => {
  if (!userSelectedServer && availableServers.length > 0) {
   const recIdx = availableServers.findIndex(s => s.id === recommendedServerId);
   if (recIdx !== -1) {
    setStreamServerIndex(recIdx);
   }
  }
 }, [recommendedServerId, availableServers, userSelectedServer]);

 // Reset manual choice whenever movie changes so recommendation automatically applies
 useEffect(() => {
  setUserSelectedServer(false);
 }, [movieId]);

 // Real-time episode release metadata (supporting both direct Anikoto and TMDB-matched anime)
 const latestRelease = useMemo(() => {
  if (movie?.latest_episode && movie?.latest_episode_updated_at) {
   return {
    episode: movie.latest_episode,
    updated_at: movie.latest_episode_updated_at
   };
  }
  if (anikotoData?.latest_release) {
   return {
    episode: anikotoData.latest_release.latest_episode,
    updated_at: anikotoData.latest_release.updated_at
   };
  }
  return null;
 }, [movie?.latest_episode, movie?.latest_episode_updated_at, anikotoData?.latest_release]);

 const latestReleaseTimeAgo = useMemo(() => {
  if (!latestRelease?.updated_at) return null;
  return formatTimeAgo(latestRelease.updated_at);
 }, [latestRelease?.updated_at]);

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
  if (!movieId) return;
  setLoading(true);
  setShowTrailerPlayer(false);
  setShowStreamPlayer(false);
  setSelectedSeason(1);
  setSelectedEpisode(movie?.latest_episode || movie?.target_episode || 1);
  setSelectedChunkIndex(0);
  setEpisodeSearchQuery('');

  const fetchData = async () => {
   try {
    const reqType = initialMediaType;
    const movieTitle = movie?.title || '';
    const movieGenre = (movie?.genres && movie?.genres[0]) || '';
    const cleanGenre = typeof movieGenre === 'string' ? movieGenre : (movieGenre?.name || '');
    const similarUrl = `/recommendations/similar/${movieId}?media_type=${reqType}${movieTitle ? `&title=${encodeURIComponent(movieTitle)}` : ''}${cleanGenre ? `&genre=${encodeURIComponent(cleanGenre)}` : ''}`;

    if (movie?.anikoto_id) {
     setDetails({
      id: movie.id,
      title: movie.title,
      name: movie.title,
      overview: movie.overview || movie.description || '',
      poster_path: movie.poster_path || movie.poster,
      backdrop_path: movie.backdrop_path || movie.poster,
      vote_average: movie.vote_average || 8.0,
      release_date: movie.release_date,
      media_type: 'anime',
      is_series: true,
      genres: movie.genres || ['Animation', 'Action']
     });

     try {
      const [anikotoRes, similarRes] = await Promise.allSettled([
       api.get(`/movies/anime/anikoto/${movie.anikoto_id}`),
       api.get(similarUrl)
      ]);

      if (similarRes.status === 'fulfilled' && Array.isArray(similarRes.value.data)) {
       setSimilarItems(similarRes.value.data);
      }

      if (anikotoRes.status === 'fulfilled' && anikotoRes.value.data?.data) {
       const seriesData = anikotoRes.value.data.data;
       const eps = (seriesData.episodes || []).map((e) => ({
        id: e.id,
        episode_number: e.number,
        season_number: 1,
        name: e.title || `Episode ${e.number}`,
        overview: e.jp_title || '',
        embed_url: e.embed_url,
        updated_at: e.updated_at
       }));
       setSeasonData({ episodes: eps });

       const targetNum = movie.latest_episode || (eps.length > 0 ? eps[eps.length - 1].episode_number : 1);
       setSelectedEpisode(targetNum);

       const curEp = eps.find((e) => e.episode_number === targetNum) || eps[0];
       if (curEp?.embed_url) {
        const streamUrl = (audioTrack === 'dub' && curEp.embed_url.dub) ? curEp.embed_url.dub : (curEp.embed_url.sub || curEp.embed_url.dub);
        if (streamUrl) {
         setAnikotoData({
          sources: [{ id: 'anikoto', name: 'Server 0 (Anime Stream ⭐)', url: streamUrl }],
          latest_release: {
           latest_episode: targetNum,
           updated_at: curEp.updated_at || movie.latest_episode_updated_at
          }
         });
        }
       }
      }
     } catch (err) {
      console.warn('Failed fetching Anikoto direct series:', err);
     }
     setLoading(false);
     return;
    }

    const [detailsRes, creditsRes, trailersRes, similarRes] = await Promise.allSettled([
     api.get(`/movies/${movieId}/details?media_type=${reqType}`),
     api.get(`/movies/${movieId}/credits?media_type=${reqType}`),
     api.get(`/movies/${movieId}/trailers?media_type=${reqType}`),
     api.get(similarUrl),
    ]);

    if (detailsRes.status === 'fulfilled') setDetails(detailsRes.value.data);
    if (creditsRes.status === 'fulfilled') setCredits(creditsRes.value.data);
    if (trailersRes.status === 'fulfilled') setTrailers(trailersRes.value.data);
    if (similarRes.status === 'fulfilled' && Array.isArray(similarRes.value.data)) {
     setSimilarItems(similarRes.value.data);
    }
   } catch (err) {
    console.error("Error fetching modal media details:", err);
   } finally {
    setLoading(false);
   }
  };

  fetchData();
 }, [movieId, initialMediaType, movie?.anikoto_id]);

 // Synchronize Anikoto embed URL when episode or audio track changes on an Anikoto title
 useEffect(() => {
  if (!movie?.anikoto_id || !seasonData?.episodes) return;
  const curEp = seasonData.episodes.find((e) => e.episode_number === selectedEpisode) || seasonData.episodes[0];
  if (curEp?.embed_url) {
   const streamUrl = (audioTrack === 'dub' && curEp.embed_url.dub) ? curEp.embed_url.dub : (curEp.embed_url.sub || curEp.embed_url.dub);
   if (streamUrl) {
    setAnikotoData((prev) => ({
     ...prev,
     sources: [{ id: 'anikoto', name: 'Server 0 (Anikoto Stream ⭐)', url: streamUrl }]
    }));
   }
  }
 }, [movie?.anikoto_id, selectedEpisode, audioTrack, seasonData]);

 // Dynamically fetch watch providers whenever movie, streamType, or country changes
 useEffect(() => {
  if (!movieId) return;
  let isMounted = true;
  setProvidersLoading(true);

  const fetchProviders = async () => {
   try {
    const encodedTitle = encodeURIComponent(movie.title || details?.title || '');
    const res = await api.get(
     `/movies/${movieId}/providers?media_type=${streamType}&country=${country}&title=${encodedTitle}`
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
 }, [movieId, streamType, country, movie.title, details?.title]);

  // Dynamically fetch TV Series / Anime Season Episodes for Netflix-style selector
  useEffect(() => {
   if (!user || !isVip) return;
   if (!movieId || !isSeries) return;
   let isMounted = true;
   setEpisodesLoading(true);
   setSelectedChunkIndex(0);
   setEpisodeSearchQuery('');

   const fetchSeasonEpisodes = async () => {
    try {
     const res = await api.get(`/movies/${movieId}/season/${selectedSeason}`);
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
  }, [user, isVip, movieId, isSeries, selectedSeason]);

  // Dynamically fetch stream status (YouTube full movie fallback or regional unindexed check)
  useEffect(() => {
   if (!user || !isVip || !movieId || !showStreamPlayer) return;
   let isMounted = true;
   setCheckingStreamStatus(true);
   api.get(`/movies/${movieId}/stream-status?media_type=${streamType}`)
    .then((res) => {
     if (isMounted) setStreamStatusData(res.data);
    })
    .catch((err) => console.warn('Stream status error:', err))
    .finally(() => {
     if (isMounted) setCheckingStreamStatus(false);
    });
   return () => {
    isMounted = false;
   };
  }, [user, isVip, movieId, streamType, showStreamPlayer]);

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

 const CHUNK_SIZE = sortedEpisodes.length > 200 ? 100 : 50;
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

 // Fetch anime stream sources from backend (integrating Anikoto API)
 useEffect(() => {
  if (!movieId || movie?.anikoto_id) return;
  if (effectiveMediaType !== 'anime' && !isAnimeMovie) {
   setAnikotoData(null);
   return;
  }
  let isMounted = true;
  setAnikotoLoading(true);
  const targetEp = isSeries ? selectedEpisode : 1;
  api.get(`/movies/anime/${movieId}/sources?episode=${targetEp}&lang=${audioTrack}`)
   .then((res) => {
    if (isMounted && res.data) {
     setAnikotoData(res.data);
    }
   })
   .catch((err) => {
    console.warn('Anime sources lookup:', err);
   })
   .finally(() => {
    if (isMounted) setAnikotoLoading(false);
   });
  return () => {
   isMounted = false;
  };
 }, [movieId, effectiveMediaType, isAnimeMovie, isSeries, selectedEpisode, audioTrack]);

 // Next & Previous Episode resolution for TV Series and Anime
 const { currentEpisodeObj, nextEpisodeObj, prevEpisodeObj, hasNextEpisode, hasPrevEpisode } = useMemo(() => {
  if (!isSeries || !rawEpisodes || rawEpisodes.length === 0) {
   return {
    currentEpisodeObj: null,
    nextEpisodeObj: null,
    prevEpisodeObj: null,
    hasNextEpisode: false,
    hasPrevEpisode: false
   };
  }
  const current = rawEpisodes.find(ep => ep.episode_number === selectedEpisode) || null;
  const sorted = [...rawEpisodes].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  const currentIdx = sorted.findIndex(ep => ep.episode_number === selectedEpisode);
  const prev = currentIdx > 0 ? sorted[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;
  return {
   currentEpisodeObj: current,
   nextEpisodeObj: next,
   prevEpisodeObj: prev,
   hasNextEpisode: Boolean(next),
   hasPrevEpisode: Boolean(prev)
  };
 }, [isSeries, rawEpisodes, selectedEpisode]);

 const handlePlayNextEpisode = () => {
  if (!nextEpisodeObj) return;
  setSelectedEpisode(nextEpisodeObj.episode_number);
  setShowWatchNextCountdown(false);
  setCountdownSeconds(10);
  if (onShowToast) {
   onShowToast({
    message: `Playing S${selectedSeason} E${nextEpisodeObj.episode_number}: ${nextEpisodeObj.name || 'Next Episode'}`,
    movie
   });
  }
 };

 const handlePlayPrevEpisode = () => {
  if (!prevEpisodeObj) return;
  setSelectedEpisode(prevEpisodeObj.episode_number);
  setShowWatchNextCountdown(false);
  setCountdownSeconds(10);
  if (onShowToast) {
   onShowToast({
    message: `Playing S${selectedSeason} E${prevEpisodeObj.episode_number}: ${prevEpisodeObj.name || 'Previous Episode'}`,
    movie
   });
  }
 };

 // Watch Next / Autoplay countdown timer
 useEffect(() => {
  if (!showWatchNextCountdown) {
   setCountdownSeconds(10);
   return;
  }
  const interval = setInterval(() => {
   setCountdownSeconds((prev) => {
    if (prev <= 1) {
     clearInterval(interval);
     setShowWatchNextCountdown(false);
     if (autoPlayNext) {
      if (isSeries && nextEpisodeObj) {
       handlePlayNextEpisode();
      } else if (!isSeries && similarItems.length > 0 && onSelectMovie) {
       const nextMovie = similarItems[0];
       onSelectMovie(nextMovie);
       if (onShowToast) {
        onShowToast({
         message: `Autoplaying similar title: ${nextMovie.title}`,
         movie: nextMovie
        });
       }
      }
     }
     return 10;
    }
    return prev - 1;
   });
  }, 1000);

  return () => clearInterval(interval);
 }, [showWatchNextCountdown, autoPlayNext, isSeries, nextEpisodeObj, similarItems, onSelectMovie, onShowToast]);

 const modalInnerContent = (
  <div className={isFullPage ? "space-y-6" : "overflow-y-auto flex-1"}>
      {/* Backdrop Header / Video Player (Full Width 16:9 Aspect Ratio) */}
      <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden shrink-0">
       {showStreamPlayer ? (
        <div className="relative w-full h-full bg-black flex flex-col">
         {/* Server Selector Bar */}
         <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-xs z-10">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
           <span className="text-zinc-400 font-mono text-[11px] hidden sm:inline">Server:</span>
           {isSeries && (
            <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-700/50 text-purple-300 font-mono text-[11px] font-bold shrink-0">
             S{selectedSeason} E{selectedEpisode}
            </span>
           )}
           {availableServers.map((srv, idx) => {
            const isSelected = streamServerIndex === idx;
            const isRecommended = srv.id === recommendedServerId;
            return (
             <button
              key={srv.id}
              onClick={() => {
               setUserSelectedServer(true);
               setStreamServerIndex(idx);
              }}
              className={`relative px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
               isSelected
                ? 'bg-purple-600 text-white shadow-md'
                : isRecommended
                  ? 'bg-purple-950/70 border border-purple-500/50 text-purple-200 hover:bg-purple-900/60'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
             >
              <span>{srv.name}</span>
              {isRecommended && (
               <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                isSelected ? 'bg-white/25 text-white' : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
               }`}>
                ⭐ Best
               </span>
              )}
             </button>
            );
           })}

           {/* Phase 1 Direct Video Player Test Button (Smart TV Only) */}
           {isTv && (
            <button
             onClick={() => setShowTvDirectTestPlayer(true)}
             className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all whitespace-nowrap shadow-md flex items-center gap-1 shrink-0 ml-1"
             title="Phase 1: Test Direct VidLink MP4 Player in WebView with D-Pad controls"
            >
             <span>⚡ Test Direct Player (TV Mode)</span>
            </button>
           )}

            {/* Audio Track Toggle (SUB vs DUB) */}
            <div className="flex items-center gap-1 border-l border-zinc-700/80 pl-2 shrink-0 ml-1">
             <button
              onClick={() => setAudioTrack('sub')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
               audioTrack === 'sub'
                ? 'bg-amber-500 text-black shadow'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Subtitle mode (Japanese / Original with English Subtitles)"
             >
              SUB
             </button>
             <button
              onClick={() => setAudioTrack('dub')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
               audioTrack === 'dub'
                ? 'bg-amber-500 text-black shadow'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="English Dubbed audio track"
             >
              DUB
             </button>
            </div>

            {/* Episodic Series / Anime Prev & Next & Watch Next & Autoplay */}
            {isSeries && (
             <div className="flex items-center gap-1 border-l border-zinc-700/80 pl-2 shrink-0 ml-1">
              <button
               onClick={handlePlayPrevEpisode}
               disabled={!hasPrevEpisode}
               className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
                hasPrevEpisode
                 ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                 : 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
               }`}
               title={hasPrevEpisode ? `Previous Episode (E${prevEpisodeObj?.episode_number})` : 'First Episode in Season'}
              >
               <SkipBack className="w-3 h-3" />
               <span className="hidden sm:inline">Prev</span>
              </button>

              <button
               onClick={handlePlayNextEpisode}
               disabled={!hasNextEpisode}
               className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
                hasNextEpisode
                 ? 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 hover:text-white'
                 : 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
               }`}
               title={hasNextEpisode ? `Next Episode (E${nextEpisodeObj?.episode_number})` : 'Season Finale / Last Episode'}
              >
               <span className="hidden sm:inline">Next</span>
               <SkipForward className="w-3 h-3" />
              </button>

              {hasNextEpisode && (
               <button
                onClick={() => {
                 setShowWatchNextCountdown(true);
                 setCountdownSeconds(10);
                }}
                className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                 showWatchNextCountdown
                  ? 'bg-amber-500 text-black shadow'
                  : 'bg-zinc-800 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30'
                }`}
                title="Trigger Watch Next countdown overlay"
               >
                <Sparkles className="w-3 h-3" />
                <span className="hidden md:inline">Watch Next</span>
               </button>
              )}
             </div>
            )}

            {/* Autoplay Next Toggle */}
            <button
             onClick={() => {
              setAutoPlayNext(prev => {
               const nextVal = !prev;
               try {
                localStorage.setItem('cinematch_autoplay_next', String(nextVal));
               } catch {}
               if (onShowToast) {
                onShowToast({
                 message: nextVal ? '⚡ Autoplay next episode: ON' : '⚡ Autoplay next episode: OFF'
                });
               }
               return nextVal;
              });
             }}
             className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all shrink-0 ml-1 ${
              autoPlayNext
               ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
               : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
             }`}
             title={autoPlayNext ? 'Autoplay next episode is ON' : 'Autoplay next episode is OFF'}
            >
             <Zap className={`w-3 h-3 ${autoPlayNext ? 'fill-emerald-400 text-emerald-400' : 'text-zinc-500'}`} />
             <span className="hidden xs:inline">{autoPlayNext ? 'Autoplay: ON' : 'Autoplay: OFF'}</span>
            </button>
          </div>
          <button
           onClick={() => setShowStreamPlayer(false)}
           className="text-zinc-400 hover:text-white px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] shrink-0 ml-2"
          >
           Close Stream ✕
          </button>
         </div>

         {/* Sub-bar with Recommended Server Auto-Choice Notice */}
         <div className="flex items-center justify-between px-3 py-1 bg-zinc-950 border-b border-zinc-800/80 text-[10.5px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
           <span className="text-purple-400 font-bold shrink-0">⭐ Recommended:</span>
           <span className="text-zinc-200 shrink-0">
            {effectiveMediaType === 'anime' || isAnimeMovie
              ? (anikotoEmbedUrl ? 'Anime Stream (Auto-chosen for Anime)' : 'VidLink HD with Sub/Dub (Auto-chosen for Anime)')
              : isSeries
                ? 'AutoEmbed Multi (Auto-chosen for TV Series)'
                : 'VidLink HD (Auto-chosen for Movies)'}
           </span>
           <span className="text-zinc-500 hidden sm:inline">• Free to switch to any server anytime</span>
          </div>
          {effectiveMediaType === 'anime' && anikotoLoading && (
           <span className="text-[10px] text-amber-400 animate-pulse shrink-0">Checking anime stream servers...</span>
          )}
         </div>

          {/* Stream Player Container */}
          <div className="relative flex-1 w-full h-full bg-black overflow-hidden">
           {/* TV Volume Sync Banner Overlay */}
           {tvVolumeInfo && (
            <div className="absolute top-4 right-4 z-40 px-3.5 py-2 rounded-xl bg-black/90 border border-purple-500/50 text-white font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
             <span className="text-purple-400">🔊</span>
             <span>TV Volume: {tvVolumeInfo.isMuted ? 'Muted' : `${tvVolumeInfo.volume}%`}</span>
            </div>
           )}

           {streamStatusData?.is_nepali && streamStatusData?.has_youtube_full_movie ? (
            <iframe
             key={`youtube_full_${movieId}`}
             src={`https://www.youtube.com/embed/${streamStatusData.youtube_video.key}?autoplay=1`}
             title={`${movie.title} Full Movie`}
             allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
             allowFullScreen
             className="w-full h-full border-0"
            />
           ) : streamStatusData?.stream_status === 'unavailable' || (streamStatusData?.is_nepali && !streamStatusData?.has_youtube_full_movie) ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-zinc-950/95 border border-zinc-800 space-y-4">
             <div className="p-3.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Tv className="w-8 h-8" />
             </div>
             <div className="space-y-1.5 max-w-md">
              <h4 className="text-base font-bold text-white tracking-wide">
               Stream Unavailable in HD Server
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
               This title (<strong className="text-zinc-200">{movie.title}</strong>) is not currently indexed on global HD embed servers. Official YouTube releases or partner providers can be accessed below.
              </p>
             </div>
             <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
               href={`https://www.youtube.com/results?search_query=${encodeURIComponent((movie.title || '') + ' full movie')}`}
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95"
              >
               <Film className="w-4 h-4" />
               <span>Search Full Movie on YouTube</span>
               <ExternalLink className="w-3.5 h-3.5" />
              </a>
             </div>
            </div>
           ) : (
            <iframe
             key={`${availableServers[streamServerIndex]?.id}_${movieId}_s${selectedSeason}_e${selectedEpisode}_${audioTrack}`}
             src={availableServers[streamServerIndex]?.getUrl(movieId, streamType, selectedSeason, selectedEpisode, audioTrack)}
             title={`${movie.title} Stream`}
             allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
             allowFullScreen
             {...(availableServers[streamServerIndex]?.sandbox ? { sandbox: availableServers[streamServerIndex].sandbox } : {})}
             className="w-full h-full border-0"
            />
           )}
           {/* Floating Netflix-Style "Watch Next / Up Next" Countdown Overlay */}
           {showWatchNextCountdown && (isSeries ? hasNextEpisode : similarItems.length > 0) && (
            <div className="absolute bottom-4 right-4 z-40 max-w-xs sm:max-w-sm w-72 sm:w-80 bg-zinc-950/95 border border-purple-500/70 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
             <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
               <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
               <span className="text-xs font-bold text-white uppercase tracking-wider">
                Up Next in {countdownSeconds}s
               </span>
              </div>
              <button
               onClick={() => setShowWatchNextCountdown(false)}
               className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
               title="Cancel countdown"
              >
               <X className="w-3.5 h-3.5" />
              </button>
             </div>

             {/* Content Thumbnail & Details */}
             <div className="flex items-center gap-3 py-2.5">
              {isSeries && nextEpisodeObj ? (
               <>
                <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800">
                 {nextEpisodeObj.still_url ? (
                  <img src={nextEpisodeObj.still_url} alt={nextEpisodeObj.name} className="w-full h-full object-cover" />
                 ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 font-mono text-[9px]">
                   E{nextEpisodeObj.episode_number}
                  </div>
                 )}
                 <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-[8px] font-mono font-bold text-white">
                  E{nextEpisodeObj.episode_number}
                 </span>
                </div>
                <div className="min-w-0 flex-1">
                 <h6 className="text-xs font-bold text-white truncate">
                  {nextEpisodeObj.episode_number}. {nextEpisodeObj.name || `Episode ${nextEpisodeObj.episode_number}`}
                 </h6>
                 <p className="text-[11px] text-zinc-400 font-mono">
                  Season {selectedSeason} • {nextEpisodeObj.runtime ? `${nextEpisodeObj.runtime}m` : 'Next Episode'}
                 </p>
                </div>
               </>
              ) : (
               similarItems.length > 0 && (
                <>
                 <div className="relative w-12 aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800">
                  <img src={similarItems[0].poster_url} alt={similarItems[0].title} className="w-full h-full object-cover" />
                 </div>
                 <div className="min-w-0 flex-1">
                  <h6 className="text-xs font-bold text-white truncate">{similarItems[0].title}</h6>
                  <p className="text-[11px] text-zinc-400 font-mono">
                   {similarItems[0].year} • ★ {similarItems[0].imdb_rating || similarItems[0].vote_average?.toFixed(1) || '8.0'}
                  </p>
                 </div>
                </>
               )
              )}
             </div>

             {/* Progress Bar */}
             <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-2.5">
              <div
               className="h-full bg-gradient-to-r from-purple-500 to-amber-500 transition-all duration-1000 ease-linear"
               style={{ width: `${((10 - countdownSeconds) / 10) * 100}%` }}
              />
             </div>

             {/* Action Buttons */}
             <div className="flex items-center gap-2">
              <button
               onClick={() => {
                if (isSeries && nextEpisodeObj) {
                 handlePlayNextEpisode();
                } else if (!isSeries && similarItems.length > 0 && onSelectMovie) {
                 setShowWatchNextCountdown(false);
                 onSelectMovie(similarItems[0]);
                }
               }}
               className="flex-1 py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all active:scale-95 shadow flex items-center justify-center gap-1.5"
              >
               <Play className="w-3.5 h-3.5 fill-white" />
               <span>Watch Now</span>
              </button>
              <button
               onClick={() => setShowWatchNextCountdown(false)}
               className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium border border-zinc-800 transition-colors"
              >
               Cancel
              </button>
             </div>
            </div>
           )}
           {showTvDirectTestPlayer && (
            <TvVideoPlayer
             movieId={movieId}
             mediaType={streamType}
             season={selectedSeason}
             episode={selectedEpisode}
             title={movie.title}
             onClose={() => setShowTvDirectTestPlayer(false)}
            />
           )}
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
         <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-col gap-2.5 z-10">
          {resumeProgress && (
           <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-purple-500/50 text-purple-200 text-xs backdrop-blur-md shadow-lg w-fit">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="font-medium">
             Continue watching: {isSeries ? `Season ${resumeProgress.season || selectedSeason}, Episode ${resumeProgress.episode || selectedEpisode}` : `Movie (${resumeProgress.percent || 0}%)`}
            </span>
           </div>
          )}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
           {user && isVip && (
            <button
             onClick={() => {
              setShowTrailerPlayer(false);
              setShowStreamPlayer(true);
             }}
             className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/60 transition-all active:scale-95"
            >
             <Play className="w-4 h-4 fill-white" />
             <span>
              {resumeProgress
                ? (isSeries
                    ? `Resume S${selectedSeason} E${selectedEpisode}`
                    : `Resume Playback (${resumeProgress.percent || 0}%)`)
                : (isSeries
                    ? `Play S${selectedSeason} E${selectedEpisode}`
                    : isAnimeMovie
                      ? 'Play Anime Movie'
                      : 'Play Movie')}
             </span>
            </button>
           )}
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
           {isAnimeMovie ? 'Anime Movie' : 'Anime Series'}
          </span>
         )}
         {mediaType === 'tv' && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-950/80 text-purple-300 border border-purple-700/40">
           TV Series
          </span>
         )}
         {mediaType === 'kdrama' && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-pink-950/80 text-pink-300 border border-pink-700/40">
           K-Drama
          </span>
         )}
        </div>

        {/* Just Released Episode Live Banner (VIP Mode Only) */}
        {isVip && latestRelease && (
         <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-teal-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-semibold shadow-lg shadow-emerald-950/30 w-fit my-1 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="flex items-center gap-1.5 flex-wrap">
           <span>⚡ Episode {latestRelease.episode} Just Released</span>
           {latestReleaseTimeAgo && (
            <span className="px-1.5 py-0.2 rounded-md bg-emerald-900/60 text-emerald-300 font-mono text-[10px] border border-emerald-600/40">
             {latestReleaseTimeAgo}
            </span>
           )}
          </span>
         </div>
        )}

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
           Network: <strong className="text-white">{(details.networks || []).map(n => typeof n === 'string' ? n : (n?.name || '')).filter(Boolean).join(", ")}</strong>
          </span>
         )}

         {credits?.directors?.length > 0 && (
          <span className="text-zinc-400 font-sans">
           Creator: <strong className="text-zinc-200">{(credits.directors || []).map(d => typeof d === 'string' ? d : (d?.name || '')).filter(Boolean).join(", ")}</strong>
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
       {(details?.genres || movie.genres || []).map((genre, idx) => {
        const name = typeof genre === 'string' ? genre : (genre?.name || '');
        if (!name) return null;
        return (
         <span
          key={genre?.id || name || idx}
          className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300"
         >
          {name}
         </span>
        );
       })}
      </div>

      {/* Synopsis / Overview */}
      <div className="space-y-2">
       <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Overview</h4>
       <p className="text-sm leading-relaxed text-zinc-300">
        {details?.overview || movie.overview || "No synopsis available for this title."}
       </p>
      </div>

      {/* TV Series, Anime & K-Drama Episodes Browser with Fast Sort, Range Chunks & Jump Search (VIP Only) */}
      {user && isVip && isSeries && (
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
              if (!isVip) {
               setShowVipUnlockPrompt(true);
               return;
              }
              if (!user) {
               if (onRequireAuth) onRequireAuth();
               if (onShowToast) onShowToast({ message: 'Please sign in to stream full episodes' });
               return;
              }
              setSelectedEpisode(ep.episode_number);
              setShowTrailerPlayer(false);
              setShowStreamPlayer(true);
              setShowWatchNextCountdown(false);
              setCountdownSeconds(10);
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
               <div className="flex items-center gap-2 flex-wrap">
                <h5 className={`text-xs sm:text-sm font-bold transition-colors ${
                 isSelected ? 'text-purple-300' : 'text-white group-hover:text-purple-300'
                }`}>
                 {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                </h5>
                {isVip && latestRelease?.episode === ep.episode_number && (
                 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Just Released {latestReleaseTimeAgo ? `• ${latestReleaseTimeAgo}` : ''}
                 </span>
                )}
               </div>
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
          {isVip && (
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
          )}
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

      {/* Recommended Movies / Series / Anime (Excluding Watched) */}
      {similarItems.length > 0 && (
       <div className="space-y-3 pt-4 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
         <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Recommended {mediaType === 'anime' ? 'Anime & Movies' : mediaType === 'tv' ? 'Series' : 'Movies'} (Watched Excluded)
         </h4>
         <span className="text-[10px] font-mono text-zinc-500">Unwatched</span>
        </div>
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
         {similarItems.slice(0, 5).map((simItem) => (
          <MovieCard
           key={simItem.id}
           movie={simItem}
           onSelect={(m) => onSelectMovie(m)}
           onShowToast={onShowToast}
           isVip={isVip}
          />
         ))}
        </div>
       </div>
      )}
     </div>
    </div>
  );

  if (isFullPage) {
   return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col font-sans">
     {/* Full-Page Navigation Header */}
     <nav className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3 sm:gap-4">
       <button
        onClick={() => {
         if (onClose) {
          onClose();
         } else {
          window.location.href = '/';
         }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95"
       >
        <span>← Back to Home</span>
       </button>
       <a href="/" className="flex items-center gap-2 text-white font-bold text-base hover:text-purple-400 transition-colors">
        <Film className="w-5 h-5 text-purple-500" />
        <span className="tracking-tight">CineMatch</span>
       </a>
      </div>
      <div className="flex items-center gap-2">
       <button
        onClick={() => {
         const shareUrl = `${window.location.origin}/?item=${movieId}&type=${mediaType}`;
         if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
           if (onShowToast) onShowToast({ message: '🎬 Link copied! Share with friends.', movie });
          });
         }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all active:scale-95"
        title="Share this title"
       >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
       </button>
      </div>
     </nav>

     {/* Full-Page Content Layout */}
     <main className="flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-6 lg:p-8 space-y-6">
      {modalInnerContent}
     </main>
    </div>
   );
  }

  return (
   <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
    {/* Backdrop Light-Dismiss Click Area */}
    <div className="fixed inset-0" onClick={onClose} />

    {/* Modal Card (Widescreen IMAX Layout) */}
    <div className="relative w-full md:w-[90vw] max-w-[1600px] max-h-[92vh] bg-zinc-950 border border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden z-10 my-auto flex flex-col transition-all duration-300">
     {/* Action Buttons: Share & Close */}
     <div className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
      <button
       onClick={() => {
        const shareUrl = `${window.location.origin}/?item=${movieId}&type=${mediaType}`;
        if (navigator.clipboard?.writeText) {
         navigator.clipboard.writeText(shareUrl).then(() => {
          if (onShowToast) {
           onShowToast({
            message: '🎬 Link copied! Share with friends to open in any tab.',
            movie
           });
          }
         });
        }
       }}
       className="rounded-full p-2 bg-black/70 border border-white/10 text-zinc-400 hover:text-white hover:bg-black transition-colors"
       title="Copy link to share"
      >
       <Share2 className="w-5 h-5" />
      </button>
      <button
       onClick={onClose}
       className="rounded-full p-2 bg-black/70 border border-white/10 text-zinc-400 hover:text-white hover:bg-black transition-colors"
       title="Close modal"
      >
       <X className="w-5 h-5" />
      </button>
     </div>

     {modalInnerContent}
    </div>
   </div>
  );
 }
