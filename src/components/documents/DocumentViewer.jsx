// src/components/documents/DocumentViewer.jsx — Left panel: document text viewer
// Scrollable text with file info bar and bottom fade.
// Design: PRD Feature 3 + UI/UX SCREEN 3A (DocumentScreen_Dark).

const FILE_ICONS = {
  '.pdf': { icon: '📄', color: 'text-red-500' },
  '.docx': { icon: '📝', color: 'text-blue-500' },
  '.txt': { icon: '📃', color: 'text-slate-400' },
  '.md': { icon: '📃', color: 'text-slate-400' },
  '.csv': { icon: '📊', color: 'text-green-500' },
};

export default function DocumentViewer({ content, fileName, fullTokens, strategy, ext }) {
  const fileInfo = FILE_ICONS[ext] || FILE_ICONS['.txt'];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0
        border-b dark:border-[#334155] border-slate-200">
        {/* File name + icon */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm ${fileInfo.color}`}>{fileInfo.icon}</span>
          <span className="text-sm font-medium truncate dark:text-slate-200 text-slate-800">
            {fileName}
          </span>
        </div>

        {/* Token count + strategy indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {strategy === 'chunked' && (
            <span className="w-2 h-2 rounded-full bg-amber-500" title="Document chunked" />
          )}
          <span className="text-[11px] px-2 py-0.5 rounded
            dark:bg-[#334155] dark:text-[#94A3B8]
            bg-slate-100 text-slate-500">
            ~{fullTokens?.toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* Scrollable content area with bottom fade */}
      <div className="relative flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-[1.8]
            dark:text-[#94A3B8] text-slate-700">
            {content || '(Document content available via search — ask a question on the right.)'}
          </pre>
        </div>

        {/* Bottom fade gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none
            dark:bg-gradient-to-t dark:from-[#0F172A] dark:to-transparent
            bg-gradient-to-t from-white to-transparent"
        />
      </div>
    </div>
  );
}
