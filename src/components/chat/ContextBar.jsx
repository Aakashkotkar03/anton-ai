// src/components/chat/ContextBar.jsx — Context usage bar + token label
// Thin 4px strip below chat input. Colour changes with fill level.
// Expands on hover to show token count + [?] icon.

import { useState } from 'react';
import ContextInfoCard from './ContextInfoCard';

export default function ContextBar({
  used = 0,
  total = 4096,
  limitReason = 'model',
  ramGB = 0,
  effectiveCtx = 4096,
}) {
  const [hovered, setHovered] = useState(false);
  const [showInfoCard, setShowInfoCard] = useState(false);

  const fillRatio = total > 0 ? Math.min(used / total, 1) : 0;
  const fillPercent = Math.round(fillRatio * 100);

  // Colour zones from PRD
  const barColour = getBarColour(fillRatio);

  return (
    <div className="relative w-full">
      {/* Bar container */}
      <div
        className={`w-full transition-all duration-200 ${
          hovered ? 'h-5' : 'h-1'
        } dark:bg-slate-700 bg-slate-200 rounded-full overflow-hidden cursor-pointer`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setShowInfoCard((v) => !v)}
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Context usage: ${used.toLocaleString()} of ${total.toLocaleString()} tokens`}
      >
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: barColour,
          }}
        />
      </div>

      {/* Token label — visible on hover */}
      <div
        className={`flex items-center justify-between mt-1 transition-opacity duration-200 ${
          hovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="text-[10px] dark:text-slate-500 text-slate-400 font-mono">
          {used.toLocaleString()} / {total.toLocaleString()} tokens
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoCard((v) => !v);
          }}
          className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold
            dark:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200
            bg-slate-200 text-slate-400 hover:text-slate-600
            transition-colors"
          aria-label="Context info"
        >
          ?
        </button>
      </div>

      {/* Context Info Card popover */}
      {showInfoCard && (
        <ContextInfoCard
          limitReason={limitReason}
          ramGB={ramGB}
          effectiveCtx={effectiveCtx}
          fillPercent={fillPercent}
          onClose={() => setShowInfoCard(false)}
        />
      )}
    </div>
  );
}

function getBarColour(ratio) {
  if (ratio > 0.95) return '#8B5CF6'; // purple — distillation zone
  if (ratio > 0.80) return '#EF4444'; // red
  if (ratio > 0.60) return '#F59E0B'; // amber
  return '#10B981';                    // green
}
