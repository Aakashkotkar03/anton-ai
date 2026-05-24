// src/screens/ChatPanelWindow.jsx — Floating frameless chat panel
// Opened via Alt+Space from any app. Renders in its own BrowserWindow.
// Design: PRD Feature 1 + UI/UX SCREEN 1A (ChatPanel_Dark / ChatPanel_Light)
//
// Layout (flex column, full height):
//   1. Header 52px: drag region, 4 persona buttons, model pill, pin, minimize
//   2. Context bar: 4px strip (ContextBar component)
//   3. Context injection pill: shown when file/clipboard injected
//   4. Conversation area: scrollable messages + smart chips + empty state
//   5. Bottom: ChatInput with token counter
//
// Supports: drag-and-drop files, Ctrl+V context injection, theme switching

import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../stores/useAppStore';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ContextBar from '../components/chat/ContextBar';
import SmartChips from '../components/chat/SmartChips';

// ---------------------------------------------------------------------------
// Persona definitions
// ---------------------------------------------------------------------------
const PERSONAS = [
  { id: 'general', letter: 'G', label: 'General' },
  { id: 'coder', letter: 'C', label: 'Coder' },
  { id: 'writer', letter: 'W', label: 'Writer' },
  { id: 'analyst', letter: 'A', label: 'Analyst' },
];

const EXAMPLE_PROMPTS = [
  'Explain context windows',
  'Write a Python function',
  'Summarise a document',
];

