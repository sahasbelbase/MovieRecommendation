import React, { useState, useEffect, useCallback } from 'react';
import { MousePointer } from 'lucide-react';

export default function TvVirtualPointer({ isActive = true, containerRef = null }) {
  const [pos, setPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [visible, setVisible] = useState(false);

  const STEP = 35; // Pixels per D-Pad press

  const handleKeyDown = useCallback((e) => {
    if (!isActive) return;

    const isDpad = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key) ||
                   [19, 20, 21, 22, 23, 66, 85].includes(e.keyCode);

    if (!isDpad) return;

    setVisible(true);

    if (['ArrowUp', '19'].includes(e.key) || e.keyCode === 19) {
      setPos(p => ({ ...p, y: Math.max(50, p.y - STEP) }));
    } else if (['ArrowDown', '20'].includes(e.key) || e.keyCode === 20) {
      setPos(p => ({ ...p, y: Math.min(window.innerHeight - 50, p.y + STEP) }));
    } else if (['ArrowLeft', '21'].includes(e.key) || e.keyCode === 21) {
      setPos(p => ({ ...p, x: Math.max(50, p.x - STEP) }));
    } else if (['ArrowRight', '22'].includes(e.key) || e.keyCode === 22) {
      setPos(p => ({ ...p, x: Math.min(window.innerWidth - 50, p.x + STEP) }));
    } else if (['Enter', ' ', '23', '66'].includes(e.key) || [23, 66].includes(e.keyCode)) {
      // Execute click at point
      const el = document.elementFromPoint(pos.x, pos.y);
      if (el) {
        el.click();
        if (typeof el.focus === 'function') el.focus();
      }
    }
  }, [isActive, pos.x, pos.y]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Hide cursor after 5 seconds of inactivity
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [visible, pos]);

  if (!visible || !isActive) return null;

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center animate-pulse"
    >
      <div className="w-8 h-8 rounded-full border-2 border-purple-400 bg-purple-600/40 shadow-2xl flex items-center justify-center">
        <MousePointer className="w-4 h-4 text-white fill-purple-400" />
      </div>
    </div>
  );
}
