// src/components/chat/ChatMessage.jsx — User + assistant message bubbles
// User: right-aligned, blue tint. Assistant: left-aligned, surface colour.
// Supports streaming state (blinking cursor) and action buttons.

import { useState } from 'react';

export default function ChatMessage({ message, isStreaming = false }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Don't render system messages in the chat UI
  if (isSystem) return null;

  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`relative max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? userStyles : assistantStyles
        }`}
      >
        {/* Message content */}
        <div
          className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'dark:text-slate-100 text-slate-800'
              : 'dark:text-slate-200 text-slate-700'
          }`}
        >
          {message.content}

          {/* Streaming cursor */}
          {isStreaming && !isUser && (
            <span className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom bg-blue-500 animate-pulse" />
          )}
        </div>

        {/* Action bar — only for completed assistant messages */}
        {!isUser && !isStreaming && message.content && (
          <MessageActions content={message.content} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style strings
// ---------------------------------------------------------------------------
const userStyles = [
  // Dark theme
  'dark:bg-blue-900/30 dark:border-l-4 dark:border-blue-500',
  // Light theme
  'bg-blue-50 border-l-4 border-blue-500',
].join(' ');

const assistantStyles = [
  // Dark theme
  'dark:bg-slate-800 dark:border dark:border-slate-700',
  // Light theme
  'bg-white border border-slate-200',
].join(' ');

// ---------------------------------------------------------------------------
// MessageActions — copy, insert, thumbs up/down
// ---------------------------------------------------------------------------
function MessageActions({ content }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // Clipboard API may fail in some Electron contexts — fallback is in preload
    }
  };

  const handleInsert = () => {
    // TODO: Phase 3 — SendKeys insert at cursor in previously focused app
  };

  return (
    <div className="flex items-center gap-1 mt-2 pt-2 border-t dark:border-slate-700 border-slate-100">
      <ActionButton
        onClick={handleCopy}
        label={copied ? 'Copied' : 'Copy'}
        active={copied}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </ActionButton>

      <ActionButton onClick={handleInsert} label="Insert at cursor">
        <InsertIcon />
      </ActionButton>

      <div className="flex-1" />

      <ActionButton
        onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
        label="Good response"
        active={feedback === 'up'}
      >
        <ThumbUpIcon filled={feedback === 'up'} />
      </ActionButton>

      <ActionButton
        onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
        label="Bad response"
        active={feedback === 'down'}
      >
        <ThumbDownIcon filled={feedback === 'down'} />
      </ActionButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionButton wrapper
// ---------------------------------------------------------------------------
function ActionButton({ onClick, label, active, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1 rounded transition-colors ${
        active
          ? 'dark:text-blue-400 text-blue-600'
          : 'dark:text-slate-500 dark:hover:text-slate-300 text-slate-400 hover:text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVG — no external deps, works offline)
// ---------------------------------------------------------------------------
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function InsertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ThumbUpIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbDownIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}
