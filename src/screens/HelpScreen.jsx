// src/screens/HelpScreen.jsx — Searchable help, feature guides, token education (PRD Feature 10)
// Design: UI/UX SCREEN 11A (HelpScreen_Dark) + SCREEN 11B
//
// Sections:
//   1. Search bar (instant local filter)
//   2. Getting Started — Quick Start + Take the Tour
//   3. Features — expandable FeatureHelpCards grid
//   4. Token Education — highlighted TokenEducationCard
//   5. Troubleshooting — expandable issue cards

import { useState, useMemo, useCallback } from 'react';
import { searchHelp, getByCategory } from '../data/helpContent';
import FeatureHelpCard from '../components/help/FeatureHelpCard';
import TokenEducationCard from '../components/help/TokenEducationCard';
import WalkthroughOverlay from '../components/help/WalkthroughOverlay';
import { Button } from '../components/ui';

export default function HelpScreen() {
  const [query, setQuery] = useState('');
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // --- Filtered content ---
  const isSearching = query.trim().length > 0;
  const searchResults = useMemo(() => searchHelp(query), [query]);

  // Category slices (only used when NOT searching)
  const gettingStarted = useMemo(() => getByCategory('getting_started'), []);
  const features = useMemo(() => getByCategory('features'), []);
  const education = useMemo(() => getByCategory('education'), []);
  const troubleshooting = useMemo(() => getByCategory('troubleshooting'), []);

  // --- Walkthrough handlers ---
  const handleStartTour = useCallback(() => setShowWalkthrough(true), []);
  const handleTourComplete = useCallback(() => setShowWalkthrough(false), []);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Walkthrough overlay (full-screen, above everything) */}
      {showWalkthrough && (
        <WalkthroughOverlay
          onComplete={handleTourComplete}
          onSkip={handleTourComplete}
        />
      )}

      {/* ================================================================ */}
      {/* SEARCH BAR                                                       */}
      {/* ================================================================ */}
      <div className="shrink-0 px-6 pt-5 pb-3">
        <div className="relative">
          <SearchIcon />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help, features, and guides..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm
              dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
              dark:placeholder-[#475569]
              bg-white border border-slate-200 text-slate-800 placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-500/40
              transition-shadow"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2
                dark:text-slate-500 dark:hover:text-slate-300
                text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* CONTENT — scrollable                                             */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">

        {/* ============================================================ */}
        {/* SEARCH RESULTS MODE                                          */}
        {/* ============================================================ */}
        {isSearching && (
          <>
            <p className="text-xs dark:text-[#64748B] text-slate-400">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{query}"
            </p>
            {searchResults.length === 0 && (
              <div className="flex flex-col items-center py-12">
                <span className="text-2xl mb-3">🔍</span>
                <p className="text-sm dark:text-slate-400 text-slate-500">
                  No results found for "{query}"
                </p>
                <button
                  onClick={() => setQuery('')}
                  className="mt-2 text-xs dark:text-blue-400 text-blue-600 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {searchResults.map((entry) => (
                <FeatureHelpCard key={entry.id} helpEntry={entry} />
              ))}
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* NORMAL MODE (no search)                                       */}
        {/* ============================================================ */}
        {!isSearching && (
          <>
            {/* SECTION 1 — Getting Started */}
            <div>
              <SectionLabel>Getting Started</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gettingStarted.map((entry) => (
                  <GettingStartedCard
                    key={entry.id}
                    entry={entry}
                    onTour={entry.id === 'walkthrough' ? handleStartTour : null}
                  />
                ))}
              </div>
            </div>

            {/* SECTION 2 — Features */}
            <div>
              <SectionLabel>Features</SectionLabel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {features.map((entry) => (
                  <FeatureHelpCard key={entry.id} helpEntry={entry} />
                ))}
              </div>
            </div>

            {/* SECTION 3 — Understanding AI Memory */}
            <div>
              <SectionLabel>Understanding Your AI Memory</SectionLabel>
              <TokenEducationCard />
            </div>

            {/* SECTION 4 — Troubleshooting */}
            <div>
              <SectionLabel>Troubleshooting</SectionLabel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {troubleshooting.map((entry) => (
                  <FeatureHelpCard key={entry.id} helpEntry={entry} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Getting Started cards — slightly different from FeatureHelpCard
// ---------------------------------------------------------------------------
function GettingStartedCard({ entry, onTour }) {
  return (
    <div className="rounded-xl p-4
      dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:hover:border-blue-600/30
      bg-white border border-slate-200 hover:border-blue-200
      transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{entry.icon}</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold dark:text-slate-100 text-slate-800 mb-1">
            {entry.title}
          </h3>
          <p className="text-xs dark:text-[#94A3B8] text-slate-500 mb-3 leading-relaxed">
            {entry.shortDescription}
          </p>

          {/* Steps preview (first 3 for Quick Start) */}
          {entry.steps && entry.id === 'quick-start' && (
            <ol className="space-y-1.5 mb-3">
              {entry.steps.slice(0, 3).map((step, i) => (
                <li key={i} className="flex gap-2 text-[11px] leading-relaxed">
                  <span className="flex items-center justify-center shrink-0
                    w-4 h-4 rounded-full text-[9px] font-bold
                    dark:bg-blue-600/20 dark:text-blue-400
                    bg-blue-50 text-blue-600">
                    {i + 1}
                  </span>
                  <span className="dark:text-slate-400 text-slate-500 flex-1">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {onTour ? (
            <Button variant="secondary" size="sm" onClick={onTour}>
              🗺️ Take the Tour
            </Button>
          ) : (
            <span className="text-[11px] dark:text-blue-400 text-blue-600">
              {entry.steps?.length || 0} steps
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3
      dark:text-[#475569] text-[#94A3B8]">
      {children}
    </p>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4
        dark:text-[#475569] text-slate-400 pointer-events-none"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
