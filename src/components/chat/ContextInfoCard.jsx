// src/components/chat/ContextInfoCard.jsx — Hardware-aware context explanation popover
// Explains WHY the context window is limited and suggests upgrades.

export default function ContextInfoCard({
  limitReason,
  ramGB,
  effectiveCtx,
  fillPercent,
  onClose,
}) {
  const info = getInfoForReason(limitReason, ramGB, effectiveCtx);
  const words = Math.round(effectiveCtx * 0.75); // ~0.75 words per token

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Card */}
      <div className="absolute bottom-8 right-0 z-50 w-80 rounded-xl border p-4 shadow-lg
        dark:bg-slate-800 dark:border-slate-700
        bg-white border-slate-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-xs dark:text-slate-500 text-slate-400
            hover:dark:text-slate-300 hover:text-slate-600"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Heading */}
        <h3 className="text-sm font-semibold dark:text-slate-100 text-slate-800 pr-6">
          {info.heading}
        </h3>

        {/* Body */}
        <p className="mt-2 text-[13px] leading-relaxed dark:text-slate-300 text-slate-600">
          {info.body}
        </p>

        {/* Stats */}
        <div className="mt-3 flex gap-3 text-[11px] dark:text-slate-400 text-slate-500">
          <span>{effectiveCtx.toLocaleString()} tokens</span>
          <span>·</span>
          <span>~{words.toLocaleString()} words</span>
          <span>·</span>
          <span>{fillPercent}% used</span>
        </div>

        {/* Upgrade tip */}
        <div className="mt-3 rounded-lg p-2.5 border-l-4
          dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-300
          bg-blue-50 border-blue-400 text-blue-700">
          <p className="text-xs leading-relaxed">
            {info.tip}
          </p>
        </div>

        {/* Help link */}
        <button
          onClick={() => {
            window.antonAPI.openExternal('https://antonai.dev/tokens');
          }}
          className="mt-3 text-xs dark:text-blue-400 text-blue-600 hover:underline"
        >
          Learn more about context windows →
        </button>
      </div>
    </>
  );
}

function getInfoForReason(reason, ramGB, effectiveCtx) {
  switch (reason) {
    case 'ram':
      return {
        heading: 'Limited by your PC\'s RAM',
        body: `Your PC has ${ramGB} GB RAM. This allows approximately ${effectiveCtx.toLocaleString()} tokens of context. More RAM means the AI can remember more of your conversation.`,
        tip: ramGB < 16
          ? 'Upgrading to 16 GB RAM would give you ~25,000 tokens — enough for most documents.'
          : 'Upgrading to 32 GB RAM would unlock up to 93,000 tokens with compatible models.',
      };

    case 'vram':
      return {
        heading: 'Limited by your GPU VRAM',
        body: `Your GPU's VRAM is the current bottleneck, allowing ${effectiveCtx.toLocaleString()} tokens. GPU memory is faster than RAM for AI inference.`,
        tip: 'A GPU with 8+ GB VRAM would unlock significantly larger context windows and faster responses.',
      };

    case 'model':
      return {
        heading: 'Using this model\'s full context',
        body: `Good news — your hardware isn't the limit. This model natively supports ${effectiveCtx.toLocaleString()} tokens, and your PC can handle all of it.`,
        tip: 'Try Mistral 7B or Qwen 2.5 7B for up to 131,072 tokens of native context.',
      };

    default:
      return {
        heading: 'Context Window',
        body: `Currently using ${effectiveCtx.toLocaleString()} tokens of context.`,
        tip: 'Load a model to see hardware-specific recommendations.',
      };
  }
}
