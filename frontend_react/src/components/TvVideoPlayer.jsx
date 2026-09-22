import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';

export default function TvVideoPlayer({ movieId, mediaType = 'movie', season = 1, episode = 1, title = '', onClose }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [apiResponseData, setApiResponseData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Auto-hide controls overlay after 4 seconds of inactivity
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  // Phase 1: Call VidLink API to extract direct playable stream link
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const resolveVidLinkStream = async () => {
      try {
        console.log(`[TvVideoPlayer] Resolving direct VidLink stream for ${mediaType} TMDB ID: ${movieId} (S${season} E${episode})...`);
        
        // Fetch VidLink page html/js to obtain stream payload or fallback iframe URL
        const vidlinkPageUrl = mediaType === 'tv'
          ? `https://vidlink.pro/tv/${movieId}/${season}/${episode}`
          : `https://vidlink.pro/movie/${movieId}`;

        console.log('[TvVideoPlayer] Fetching VidLink target:', vidlinkPageUrl);
        
        // Attempt direct fetch to VidLink API
        const apiEndpoint = mediaType === 'tv'
          ? `https://vidlink.pro/api/b/tv/${movieId}/${season}/${episode}?multiLang=0`
          : `https://vidlink.pro/api/b/movie/${movieId}?multiLang=0`;

        const res = await fetch(apiEndpoint, {
          method: 'GET',
          headers: {
            'X-Playback-Environment': 'dash-hevc',
            'Referer': vidlinkPageUrl
          }
        });

        console.log('[TvVideoPlayer] API HTTP Status:', res.status);
        if (!res.ok) {
          throw new Error(`VidLink API responded with HTTP status ${res.status}`);
        }

        const data = await res.json();
        console.log('[TvVideoPlayer] API Full Response:', data);
        if (isMounted) setApiResponseData(data);

        // Extract direct playable MP4 URL from qualities object
        const qualities = data?.stream?.qualities || data?.qualities || {};
        const chosenQuality = qualities['720'] || qualities['1080'] || qualities['480'] || qualities['360'] || Object.values(qualities)[0];

        if (!chosenQuality || !chosenQuality.url) {
          throw new Error('No playable stream URL found in VidLink API response qualities payload.');
        }

        const directUrl = chosenQuality.url;
        console.log('[TvVideoPlayer] Extracted Direct Playable URL:', directUrl);
        console.log('[TvVideoPlayer] Stream headers required by CDN:', chosenQuality.headers);

        if (isMounted) {
          setStreamUrl(directUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('[TvVideoPlayer] Stream Resolution Error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to fetch direct video stream from VidLink API.');
          setLoading(false);
        }
      }
    };

    resolveVidLinkStream();

    return () => {
      isMounted = false;
    };
  }, [movieId, mediaType, season, episode]);

  // Focus management & D-Pad navigation event listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const code = e.keyCode || e.which;
      const key = e.key;

      console.log(`[TvVideoPlayer] KeyPressed: key=${key}, keyCode=${code}`);
      setShowControls(true);

      // Back / Escape (KeyCode 27 or 4) -> Exit player
      if (key === 'Escape' || code === 27 || code === 4 || key === 'Back' || key === 'GoBack') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Play/Pause: Enter / OK / KeyCode 13 / 23 / 66 / MediaPlayPause (179)
      if (key === 'Enter' || code === 13 || code === 23 || code === 66 || code === 179 || key === 'MediaPlayPause') {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
        return;
      }

      // Seek -10s: ArrowLeft (37 / 21) or MediaRewind (89)
      if (key === 'ArrowLeft' || code === 37 || code === 21 || code === 89 || key === 'MediaRewind') {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          setCurrentTime(videoRef.current.currentTime);
        }
        return;
      }

      // Seek +10s: ArrowRight (39 / 22) or MediaFastForward (90)
      if (key === 'ArrowRight' || code === 39 || code === 22 || code === 90 || key === 'MediaFastForward') {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
          setCurrentTime(videoRef.current.currentTime);
        }
        return;
      }

      // Up / Down: Toggle controls
      if (key === 'ArrowUp' || code === 38 || code === 19 || key === 'ArrowDown' || code === 40 || code === 20) {
        e.preventDefault();
        e.stopPropagation();
        setShowControls(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const handleVideoError = (e) => {
    const err = e.target.error;
    const errCode = err ? err.code : 'UNKNOWN';
    const errMsg = err ? err.message : 'Unknown HTML5 video media error';
    console.error(`[TvVideoPlayer] Video Playback Failed: Code ${errCode}, Message: ${errMsg}`);
    console.error('[TvVideoPlayer] Video Error Object:', err);
    console.error('[TvVideoPlayer] Attempted Stream URL:', streamUrl);
    setError(`Direct Video Playback Failed (Error Code ${errCode}: ${errMsg}). CDN may require referrer headers.`);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center overflow-hidden">
      {/* Back Button */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/60 font-semibold text-sm transition-all shadow-xl"
      >
        <ArrowLeft className="w-5 h-5 text-purple-400" />
        <span>Exit Player (Back)</span>
      </button>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 space-y-4">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
          <p className="text-white font-mono text-sm tracking-wide">
            Resolving VidLink direct stream for <strong className="text-purple-400">{title}</strong>...
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 bg-zinc-950/95 text-center space-y-4 max-w-2xl mx-auto">
          <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-white">Direct Stream Test Failed</h3>
          <p className="text-sm text-zinc-300 font-mono leading-relaxed bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-left w-full overflow-x-auto">
            {error}
          </p>
          <div className="text-xs text-zinc-400 text-left w-full space-y-1 bg-zinc-900/50 p-3 rounded-lg font-mono">
            <div><strong>Stream URL:</strong> {streamUrl || 'None'}</div>
            <div><strong>API Status:</strong> {apiResponseData ? '200 OK' : 'Failed'}</div>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg mt-2"
          >
            Return to Modal / Embed Fallback
          </button>
        </div>
      )}

      {/* Main HTML5 Video Tag */}
      {streamUrl && (
        <video
          ref={videoRef}
          src={streamUrl}
          autoPlay
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onError={handleVideoError}
          className="w-full h-full object-contain"
        />
      )}

      {/* TV D-Pad Controls Overlay */}
      {showControls && streamUrl && !error && !loading && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-8 bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none transition-opacity duration-300">
          {/* Top Title Bar */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white drop-shadow-md">{title}</h2>
              {mediaType === 'tv' && (
                <span className="px-2.5 py-0.5 rounded bg-purple-600/80 text-white font-mono text-xs font-bold">
                  Season {season} Episode {episode}
                </span>
              )}
            </div>
            <div className="text-xs text-purple-300 font-mono bg-black/60 px-3 py-1.5 rounded-lg border border-purple-500/30">
              OK = Play/Pause | Left/Right = ±10s | Back = Exit
            </div>
          </div>

          {/* Bottom Player Controls & Scrub Bar */}
          <div className="space-y-4 pointer-events-auto">
            {/* Progress Bar */}
            <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden relative border border-white/10">
              <div
                className="bg-purple-500 h-full transition-all duration-150"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between text-white font-mono text-xs">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                    }
                  }}
                  className="p-3 rounded-full bg-purple-600 text-white hover:bg-purple-500 transition-transform active:scale-95 shadow-lg"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                  <span>-10s</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <RotateCw className="w-4 h-4 text-purple-400" />
                  <span>+10s</span>
                </div>
              </div>

              {/* Time Indicators */}
              <div className="text-sm font-bold text-zinc-300 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-zinc-500">/</span>
                <span className="text-zinc-400">{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
