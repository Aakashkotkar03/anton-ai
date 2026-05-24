// src/screens/ClipboardIndicatorWindow.jsx — Clipboard AI overlay
// Renders inside the tiny transparent 220×56 BrowserWindow.
// Shows: pulsing indicator dot → action wheel → processing spinner → result toast.
//
// States:
//   idle         → dot hidden (window hidden by main.js)
//   dot          → pulsing blue circle, click to open wheel
//   wheel        → 7 action buttons in a compact grid
//   processing   → spinning circle + "Processing..."
//   result       → brief success/error toast, then auto-dismiss

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// 7 clipboard actions
// ---------------------------------------------------------------------------
const ACTIONS = [
  { id: 'clipboard-improve',   label: 'Improve',   icon: '✨' },
  { id: 'clipboard-shorten',   label: 'Shorten',   icon: '✂️' },
  { id: 'clipboard-formal',    label: 'Formal',    icon: '👔' },
  { id: 'clipboard-casual',    label: 'Casual',    icon: '😊' },
  { id: 'clipboard-translate', label: 'Translate',  icon: '🌐' },
  { id: 'clipboard-explain',   label: 'Explain',   icon: '💡' },
  { id: 'clipboard-continue',  label: 'Continue',  icon: '➡️' },
];

export default function ClipboardIndicatorWindow() {
  const [clipboardText, setClipboardText] = useState('');
  const [showWheel, setShowWheel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);      // { success, message, originalText }
  const [originalText, setOriginalText] = useState('');
  const resultTimeoutRef = useRef(null);

  // --- Mount: listen for clipboard changes ---
  useEffect(() => {
    const cleanupChanged = window.antonAPI.onClipboardChanged((data) => {
      setClipboardText(data.text || '');
      // Reset UI when new clipboard content arrives
      setShowWheel(false);
      setIsProcessing(false);
      setResult(null);
    });

    return cleanupChanged;
  }, []);

  // --- Mount: listen for Ctrl+Shift+L (openWheel from main process) ---
  useEffect(() => {
    const cleanupWheel = window.antonAPI.onOpenWheel(() => {
      setShowWheel(true);
      setResult(null);
    });

    return cleanupWheel;
  }, []);

  // --- Mount: listen for processing/result/error events ---
  useEffect(() => {
    const cleanupProcessing = window.antonAPI.onClipboardProcessing(() => {
      setIsProcessing(true);
      setResult(null);
    });

    const cleanupResult = window.antonAPI.onClipboardResult((data) => {
      setIsProcessing(false);
      setShowWheel(false);
      setOriginalText(data.originalText || '');
      setResult({ success: true, message: 'Done — copied to clipboard' });
      autoHideResult();
    });

    const cleanupError = window.antonAPI.onClipboardError((data) => {
      setIsProcessing(false);
      setResult({ success: false, message: data.error || 'Action failed' });
      autoHideResult();
    });

    return () => {
      cleanupProcessing();
      cleanupResult();
      cleanupError();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Auto-hide result toast after 4 seconds ---
  const autoHideResult = useCallback(() => {
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = setTimeout(() => {
      setResult(null);
    }, 4000);
  }, []);

  // --- Handle action click ---
  const handleAction = useCallback(async (actionId) => {
    if (!clipboardText || clipboardText.trim().length === 0) return;
    try {
      await window.antonAPI.clipboardAction(actionId, clipboardText);
      // Result arrives via onClipboardResult event
    } catch (_err) {
      // Error arrives via onClipboardError event
    }
  }, [clipboardText]);

  // --- Handle undo ---
  const handleUndo = useCallback(async () => {
    if (!originalText) return;
    try {
      await window.antonAPI.clipboardUndo(originalText);
      setResult({ success: true, message: 'Undone — original restored' });
      autoHideResult();
    } catch (_err) {
      // ignore
    }
  }, [originalText, autoHideResult]);

  // --- Handle close wheel ---
  const handleClose = useCallback(() => {
    setShowWheel(false);
  }, []);

  // --- Render ---
  // The window is transparent, so the background must be explicitly styled.
  // body/html are transparent via the BrowserWindow transparent:true flag.

  // Processing state
  if (isProcessing) {
    return (
      <div className="flex items-center gap-2.5 h-full px-3">
        <div className="relative flex items-center justify-center w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold text-blue-400">A</span>
        </div>
        <span className="text-xs text-slate-300 font-medium">Processing...</span>
      </div>
    );
  }

  // Result toast (success or error)
  if (result) {
    return (
      <div className="flex items-center gap-2.5 h-full px-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
          result.success ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="text-sm">{result.success ? '✓' : '✕'}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-slate-200 font-medium truncate max-w-[120px]">
            {result.message}
          </span>
          {result.success && originalText && (
            <button
              onClick={handleUndo}
              className="text-[10px] text-blue-400 hover:text-blue-300 text-left mt-0.5"
            >
              Undo
            </button>
          )}
        </div>
      </div>
    );
  }

  // Action wheel
  if (showWheel) {
    return <ActionWheel onAction={handleAction} onClose={handleClose} />;
  }

  // Default: pulsing indicator dot
  return (
    <div className="flex items-center justify-start h-full px-1">
      <button
        onClick={() => setShowWheel(true)}
        title={clipboardText ? clipboardText.slice(0, 40) : 'Clipboard AI'}
        className="relative flex items-center justify-center w-12 h-12 group"
      >
        {/* Pulsing ring */}
        <span className="absolute inset-0 rounded-full bg-blue-500 opacity-40 animate-ping" />
        {/* Solid dot */}
        <span className="relative flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 shadow-lg shadow-blue-600/40 group-hover:bg-blue-500 transition-colors">
          <span className="text-sm font-bold text-white">A</span>
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionWheel — compact grid of 7 action buttons
// ---------------------------------------------------------------------------
// Renders as a horizontal strip that fits the 220px wide window.
// Two rows: 4 on top, 3 on bottom + close button.
//
function ActionWheel({ onAction, onClose }) {
  return (
    <div className="flex flex-col gap-1 p-1.5 h-full justify-center">
      {/* Row 1: first 4 actions */}
      <div className="flex gap-1">
        {ACTIONS.slice(0, 4).map((a) => (
          <ActionButton key={a.id} action={a} onClick={onAction} />
        ))}
      </div>
      {/* Row 2: last 3 actions + close */}
      <div className="flex gap-1">
        {ACTIONS.slice(4).map((a) => (
          <ActionButton key={a.id} action={a} onClick={onAction} />
        ))}
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded
            w-[50px] h-[22px] text-[9px]
            bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200
            transition-colors"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ActionButton({ action, onClick }) {
  return (
    <button
      onClick={() => onClick(action.id)}
      title={action.label}
      className="flex items-center justify-center rounded
        w-[50px] h-[22px] text-[9px] gap-0.5
        bg-slate-800 border border-slate-700 text-slate-300
        hover:bg-blue-600 hover:border-blue-500 hover:text-white
        transition-colors"
    >
      <span>{action.icon}</span>
      <span className="truncate">{action.label}</span>
    </button>
  );
}
