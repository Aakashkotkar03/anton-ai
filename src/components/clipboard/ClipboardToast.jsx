// src/components/clipboard/ClipboardToast.jsx — Result toast after clipboard action
// Shows success message, result preview, undo button, and auto-dismiss progress bar.
// Design: PRD Feature 4 — result toast, bottom-right.

import { useState, useEffect, useRef, useCallback } from 'react';

export default function ClipboardToast({
  result,
  originalText,
  onUndo,
  onDismiss,
  autoDismissMs = 5000,
}) {
  const [undone, setUndone] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(Date.now());
  const remainingRef = useRef(autoDismissMs);
  const barRef = useRef(null);

  // --- Auto-dismiss timer ---
  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, remainingRef.current);
  }, [onDismiss]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  // Pause on hover
  const handleMouseEnter = () => {
    setPaused(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      // Calculate remaining time
      const elapsed = Date.now() - startRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  };

  const handleMouseLeave = () => {
    setPaused(false);
    startTimer();
  };

  // --- Undo handler ---
  const handleUndo = useCallback(async () => {
    if (undone) return;
    try {
      await window.antonAPI.clipboardUndo(originalText);
      setUndone(true);
      if (onUndo) onUndo();

      // Show "Restored" briefly then dismiss
      setTimeout(() => {
        onDismiss();
      }, 1500);
    } catch (_err) {
      // ignore
    }
  }, [originalText, onUndo, onDismiss, undone]);

  // --- Undo confirmation state ---
  if (undone) {
    return (
      <div className="w-80 rounded-xl p-4
        dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:shadow-2xl
        bg-white border border-slate-200 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-green-500 text-sm">↩</span>
          <span className="text-xs font-medium dark:text-green-400 text-green-600">
            Restored — original text back in clipboard
          </span>
        </div>
      </div>
    );
  }

  // --- Main toast ---
  return (
    <div
      className="w-80 rounded-xl overflow-hidden
        dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:shadow-2xl
        bg-white border border-slate-200 shadow-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="p-4 space-y-2.5">
        {/* Row 1: Success */}
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500">
            <CheckIcon />
          </span>
          <span className="text-xs font-medium dark:text-slate-200 text-slate-800">
            Clipboard updated
          </span>
        </div>

        {/* Row 2: Preview */}
        {result && (
          <p className="text-xs leading-relaxed truncate
            dark:text-slate-400 text-slate-500">
            {result.slice(0, 60)}{result.length > 60 ? '…' : ''}
          </p>
        )}

        {/* Row 3: Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleUndo}
            className="text-xs dark:text-slate-400 dark:hover:text-white
              text-slate-500 hover:text-slate-800 transition-colors"
          >
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="text-xs dark:text-blue-400 dark:hover:text-blue-300
              text-blue-600 hover:text-blue-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Progress bar — auto-dismiss countdown */}
      <div className="h-1 w-full dark:bg-[#334155] bg-slate-100">
        <div
          ref={barRef}
          className="h-full bg-blue-500 rounded-r-full"
          style={{
            animation: paused
              ? 'none'
              : `antonai-toast-shrink ${autoDismissMs}ms linear forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
        <style>{`
          @keyframes antonai-toast-shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
