// src/components/documents/ChunkWarning.jsx — Chunk strategy warning banner
// Shown when a document exceeds the context window (strategy === 'chunked').
// Design: PRD Feature 3 — amber warning banner.

export default function ChunkWarning({ fullTokens, docBudget, fileName }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-lg mx-3 mt-2 shrink-0
        dark:bg-[#78350F]/30 dark:border-t dark:border-b dark:border-amber-700/40
        bg-amber-50 border border-amber-200"
    >
      {/* Icon */}
      <span className="text-base mt-0.5 shrink-0">⚠️</span>

      <div className="flex flex-col gap-1.5 min-w-0">
        {/* Main message */}
        <p className="text-xs leading-relaxed dark:text-amber-200 text-amber-800">
          <span className="font-semibold">{fileName || 'This document'}</span> has
          ~{fullTokens?.toLocaleString()} tokens — larger than your current AI
          memory ({docBudget?.toLocaleString()} tokens).
        </p>

        {/* Tip */}
        <p className="text-[11px] leading-relaxed dark:text-amber-300/70 text-amber-700">
          Anton AI will search for relevant sections when you ask questions.
          Tip: ask specific questions for best results.
        </p>

        {/* Links */}
        <div className="flex items-center gap-4 mt-0.5">
          <button
            onClick={() => window.antonAPI.openExternal('https://antonai.dev/tokens')}
            className="text-[11px] dark:text-amber-400 text-amber-600
              hover:underline cursor-pointer"
          >
            Learn more →
          </button>
        </div>
      </div>
    </div>
  );
}
