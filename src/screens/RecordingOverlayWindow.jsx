// src/screens/RecordingOverlayWindow.jsx — Voice recording overlay
// Renders inside a tiny transparent 280×60 BrowserWindow at bottom-centre.
// Design: PRD Feature 5 + UI/UX SCREEN 9A (VoiceOverlay_Dark)
//
// States:
//   recording    → pulsing red dot + timer + "Win+Alt+V to stop"
//   transcribing → blue spinner + "Transcribing..."
//
// The overlay is shown/hidden by main.js. This component only renders the UI.

import { useState, useEffect, useRef, useCallback } from 'react';

export default function RecordingOverlayWindow() {
  const [state, setState] = useState('idle'); // 'idle' | 'recording' | 'transcribing'
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Listen for recording started
  useEffect(() => {
    const cleanup = window.antonAPI.onRecordingStarted((data) => {
      startTimeRef.current = data?.startTime || Date.now();
      setElapsed(0);
      setState('recording');
    });
    return cleanup;
  }, []);

  // Listen for transcribing state
  useEffect(() => {
    const cleanup = window.antonAPI.onRecordingTranscribing(() => {
      setState('transcribing');
      // Stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
    return cleanup;
  }, []);

  // Run timer when recording
  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const start = startTimeRef.current || now;
        setElapsed(Math.floor((now - start) / 1000));
      }, 200);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  // Format seconds as M:SS
  const formatTime = useCallback((secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  // Idle — window is hidden, render nothing
  if (state === 'idle') return null;

  // Recording state
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3 h-full px-4 rounded-full
        bg-slate-800/95 border border-slate-700
        shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(239,68,68,0.15)]">
        {/* Pulsing red dot */}
        <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-50 animate-ping" />
          <span className="relative w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>

        {/* Timer */}
        <span className="text-sm text-slate-200 font-medium min-w-[60px]">
          Recording<span className="text-red-400 font-mono ml-1.5">{formatTime(elapsed)}</span>
        </span>

        {/* Hint */}
        <span className="text-[10px] text-slate-500 ml-auto whitespace-nowrap">
          Press again to stop
        </span>
      </div>
    );
  }

  // Transcribing state
  return (
    <div className="flex items-center gap-3 h-full px-4 rounded-full
      bg-slate-800/95 border border-slate-700
      shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* Spinning blue circle */}
      <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>

      <span className="text-sm text-slate-300 font-medium">Transcribing...</span>
    </div>
  );
}
