import React, { useState } from 'react';
import { Cloud, Copy, Check, RotateCcw, X, ShieldCheck, Film, Bookmark, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SyncModal({ isOpen, onClose }) {
  const { libraryId, watchedMovies, watchlistMovies, restoreLibraryById } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (libraryId) {
      navigator.clipboard.writeText(libraryId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    setIsRestoring(true);
    setStatus(null);

    const res = await restoreLibraryById(inputVal.trim());
    setIsRestoring(false);

    if (res.success) {
      setStatus({
        type: 'success',
        message: `Success! Restored ${res.countWatched} watched titles and ${res.countWatchlist} watchlist items.`
      });
      setInputVal('');
    } else {
      setStatus({
        type: 'error',
        message: res.error || 'Failed to restore library. Please verify the ID.'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title & Cloud Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-600/15 text-rose-400 border border-rose-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Cloud Library Sync
              </h2>
              <p className="text-xs text-zinc-400">Zero data loss across commits, redeploys & incognito</p>
            </div>
          </div>
        </div>

        {/* Current Active Library ID Box */}
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Your Current Library ID
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Cloud-Protected
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 bg-black/60 px-3.5 py-2.5 rounded-lg border border-zinc-700/60">
            <span className="font-mono text-sm font-bold text-rose-300 tracking-wide select-all truncate">
              {libraryId || 'Generating...'}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all shrink-0 active:scale-95"
              title="Copy ID to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <Film className="w-3.5 h-3.5" />
                <span>{watchedMovies.length} Watched</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 font-semibold">
                <Bookmark className="w-3.5 h-3.5" />
                <span>{watchlistMovies.length} in Watchlist</span>
              </div>
            </div>
          </div>
        </div>

        {/* Restore Section */}
        <div className="space-y-3 pt-1 border-t border-zinc-800/80">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              Restore Library From Another Window or Device
            </h3>
            <p className="text-[11px] text-zinc-400">
              Visiting in incognito or switched devices? Paste your Library ID to immediately recover all your saved and watched titles.
            </p>
          </div>

          <form onSubmit={handleRestore} className="flex gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="e.g. USER-9X2A1B or Google UID"
              className="flex-1 px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 transition-all font-mono"
            />
            <button
              type="submit"
              disabled={isRestoring || !inputVal.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-rose-950/40 transition-all flex items-center gap-1.5 shrink-0"
            >
              {isRestoring ? (
                <span>Restoring...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </>
              )}
            </button>
          </form>

          {/* Feedback status */}
          {status && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 animate-in fade-in ${
                status.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
              }`}
            >
              {status.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{status.message}</span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-zinc-500 text-center">
          Backed by Google Cloud Firestore. Safe across server restarts, browser refreshes, and app upgrades.
        </p>
      </div>
    </div>
  );
}
