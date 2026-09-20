import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
 const { user, loginWithGoogle } = useAuth();
 const [error, setError] = useState('');
 const [submitting, setSubmitting] = useState(false);

 // Automatically close modal as soon as user is authenticated
 React.useEffect(() => {
  if (user && isOpen) {
   setSubmitting(false);
   onClose();
  }
 }, [user, isOpen, onClose]);

 if (!isOpen) return null;

 const handleGoogleSignIn = async () => {
  setError('');
  setSubmitting(true);
  try {
   await loginWithGoogle();
   onClose();
  } catch (err) {
   console.error("Google Auth error:", err);
   if (err.code === 'auth/operation-not-allowed') {
    setError("Google Sign-In is not enabled in Firebase Console. In Firebase Console, go to Authentication > Sign-in method > Google and click 'Enable'.");
   } else if (err.code === 'auth/unauthorized-domain') {
    setError("Domain not authorized in Firebase. In Firebase Console, go to Authentication > Settings > Authorized domains and add 'movierecommendation.pages.dev'.");
   } else if (err.code === 'auth/popup-blocked') {
    setError("Popup was blocked by your browser. Please allow popups for movierecommendation.pages.dev and try again.");
   } else if (err.code === 'auth/popup-closed-by-user') {
    setError("Sign-in popup was closed before completing.");
   } else {
    setError(err.message || "Google sign-in could not be completed.");
   }
  } finally {
   setSubmitting(false);
  }
 };

 return (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
   <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
    {/* Header */}
    <div className="flex items-start justify-between">
     <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400 font-mono mb-1">
       <Sparkles className="w-3.5 h-3.5" />
       Tailored Experience
      </div>
      <h3 className="text-xl font-bold text-white tracking-tight">
       Sign In to Movie Engine
      </h3>
     </div>
     <button
      onClick={onClose}
      className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 transition-colors"
     >
      <X className="w-4 h-4" />
     </button>
    </div>

    <div className="space-y-2.5">
     <p className="text-xs text-zinc-300 leading-relaxed">
      Sign in with Google to automatically sync your watched titles and watchlist across all your devices, and unlock Swipe Mode.
     </p>
     <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
      <span className="text-sm shrink-0">🔒</span>
      <span>
       <strong className="text-zinc-300 font-medium">Private Google Drive Storage:</strong> Your library stays 100% yours. When signing in, Google will request permission to store your library data securely.
      </span>
     </div>
    </div>

    {/* Google SSO Button */}
    <button
     onClick={handleGoogleSignIn}
     disabled={submitting}
     className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-medium text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
    >
     <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
     </svg>
     <span>{submitting ? "Connecting..." : "Continue with Google"}</span>
    </button>

    {error && (
     <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg">
      {error}
     </p>
    )}

    <div className="pt-2 border-t border-zinc-900 text-center">
     <p className="text-[11px] text-zinc-500">
      Fast, secure authentication. Saved directly to your personal Google storage.
     </p>
    </div>
   </div>
  </div>
 );
}