export default function ChatPanelWindow() {
  // --- State ---
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [smartChips, setSmartChips] = useState([]);
  const [activePersona, setActivePersona] = useState('general');
  const [modelName, setModelName] = useState('No model loaded');
  const [pinned, setPinned] = useState(false);
  const [injectedContext, setInjectedContext] = useState(null);
  // injectedContext: { name: string, text: string, chars: number } | null
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextFill, setContextFill] = useState({
    usedTokens: 0,
    totalTokens: 4096,
    fillRatio: 0,
  });
  const [ctxInfo, setCtxInfo] = useState({
    effective: 4096,
    limitReason: 'model',
    ramGB: 0,
  });
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const cleanupTokenRef = useRef(null);
  const cleanupDoneRef = useRef(null);
  const cleanupErrorRef = useRef(null);
  const chatInputRef = useRef(null); // tracks whether input is focused

  const setTheme = useAppStore((s) => s.setTheme);

  // --- Auto-scroll ---
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // --- Theme ---
  useEffect(() => {
    setTheme('dark');
    const cleanup = window.antonAPI.onThemeChange((theme) => {
      setTheme(theme);
    });
    return cleanup;
  }, [setTheme]);

  // --- Load model status + pin state on mount ---
  useEffect(() => {
    async function init() {
      try {
        const status = await window.antonAPI.getModelStatus();
        if (status?.running && status.ctxInfo) {
          setCtxInfo(status.ctxInfo);
          if (status.modelPath) {
            const name = status.modelPath.split(/[/\\]/).pop().replace('.gguf', '');
            setModelName(name);
          }
        }
      } catch (_e) {
        // Model may not be loaded
      }

      try {
        const { pinned: isPinned } = await window.antonAPI.isPanelPinned();
        setPinned(isPinned);
      } catch (_e) {
        // ignore
      }
    }
    init();
  }, []);

  // --- Update context fill when messages or injectedContext change ---
  useEffect(() => {
    async function updateFill() {
      try {
        const fill = await window.antonAPI.getContextFill({
          messages,
          systemPrompt: injectedContext ? injectedContext.text : '',
        });
        if (fill) setContextFill(fill);
      } catch (_e) {
        // ignore
      }
    }
    updateFill();
  }, [messages, injectedContext]);

  // --- Cleanup IPC on unmount ---
  useEffect(() => {
    return () => {
      if (cleanupTokenRef.current) cleanupTokenRef.current();
      if (cleanupDoneRef.current) cleanupDoneRef.current();
      if (cleanupErrorRef.current) cleanupErrorRef.current();
    };
  }, []);

  // --- Ctrl+V context injection (when input is NOT focused) ---
  useEffect(() => {
    const handlePaste = async (e) => {
      // If the chat input textarea is focused, let normal paste happen
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)
      ) {
        return; // normal paste — do not intercept
      }

      e.preventDefault();

      const text = e.clipboardData?.getData('text/plain');
      if (!text || text.length < 2) return;

      setInjectedContext({
        name: `Clipboard text (${text.length.toLocaleString()} chars)`,
        text,
        chars: text.length,
      });
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // ---------------------------------------------------------------------------
  // Drag and drop file support
  // ---------------------------------------------------------------------------
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0]; // take first file only
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedText = ['txt', 'md', 'csv', 'json', 'log'];

    if (allowedText.includes(ext)) {
      // Read text files directly in the renderer
      try {
        const text = await file.text();
        setInjectedContext({
          name: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
          text,
          chars: text.length,
        });
      } catch (_err) {
        setError('Failed to read file.');
      }
    } else if (ext === 'pdf' || ext === 'docx') {
      // PDF and DOCX need main process extraction — show pill with pending state
      // For now, set a placeholder. Full extraction wired in Phase 4.
      setInjectedContext({
        name: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        text: `[Document: ${file.name} — full extraction available in Document Intelligence mode]`,
        chars: 0,
      });
    } else {
      setError(`Unsupported file type: .${ext}. Try .txt, .md, .csv, .pdf, or .docx.`);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const handleSend = async (text) => {
    if (isStreaming) return;
    setError(null);
    setSmartChips([]);

    // Build user message — prepend injected context if present
    let messageContent = text;
    if (injectedContext && injectedContext.text) {
      messageContent = `[CONTEXT:\n${injectedContext.text}\n]\n\n${text}`;
    }

    const userMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: text, // display the clean text
      _fullContent: messageContent, // send the full content with context
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);
    setStreamingContent('');

    let fullResponse = '';

    // Clean previous listeners
    if (cleanupTokenRef.current) cleanupTokenRef.current();
    if (cleanupDoneRef.current) cleanupDoneRef.current();
    if (cleanupErrorRef.current) cleanupErrorRef.current();

    cleanupTokenRef.current = window.antonAPI.onToken((token) => {
      fullResponse += token;
      setStreamingContent(fullResponse);
    });

    cleanupDoneRef.current = window.antonAPI.onChatDone(() => {
      const assistantMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: fullResponse,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
      setIsStreaming(false);

      if (cleanupTokenRef.current) { cleanupTokenRef.current(); cleanupTokenRef.current = null; }
      if (cleanupDoneRef.current) { cleanupDoneRef.current(); cleanupDoneRef.current = null; }
    });

    cleanupErrorRef.current = window.antonAPI.onLlamaError((data) => {
      setError(data.error || 'Generation error.');
      setIsStreaming(false);
      setStreamingContent('');
      if (cleanupTokenRef.current) { cleanupTokenRef.current(); cleanupTokenRef.current = null; }
      if (cleanupErrorRef.current) { cleanupErrorRef.current(); cleanupErrorRef.current = null; }
    });

    try {
      // Send with full content (including injected context)
      const chatMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m._fullContent || m.content,
      }));

      await window.antonAPI.startChat({
        messages: chatMessages,
        systemPrompt: null,
        inferenceParams: { temperature: 0.7, maxTokens: 2048 },
      });
    } catch (err) {
      setError(err.message || 'Failed to start chat.');
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  // --- Pin toggle ---
  const handleTogglePin = async () => {
    try {
      const newPinned = !pinned;
      const result = await window.antonAPI.togglePin(newPinned);
      setPinned(result.pinned);
    } catch (_e) {
      // ignore
    }
  };

  // --- Minimize ---
  const handleMinimize = () => {
    window.antonAPI.hidePanel();
  };

  // --- Clear injected context ---
  const handleClearContext = () => {
    setInjectedContext(null);
  };

  // --- Chip click ---
  const handleChipClick = (chipText) => {
    setSmartChips([]);
    handleSend(chipText);
  };

  // --- Render ---
  return (
    <div
      className={`flex flex-col h-screen w-full overflow-hidden select-none
        dark:bg-[#0F172A] bg-white
        ${isDragOver
          ? 'ring-2 ring-blue-500 ring-inset'
          : ''
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ================================================================ */}
      {/* HEADER — 52px, draggable region                                  */}
      {/* ================================================================ */}
      <div
        className="flex items-center justify-between h-[52px] px-3 shrink-0
          dark:bg-[#1E293B] bg-[#F8FAFC]
          border-b dark:border-[#334155] border-slate-200"
        style={{ WebkitAppRegion: 'drag' }}
      >
        {/* Left: Persona buttons */}
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePersona(p.id)}
              title={p.label}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                activePersona === p.id
                  ? 'bg-blue-600 text-white'
                  : 'dark:bg-[#334155] dark:text-[#64748B] bg-slate-200 text-slate-400 hover:dark:bg-slate-600 hover:bg-slate-300'
              }`}
            >
              {p.letter}
            </button>
          ))}
        </div>

        {/* Centre: Model name pill */}
        <div className="px-3 py-1 rounded-full text-[11px] font-mono
          dark:bg-[#0F172A] dark:border dark:border-[#334155] dark:text-[#94A3B8]
          bg-slate-100 border border-slate-200 text-slate-500
          max-w-[160px] truncate">
          {modelName}
        </div>

        {/* Right: Pin + Minimize */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={handleTogglePin}
            title={pinned ? 'Unpin (hide on blur)' : 'Pin (stay visible)'}
            className={`p-1.5 rounded transition-colors ${
              pinned
                ? 'dark:text-blue-400 text-blue-600'
                : 'dark:text-[#64748B] text-slate-400 hover:dark:text-slate-300 hover:text-slate-600'
            }`}
          >
            <PinIcon />
          </button>
          <button
            onClick={handleMinimize}
            title="Minimize (Alt+Space to reopen)"
            className="p-1.5 rounded dark:text-[#64748B] text-slate-400
              hover:dark:text-slate-300 hover:text-slate-600 transition-colors"
          >
            <MinusIcon />
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* CONTEXT BAR — thin strip below header                            */}
      {/* ================================================================ */}
      <div className="px-3 pt-1 shrink-0">
        <ContextBar
          used={contextFill.usedTokens}
          total={contextFill.totalTokens}
          limitReason={ctxInfo.limitReason}
          ramGB={ctxInfo.ramGB}
          effectiveCtx={ctxInfo.effective}
        />
      </div>

      {/* ================================================================ */}
      {/* CONVERSATION AREA                                                */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-0">
        {/* Drag-over overlay */}
        {isDragOver && (
          <div className="flex items-center justify-center h-32 rounded-xl border-2 border-dashed
            dark:border-blue-500 dark:bg-blue-900/10
            border-blue-400 bg-blue-50">
            <p className="text-sm dark:text-blue-400 text-blue-600">
              Drop file to add as context
            </p>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isStreaming && !isDragOver && (
          <PanelEmptyState onChipClick={handleChipClick} />
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingContent && (
          <ChatMessage
            message={{ id: 'streaming', role: 'assistant', content: streamingContent }}
            isStreaming
          />
        )}

        {error && (
          <div className="rounded-lg p-2.5 text-xs
            dark:bg-red-900/20 dark:text-red-400
            bg-red-50 text-red-600">
            {error}
          </div>
        )}

        <SmartChips
          chips={smartChips}
          onChipClick={handleChipClick}
          visible={!isStreaming}
        />

        <div ref={messagesEndRef} />
      </div>

      {/* ================================================================ */}
      {/* BOTTOM — Context pill + Input                                    */}
      {/* ================================================================ */}
      <div className="shrink-0 px-3 pb-3 space-y-2">
        {/* Context injection pill */}
        {injectedContext && (
          <ContextPill
            name={injectedContext.name}
            onClear={handleClearContext}
          />
        )}

        <ChatInput
          ref={chatInputRef}
          onSend={handleSend}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Generating...' : 'Ask anything... (Ctrl+Enter)'}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context injection pill — shows attached file/clipboard info
// ---------------------------------------------------------------------------
function ContextPill({ name, onClear }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs
      dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-[#94A3B8]
      bg-slate-100 border border-slate-200 text-slate-500">
      <DocIcon />
      <span className="truncate max-w-[280px]">{name}</span>
      <button
        onClick={onClear}
        className="ml-auto shrink-0 p-0.5 rounded-full
          dark:hover:bg-slate-600 hover:bg-slate-200 transition-colors"
        title="Remove context"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel empty state — compact, with clickable example chips
// ---------------------------------------------------------------------------
function PanelEmptyState({ onChipClick }) {
  return (
    <div className="flex flex-col items-center justify-center h-full pb-8">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 mb-3">
        <span className="text-base font-bold text-white">A</span>
      </div>
      <p className="text-sm font-medium dark:text-slate-300 text-slate-700">
        Anton AI
      </p>
      <p className="mt-1 text-xs dark:text-slate-500 text-slate-400 text-center px-6">
        Ask anything. Drop a file or paste text for context.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onChipClick(prompt)}
            className="px-3 py-1.5 rounded-full text-xs border transition-colors
              dark:bg-[#334155] dark:border-[#475569] dark:text-[#94A3B8]
              dark:hover:border-blue-500 dark:hover:text-blue-400
              bg-white border-slate-200 text-slate-500
              hover:border-blue-300 hover:text-blue-700"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVG — no external deps)
// ---------------------------------------------------------------------------
function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-500">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
