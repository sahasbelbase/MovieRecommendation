import React, { useState, useEffect } from 'react';
import {
  Sparkles, Share2, UserPlus, Check, Copy, RefreshCw, Crown,
  Users, Film, Github, Linkedin, MessageSquare, ExternalLink, Dices
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PREFIXES_ADJECTIVES = [
  'Neon', 'Cyber', 'Velvet', 'Quantum', 'Popcorn', 'Starlight', 'Midnight',
  'Cosmic', 'Aether', 'Retro', 'Silver', 'Pixel', 'Film', 'Indie', 'Ultra',
  'Kino', 'Binge', 'Shadow', 'Electric', 'Solar', 'Atomic', 'Vivid', 'Mystic',
  'Golden', 'Apex', 'Hyper', 'Nova', 'Astral', 'Phantom', 'Luna', 'Vortex', 'Echo'
];

const CORE_ROLES = [
  'Watcher', 'Cinephile', 'Director', 'Knight', 'Wizard', 'Spectator', 'Critic',
  'Reel', 'Viewer', 'Explorer', 'Pro', 'Master', 'Legend', 'Captain', 'Seeker',
  'Buff', 'Voyager', 'Chaser', 'Curator', 'Guru', 'Scout', 'Rider', 'Pulse',
  'Pilot', 'Savant', 'Auteur', 'Streamer', 'Wanderer'
];

const SUFFIX_TAGS = [
  'Prime', 'X', 'Zero', 'HQ', 'Max', 'V1', 'Neo', '3000', 'Live', '4K',
  'Zone', 'Mode', 'Star', 'Wave', 'Verse', 'Club', 'Pulse', 'Lab', 'Shift',
  'Sync', 'Core', '77', '99', '88', '01'
];

export default function Footer({ onShowToast, onStartWatchParty, onOpenMovieNight }) {
  const { user } = useAuth();

  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        user?.displayName ||
        localStorage.getItem('cinematch_guest_name') ||
        localStorage.getItem('movienight_name') ||
        'NeonWatcherPrime'
      );
    }
    return 'NeonWatcherPrime';
  });

  const [friendCode, setFriendCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setUsername(user.displayName);
    }
  }, [user]);

  // Generate a random 3-part cool username (Prefix + Role + Suffix)
  const handleGenerateUsername = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const prefix = PREFIXES_ADJECTIVES[Math.floor(Math.random() * PREFIXES_ADJECTIVES.length)];
      const role = CORE_ROLES[Math.floor(Math.random() * CORE_ROLES.length)];
      const suffix = SUFFIX_TAGS[Math.floor(Math.random() * SUFFIX_TAGS.length)];
      const coolName = `${prefix}${role}${suffix}`;
      setUsername(coolName);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinematch_guest_name', coolName);
        localStorage.setItem('movienight_name', coolName);
      }
      setIsGenerating(false);
      if (onShowToast) {
        onShowToast({ message: `Generated 3-part cool alias: ${coolName} 🍿` });
      }
    }, 180);
  };

  // Save manual username change
  const handleUsernameChange = (newName) => {
    setUsername(newName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cinematch_guest_name', newName);
      localStorage.setItem('movienight_name', newName);
    }
  };

  // Share invitation link
  const handleShareApp = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cinematch.app';
    const shareData = {
      title: 'Cinematch - Watch Movies & Parties with Friends 🍿',
      text: `Join me on Cinematch! Match movies, share live screens, and watch together:`,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        if (onShowToast) onShowToast({ message: 'Invitation shared! 🚀' });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Native share error:', err);
        else return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      if (onShowToast) onShowToast({ message: 'Cinematch link copied to clipboard! 📋' });
    } catch (_) {
      if (onShowToast) onShowToast({ message: `Link: ${shareUrl}` });
    }
  };

  // Handle joining friend's room
  const handleJoinFriendRoom = (e) => {
    e.preventDefault();
    const code = friendCode.trim().toUpperCase();
    if (code.length === 4) {
      if (typeof window !== 'undefined') {
        window.location.href = `/?party=${code}`;
      }
    } else if (onShowToast) {
      onShowToast({ message: 'Please enter a valid 4-letter Room Code' });
    }
  };

  return (
    <footer className="w-full border-t border-zinc-900 bg-zinc-950/90 backdrop-blur-xl pt-12 pb-24 md:pb-12 px-4 sm:px-6 lg:px-8 text-xs text-zinc-400">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Bento Social Grid: Non-congested, sleek layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Your Identity & Cool Username Generator */}
          <div className="relative p-5 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-xl space-y-4 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Your Cinephile Alias
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Customize your display name for Watch Parties & Movie Night rooms
                  </p>
                </div>
              </div>
            </div>

            {/* Username Input + Dice Generator Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  maxLength={22}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="Choose or generate handle"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-rose-500 text-white font-mono text-xs outline-none transition-all placeholder:text-zinc-600"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateUsername}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0 disabled:opacity-50"
                title="Generate a cool cinematic username"
              >
                <Dices className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Cool Alias</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
              <span>Saved locally & synced to live watch rooms</span>
              <span className="text-amber-400 font-semibold">Live Mode Ready</span>
            </div>
          </div>

          {/* Card 2: Share with Friends & Add/Join Friend's Room */}
          <div className="relative p-5 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Watch Together with Friends
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Invite friends to your party or enter their 4-letter room code
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Share Party Link Button */}
              <button
                onClick={handleShareApp}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/80 text-white font-semibold text-xs transition-all active:scale-95"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-rose-400" />}
                <span>{copiedLink ? 'Link Copied!' : 'Share Cinematch'}</span>
              </button>

              {/* Join / Add Friend Room Form */}
              <form onSubmit={handleJoinFriendRoom} className="flex items-center">
                <input
                  type="text"
                  value={friendCode}
                  maxLength={4}
                  onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                  placeholder="Code (e.g. X9A2)"
                  className="w-full px-3 py-2.5 rounded-l-xl bg-zinc-950 border border-r-0 border-zinc-800 focus:border-purple-500 text-white font-mono text-xs uppercase outline-none transition-all placeholder:normal-case placeholder:text-zinc-600"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2.5 rounded-r-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
                >
                  Join
                </button>
              </form>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
              <span>WebRTC Screen Share & Live Chat</span>
              <button
                type="button"
                onClick={() => onStartWatchParty && onStartWatchParty(null)}
                className="text-rose-400 hover:underline font-semibold"
              >
                Host New Party +
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar & Social Metadata */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-900 text-center sm:text-left">
          <div className="space-y-1">
            <p className="text-white font-semibold text-xs flex items-center justify-center sm:justify-start gap-1.5">
              <span>Cinematch</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 font-normal">AI Recommendation & Live Watch Parties</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Curated streaming recommendations, group swipe matching, and WebRTC screen sharing.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="https://github.com/sahasbelbase"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-medium transition-all"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/sahasbelbase/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-sky-400 text-xs font-medium transition-all"
            >
              <Linkedin className="w-3.5 h-3.5" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
