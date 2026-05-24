// src/components/help/TokenEducationCard.jsx — Context window education card
// Highlighted "aha moment" card explaining why local AI has smaller context than ChatGPT.
// Dynamic: reads user's actual RAM and effective context from hardware store.
// Design: PRD Feature 10 + UI/UX SCREEN 11A — Section 3 highlighted card.

import useHardwareStore from '../../stores/useHardwareStore';

export default function TokenEducationCard() {
  const specs = useHardwareStore((s) => s.specs);
  const tier = useHardwareStore((s) => s.tier) || 1;

  const ramGB = specs?.ramGB || 8;
  // Rough effective context estimate based on RAM (same formula as hardware.js)
  const effectiveTokens = Math.min(
    131072,
    Math.floor((ramGB * 1024 * 0.40) / 256) * 1024
  );
  const effectiveWords = Math.round(effectiveTokens * 0.75);

  return (
    <div className="rounded-xl p-5
      dark:bg-[#1E3A5F]/30 dark:border dark:border-blue-600/30
      bg-[#EFF6FF] border border-blue-200">

      {/* Header row */}
      <div className="flex items-start gap-4">
        <span className="text-3xl shrink-0 mt-1">🧠</span>

        <div className="flex-1 space-y-3">
          {/* Heading */}
          <h3 className="text-sm font-bold dark:text-slate-100 text-slate-900">
            Why is my AI memory smaller than ChatGPT?
          </h3>

          {/* Explanation */}
          <div className="text-xs leading-relaxed dark:text-slate-300 text-slate-600 space-y-2">
            <p>
              Context windows define how much text the AI can "see" at once — like working memory.
              ChatGPT uses cloud servers with terabytes of RAM. Your PC
              has <span className="font-semibold dark:text-blue-300 text-blue-700">{ramGB} GB</span>,
              which gives you
              ~<span className="font-semibold dark:text-blue-300 text-blue-700">{effectiveTokens.toLocaleString()} tokens</span>
              (~{effectiveWords.toLocaleString()} words).
            </p>

            <p>
              This is the tradeoff for complete privacy — your data never leaves your device,
              there are no API costs, and it works offline. Anton AI makes the most of your
              hardware with automatic summarisation, smart document chunking, and context compression.
            </p>
          </div>

          {/* Hardware-specific tip */}
          <div className="rounded-lg px-3 py-2
            dark:bg-[#0F172A]/60 bg-white/60
            border dark:border-blue-600/20 border-blue-200">
            <p className="text-[11px] dark:text-slate-400 text-slate-500">
              {tier <= 2 && (
                <>💡 Upgrading to 16 GB RAM would give you ~25,000 tokens — enough for most documents in a single pass.</>
              )}
              {tier === 3 && (
                <>💡 Your setup can handle most tasks. For very long documents, Anton AI automatically searches the most relevant sections.</>
              )}
              {tier >= 4 && (
                <>💡 Your hardware is excellent — you can load large documents and have extended conversations with minimal summarisation.</>
              )}
            </p>
          </div>

          {/* Learn more link */}
          <button
            onClick={() => window.antonAPI?.openExternal('https://antonai.dev/tokens')}
            className="text-xs dark:text-blue-400 text-blue-600 hover:underline"
          >
            Deep dive: antonai.dev/tokens →
          </button>
        </div>
      </div>
    </div>
  );
}
