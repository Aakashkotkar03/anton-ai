// src/components/chat/ChatInput.jsx — Auto-resize textarea with send, mic, and attach
// Ctrl+Enter to send. Token estimate shown below. Mic and attach icons.

import { useState, useRef, useEffect, useCallback } from 'react';

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask anything... (Ctrl+Enter to send)',
}) {
  const [text, setText] = useState('');
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const textareaRef = useRef(null);

  // Auto-resize textarea (max 5 lines ≈ ~120px)
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  // Estimate tokens as user types (debounced)
  useEffect(() => {
    const estimate = Math.ceil(text.length / 4);
    setTokenEstimate(estimate);
  }, [text]);

  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    setTokenEstimate(0);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="w-full">
      {/* Input container */}
      <div
        className="flex items-end gap-2 rounded-xl border p-3
          dark:bg-slate-800 dark:border-slate-600
          bg-white border-slate-300
          focus-within:dark:border-blue-500 focus-within:border-blue-500
          transition-colors"
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none
            dark:text-slate-100 dark:placeholder-slate-500
            text-slate-800 placeholder-slate-400
            disabled:opacity-50"
        />

        {/* Right side icons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mic icon */}
          <button
            title="Voice input (Win+Alt+V)"
            className="p-1.5 rounded-lg transition-colors
              dark:text-slate-500 dark:hover:text-blue-400
              text-slate-400 hover:text-blue-600"
            // TODO: Phase 3 — Voice input
          >
            <MicIcon />
          </button>

          {/* Attach icon */}
          <button
            title="Attach file"
            className="p-1.5 rounded-lg transition-colors
              dark:text-slate-500 dark:hover:text-blue-400
              text-slate-400 hover:text-blue-600"
            // TODO: Phase 4 — Document attachment
          >
            <AttachIcon />
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            className="flex items-center justify-center w-8 h-8 rounded-lg
              bg-blue-600 text-white
              hover:bg-blue-700
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors"
            title="Send (Ctrl+Enter)"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {/* Token estimate */}
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[10px] font-mono dark:text-slate-500 text-slate-400">
          {tokenEstimate > 0 ? `~${tokenEstimate} tokens` : '\u00A0'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
