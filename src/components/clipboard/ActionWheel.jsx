// src/components/clipboard/ActionWheel.jsx — Radial action wheel (PRD Feature 4)
// 7 action pills arranged radially around a centre circle using Math.cos/sin.
// Keyboard navigable: arrow keys, Enter, Escape.
// Design: UI/UX SCREEN 4A (ClipboardWheel_Dark)

import { useState, useEffect, useCallback, useRef } from 'react';

const ACTIONS = [
  { id: 'clipboard-improve',   icon: '✨', label: 'Improve Writing' },
  { id: 'clipboard-shorten',   icon: '✂️', label: 'Make Shorter'    },
  { id: 'clipboard-formal',    icon: '👔', label: 'Make Formal'     },
  { id: 'clipboard-casual',    icon: '😊', label: 'Make Casual'     },
  { id: 'clipboard-translate', icon: '🌍', label: 'Translate'       },
  { id: 'clipboard-explain',   icon: '💡', label: 'Explain This'    },
  { id: 'clipboard-continue',  icon: '✍️', label: 'Continue'        },
];

// Radial positions: 7 cards evenly spaced around a circle
const RADIUS = 140; // px from centre to card centre
const CONTAINER_SIZE = 340; // px square
const CARD_W = 148;
const CARD_H = 52;
const CENTER = CONTAINER_SIZE / 2;

function getCardPosition(index, total) {
  // Start from top (12 o'clock = -π/2), go clockwise
  const angle = ((2 * Math.PI) / total) * index - Math.PI / 2;
  return {
    left: CENTER + RADIUS * Math.cos(angle) - CARD_W / 2,
    top: CENTER + RADIUS * Math.sin(angle) - CARD_H / 2,
  };
}

export default function ActionWheel({ clipboardText, onAction, onClose, isProcessing }) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);

  // --- Keyboard navigation ---
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Enter' && focusedIndex >= 0) {
        onAction(ACTIONS[focusedIndex].id);
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % ACTIONS.length);
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + ACTIONS.length) % ACTIONS.length);
        return;
      }
    },
    [focusedIndex, onAction, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus container on mount for keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // --- Processing state ---
  if (isProcessing) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
      >
        {/* Centre circle — loading */}
        <div className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full bg-blue-600">
          <div className="absolute w-[64px] h-[64px] rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold text-white">A</span>
        </div>
        <span className="absolute mt-20 text-xs dark:text-slate-400 text-slate-500">
          Working...
        </span>
      </div>
    );
  }

  // --- Radial wheel ---
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative outline-none"
      style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
    >
      {/* Centre circle — Anton AI logo */}
      <div
        className="absolute flex flex-col items-center justify-center
          w-[52px] h-[52px] rounded-full bg-blue-600
          border-2 border-blue-400
          shadow-[0_0_16px_rgba(37,99,235,0.4)]"
        style={{
          left: CENTER - 26,
          top: CENTER - 26,
        }}
      >
        <span className="text-base font-bold text-white">A</span>
      </div>

      {/* Clipboard preview — below centre */}
      {clipboardText && (
        <div
          className="absolute text-center px-2"
          style={{
            left: CENTER - 70,
            top: CENTER + 30,
            width: 140,
          }}
        >
          <p className="text-[10px] truncate dark:text-slate-500 text-slate-400">
            {clipboardText.slice(0, 50)}{clipboardText.length > 50 ? '…' : ''}
          </p>
        </div>
      )}

      {/* 7 action cards — radially positioned */}
      {ACTIONS.map((action, i) => {
        const pos = getCardPosition(i, ACTIONS.length);
        const isFocused = focusedIndex === i;

        return (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            onMouseEnter={() => setFocusedIndex(i)}
            onMouseLeave={() => setFocusedIndex(-1)}
            className={`absolute flex items-center gap-2 px-3 rounded-xl
              transition-all duration-150 ease-out
              ${isFocused
                ? 'bg-blue-600 text-white border-blue-600 scale-105 shadow-[0_0_20px_rgba(37,99,235,0.5)]'
                : 'dark:bg-[#1E293B] dark:border-[#334155] dark:text-slate-200 bg-white border-slate-200 text-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.15)]'
              }
              border`}
            style={{
              left: pos.left,
              top: pos.top,
              width: CARD_W,
              height: CARD_H,
            }}
          >
            <span className="text-base shrink-0">{action.icon}</span>
            <span className="text-xs font-medium truncate">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
