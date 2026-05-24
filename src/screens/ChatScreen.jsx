// src/screens/ChatScreen.jsx — Main chat interface
// Renders the conversation, handles send → stream → save cycle.
// Checks context fill before each message and triggers auto-summarise.

import { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ContextBar from '../components/chat/ContextBar';
import SmartChips from '../components/chat/SmartChips';
import PersonaSwitcher from '../components/chat/PersonaSwitcher';

export default function ChatScreen() {
  // --- State ---
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [smartChips, setSmartChips] = useState([]);
  const [contextFill, setContextFill] = useState({
    usedTokens: 0,
    totalTokens: 4096,
    fillRatio: 0,
    shouldSummarise: false,
  });
  const [ctxInfo, setCtxInfo] = useState({
    native: 0,
    effective: 4096,
    limitReason: 'model',
    ramGB: 0,
  });
  const [error, setError] = useState(null);
  const [persona, setPersona] = useState('general');

  const messagesEndRef = useRef(null);
  const cleanupTokenRef = useRef(null);
  const cleanupDoneRef = useRef(null);
  const cleanupErrorRef = useRef(null);

  // --- Auto-scroll to bottom ---
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // --- Fetch context info on mount ---
  useEffect(() => {
    async function loadCtxInfo() {
      try {
        const info = await window.antonAPI.getContextInfo();
        if (info && info.effective > 0) {
          setCtxInfo(info);
        }
      } catch (_err) {
        // Model may not be loaded yet — use defaults
      }
    }
    loadCtxInfo();
  }, []);

  // --- Update context fill whenever messages change ---
  useEffect(() => {
    async function updateFill() {
      try {
        const fill = await window.antonAPI.getContextFill({
          messages,
          systemPrompt: '', // persona prompt will be added by main process
        });
        if (fill) {
          setContextFill(fill);
        }
      } catch (_err) {
        // Non-fatal
      }
    }
    updateFill();
  }, [messages]);

  // --- Cleanup IPC listeners on unmount ---
  useEffect(() => {
    return () => {
      if (cleanupTokenRef.current) cleanupTokenRef.current();
      if (cleanupDoneRef.current) cleanupDoneRef.current();
      if (cleanupErrorRef.current) cleanupErrorRef.current();
    };
  }, []);

  // --- Send message ---
  const handleSend = async (text) => {
    if (isStreaming) return;

    setError(null);
    setSmartChips([]);

    // Add user message to state
    const userMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: text,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Start streaming
    setIsStreaming(true);
    setStreamingContent('');

    // Subscribe to token events
    let fullResponse = '';

    // Clean up previous listeners if any
    if (cleanupTokenRef.current) cleanupTokenRef.current();
    if (cleanupDoneRef.current) cleanupDoneRef.current();
    if (cleanupErrorRef.current) cleanupErrorRef.current();

    cleanupTokenRef.current = window.antonAPI.onToken((token) => {
      fullResponse += token;
      setStreamingContent(fullResponse);
    });

    cleanupDoneRef.current = window.antonAPI.onChatDone(() => {
      // Add completed assistant message
      const assistantMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: fullResponse,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
      setIsStreaming(false);

      // Clean up listeners
      if (cleanupTokenRef.current) {
        cleanupTokenRef.current();
        cleanupTokenRef.current = null;
      }
      if (cleanupDoneRef.current) {
        cleanupDoneRef.current();
        cleanupDoneRef.current = null;
      }

      // Generate smart chips (async, non-blocking)
      generateSmartChips(fullResponse);
    });

    cleanupErrorRef.current = window.antonAPI.onLlamaError((data) => {
      setError(data.error || 'An error occurred during generation.');
      setIsStreaming(false);
      setStreamingContent('');

      if (cleanupTokenRef.current) {
        cleanupTokenRef.current();
        cleanupTokenRef.current = null;
      }
      if (cleanupErrorRef.current) {
        cleanupErrorRef.current();
        cleanupErrorRef.current = null;
      }
    });

    // Send to main process
    try {
      const chatMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await window.antonAPI.startChat({
        messages: chatMessages,
        systemPrompt: null, // main process will inject persona prompt
        inferenceParams: {
          temperature: 0.7,
          maxTokens: 2048,
        },
      });
    } catch (err) {
      setError(err.message || 'Failed to start chat.');
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  // --- Smart chips generation (lightweight secondary call) ---
  const generateSmartChips = async (lastResponse) => {
    try {
      // Only generate if model is running and response is substantial
      if (!lastResponse || lastResponse.length < 50) return;

      const status = await window.antonAPI.getModelStatus();
      if (!status?.running) return;

      // Use a short prompt to generate follow-up questions
      const chipPrompt = [
        {
          role: 'user',
          content:
            `Based on this AI response, suggest exactly 3 short follow-up questions ` +
            `the user might ask next. Return ONLY the 3 questions, one per line, no numbers or bullets.\n\n` +
            `Response: "${lastResponse.slice(0, 500)}"`,
        },
      ];

      const result = await window.antonAPI.startChat({
        messages: chipPrompt,
        systemPrompt: 'You generate concise follow-up questions. Return ONLY 3 questions, one per line.',
        inferenceParams: {
          temperature: 0.8,
          maxTokens: 150,
        },
      });

      // Parse chips from the response (delivered via onToken/onDone cycle)
      // Since this is a secondary call, we capture via a different mechanism
      // For now, we parse from the result if available
      if (result?.content) {
        const lines = result.content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 5 && l.length < 80);
        setSmartChips(lines.slice(0, 3));
      }
    } catch (_err) {
      // Non-fatal — chips are optional
    }
  };

  // --- Chip click → send as next message ---
  const handleChipClick = (chipText) => {
    setSmartChips([]);
    handleSend(chipText);
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0
        border-b dark:border-[#1E293B] border-slate-200">
        <PersonaSwitcher
          activePersona={persona}
          onPersonaChange={setPersona}
        />
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full
            dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-[#94A3B8]
            bg-slate-100 border border-slate-200 text-slate-500">
            No model loaded
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && !isStreaming && (
          <EmptyState />
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Streaming message (in progress) */}
        {isStreaming && streamingContent && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
            }}
            isStreaming
          />
        )}

        {/* Error display */}
        {error && (
          <div className="mx-auto max-w-lg rounded-lg p-3 text-sm
            dark:bg-red-900/20 dark:text-red-400
            bg-red-50 text-red-600">
            {error}
          </div>
        )}

        {/* Smart chips */}
        <SmartChips
          chips={smartChips}
          onChipClick={handleChipClick}
          visible={!isStreaming}
        />

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom section */}
      <div className="shrink-0 px-4 pb-4">
        {/* Context bar */}
        <div className="mb-2">
          <ContextBar
            used={contextFill.usedTokens}
            total={contextFill.totalTokens}
            limitReason={ctxInfo.limitReason}
            ramGB={ctxInfo.ramGB}
            effectiveCtx={ctxInfo.effective}
          />
        </div>

        {/* Chat input */}
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          placeholder={
            isStreaming
              ? 'Generating...'
              : 'Ask anything... (Ctrl+Enter to send)'
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — shown when no messages yet
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full pb-20">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 mb-4">
        <span className="text-xl font-bold text-white">A</span>
      </div>
      <h2 className="text-lg font-semibold dark:text-slate-200 text-slate-800">
        Anton AI
      </h2>
      <p className="mt-1 text-sm dark:text-slate-400 text-slate-500 text-center max-w-xs">
        Your private AI assistant. Ask anything — everything stays on your PC.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {[
          'Explain context windows',
          'Write a Python function',
          'Summarise a document',
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="px-3 py-1.5 rounded-full text-xs border cursor-default
              dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400
              bg-slate-50 border-slate-200 text-slate-500"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}
