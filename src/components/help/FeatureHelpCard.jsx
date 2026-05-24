// src/components/help/FeatureHelpCard.jsx — Expandable feature help card
// Compact: icon + title + status. Click to expand: description, numbered steps,
// setup badge, hotkey, learn more link.
// Design: PRD Feature 10 — per-feature cards in Help screen.

import { useState } from 'react';
import { Badge, KbdBadge } from '../ui';

export default function FeatureHelpCard({ helpEntry }) {
  const [expanded, setExpanded] = useState(false);

  if (!helpEntry) return null;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 cursor-pointer
        dark:bg-[#1E293B] dark:border-[#334155]
        bg-white border-slate-200
        ${expanded
          ? 'dark:border-blue-600/30 border-blue-200 shadow-sm'
          : 'dark:hover:border-[#475569] hover:border-slate-300'
        }`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Compact header — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-base shrink-0">{helpEntry.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium dark:text-slate-200 text-slate-700 truncate">
            {helpEntry.title}
          </p>
          {!expanded && (
            <p className="text-[11px] dark:text-[#64748B] text-slate-400 truncate mt-0.5">
              {helpEntry.shortDescription}
            </p>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-1.5 shrink-0">
          {helpEntry.setupRequired && (
            <span className="w-2 h-2 rounded-full bg-blue-500" title="Setup required" />
          )}
          {helpEntry.hotkey && !expanded && (
            <KbdBadge>{helpEntry.hotkey}</KbdBadge>
          )}
          <ChevronIcon expanded={expanded} />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3
          border-t dark:border-[#334155]/50 border-slate-100">

          {/* Description */}
          <p className="text-xs leading-relaxed dark:text-[#94A3B8] text-slate-500 pt-3">
            {helpEntry.shortDescription}
          </p>

          {/* Numbered steps */}
          {helpEntry.steps && helpEntry.steps.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider
                dark:text-[#475569] text-slate-400">
                How to use
              </p>
              <ol className="space-y-1.5">
                {helpEntry.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                    <span className="flex items-center justify-center shrink-0
                      w-5 h-5 rounded-full text-[10px] font-bold mt-0.5
                      dark:bg-blue-600/20 dark:text-blue-400
                      bg-blue-50 text-blue-600">
                      {i + 1}
                    </span>
                    <span className="dark:text-slate-300 text-slate-600 flex-1">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Footer: badges + link */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {helpEntry.setupRequired && (
                <Badge variant="blue">Setup required</Badge>
              )}
              {helpEntry.hotkey && (
                <KbdBadge>{helpEntry.hotkey}</KbdBadge>
              )}
            </div>

            {helpEntry.learnMoreUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.antonAPI?.openExternal(helpEntry.learnMoreUrl);
                }}
                className="text-[11px] dark:text-blue-400 text-blue-600 hover:underline"
              >
                Learn more →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`dark:text-[#475569] text-slate-400 transition-transform duration-200
        ${expanded ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
