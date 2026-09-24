import React from 'react';
import { Check, X } from 'lucide-react';

export default function Toast({ toast, onUndo, onClose }) {
 if (!toast) return null;

 return (
  <div
   role="status"
   aria-live="polite"
   className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-zinc-900/95 border border-zinc-700/80 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200"
  >
   <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400">
    <Check className="w-4 h-4" />
   </div>
   <div className="text-sm font-medium text-zinc-200">
    {toast.message}
   </div>
   {onUndo && (
    <button
     type="button"
     onClick={onUndo}
     className="ml-2 text-xs font-semibold text-rose-400 hover:text-rose-300 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded px-1"
    >
     Undo
    </button>
   )}
   <button
    type="button"
    onClick={onClose}
    aria-label="Dismiss notification"
    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg"
   >
    <X className="w-3.5 h-3.5" />
   </button>
  </div>
 );
}
