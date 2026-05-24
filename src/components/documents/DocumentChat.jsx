// src/components/documents/DocumentChat.jsx — Right panel: AI analysis + Q&A
// Handles: summarise (full + map-reduce), Q&A with chunk retrieval,
// summary card rendering, streaming answers.
// Design: PRD Feature 3 + UI/UX SCREEN 3A (DocumentScreen_Dark).

import { useState, useRef, useEffect, useCallback } from 'react';
import useDocumentStore from '../../stores/useDocumentStore';

// ---------------------------------------------------------------------------
// Summary card parser — splits TITLE: / SUMMARY: / KEY_FACTS: labels
// ---------------------------------------------------------------------------
function parseSummaryResponse(text) {
  const result = { title: '', bullets: [], keyFacts: [] };
  if (!text) return result;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let section = null;

  for (const line of lines) {
    if (line.startsWith('TITLE:')) {
      result.title = line.replace('TITLE:', '').trim();
      section = null;
    } else if (line.startsWith('SUMMARY:')) {
      section = 'summary';
    } else if (line.startsWith('KEY_FACTS:') || line.startsWith('KEY FACTS:')) {
      section = 'facts';
    } else if (section === 'summary') {
      result.bullets.push(line.replace(/^[•\-*]\s*/, ''));
    } else if (section === 'facts') {
      result.keyFacts.push(line.replace(/^[•\-*]\s*/, ''));
    } else if (!result.title && !section) {
      // First non-label line becomes title if TITLE: was absent
      result.title = line;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Source citation parser — finds [Source: ...] blocks in answers
// ---------------------------------------------------------------------------
function renderAnswerWithSources(text) {
  if (!text) return null;

  // Split on [Source: ...] patterns
  const parts = text.split(/(\[Source:[^\]]*\])/gi);

  return parts.map((part, i) => {
    if (/^\[Source:/i.test(part)) {
      return (
        <span
          key={i}
          className="inline-block mt-1 px-2 py-1 rounded text-[11px]
            dark:bg-[#78350F]/40 dark:border-l-2 dark:border-amber-500 dark:text-amber-300
            bg-amber-50 border-l-2 border-amber-400 text-amber-800"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ---------------------------------------------------------------------------
// DocumentChat component
// ---------------------------------------------------------------------------
export default function DocumentChat({ fileName }) {
  const {
    strategy, content, chunkIndex, fullTokens, docBudget,
    summary, isSummarising, setSummary, setIsSummarising,
    chatHistory, addChatTurn, isAnswering, setIsAnswering,
  } = useDocumentStore();

  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const chatEndRef = useRef(null);
  const cleanupTokenRef = useRef(null);
  const cleanupDoneRef = useRef(null);
  const cleanupErrorRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamingContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupTokenRef.current) cleanupTokenRef.current();
      if (cleanupDoneRef.current) cleanupDoneRef.current();
      if (cleanupErrorRef.current) cleanupErrorRef.current();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Summarise
  // -------------------------------------------------------------------------
  const handleSummarise = useCallback(async () => {
    if (isSummarising) return;
    setIsSummarising(true);

    const SUMMARISE_PROMPT =
      'Summarise this document. Return exactly in this format:\n' +
      'TITLE: [one line]\n' +
      'SUMMARY:\n• [bullet 1]\n• [bullet 2] (5 bullets maximum)\n' +
      'KEY_FACTS:\n• [fact 1 — dates, numbers, names, decisions] (up to 8 facts)';

    try {
      let summaryText = '';

      if (strategy === 'full' && content) {
        // Full doc fits — send entire text
        summaryText = await streamChat(
          SUMMARISE_PROMPT,
          `[DOCUMENT:\n${content}\n]\n\nSummarise this document.`
        );
      } else if (strategy === 'chunked' && chunkIndex) {
        // Map-reduce: summarise first 5 chunks, then combine
        const miniSummaries = [];
        const chunksToUse = chunkIndex.slice(0, 5);

        for (const chunk of chunksToUse) {
          const mini = await streamChat(
            'Summarise this section in 2-3 sentences. Focus on key facts.',
            chunk.text
          );
          miniSummaries.push(mini);
        }

        // Combine mini-summaries into final summary
        summaryText = await streamChat(
          SUMMARISE_PROMPT,
          `[DOCUMENT SUMMARIES:\n${miniSummaries.join('\n---\n')}\n]\n\nCombine these section summaries into one document summary.`
        );
      }

      setSummary(parseSummaryResponse(summaryText));
    } catch (err) {
      console.error('[docChat] Summarise failed:', err);
      setIsSummarising(false);
    }
  }, [strategy, content, chunkIndex, isSummarising, setSummary, setIsSummarising]);

  // -------------------------------------------------------------------------
  // Q&A — send a question about the document
  // -------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    if (!input.trim() || isAnswering) return;
    const query = input.trim();
    setInput('');

    // Add user message
    addChatTurn({
      id: `doc_${Date.now()}_user`,
      role: 'user',
      content: query,
    });

    setIsAnswering(true);
    setStreamingContent('');

    try {
      let contextBlock = '';

      if (strategy === 'full' && content) {
        contextBlock = `[DOCUMENT:\n${content}\n]`;
      } else if (strategy === 'chunked' && chunkIndex) {
        // Retrieve relevant chunks
        const chunks = await window.antonAPI.getDocumentChunks(query, chunkIndex, 5);
        if (chunks && chunks.length > 0) {
          const chunkTexts = chunks.map((c) => c.text).join('\n\n---\n\n');
          contextBlock = `[DOCUMENT SECTIONS:\n${chunkTexts}\n]`;
        }
      }

      const systemPrompt =
        'Answer the question using ONLY the document content below. ' +
        'Include a [Source: Section/Page] block quoting the relevant passage if possible. ' +
        'If the answer is not in the document: say so clearly.';

      const userMessage = contextBlock
        ? `${contextBlock}\n\nQuestion: ${query}`
        : `Question: ${query}`;

      const answer = await streamChatWithDisplay(systemPrompt, userMessage);

      addChatTurn({
        id: `doc_${Date.now()}_assistant`,
        role: 'assistant',
        content: answer,
      });
    } catch (err) {
      addChatTurn({
        id: `doc_${Date.now()}_error`,
        role: 'assistant',
        content: `Error: ${err.message}`,
      });
    } finally {
      setIsAnswering(false);
      setStreamingContent('');
    }
  }, [input, strategy, content, chunkIndex, isAnswering, addChatTurn, setIsAnswering]);

  // -------------------------------------------------------------------------
  // streamChat — non-displayed streaming (for summarise, returns full text)
  // -------------------------------------------------------------------------
  async function streamChat(systemPrompt, userMessage) {
    return new Promise((resolve, reject) => {
      let fullResponse = '';

      const cleanToken = window.antonAPI.onToken((token) => {
        fullResponse += token;
      });
      const cleanDone = window.antonAPI.onChatDone(() => {
        cleanToken();
        cleanDone();
        resolve(fullResponse);
      });
      const cleanErr = window.antonAPI.onLlamaError((data) => {
        cleanToken();
        cleanDone();
        cleanErr();
        reject(new Error(data.error || 'LLM error'));
      });

      window.antonAPI.startChat({
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt,
        inferenceParams: { temperature: 0.3, maxTokens: 2048 },
      }).catch((err) => {
        cleanToken();
        cleanDone();
        cleanErr();
        reject(err);
      });
    });
  }

  // -------------------------------------------------------------------------
  // streamChatWithDisplay — streaming with live display (for Q&A)
  // -------------------------------------------------------------------------
  async function streamChatWithDisplay(systemPrompt, userMessage) {
    return new Promise((resolve, reject) => {
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
        if (cleanupTokenRef.current) { cleanupTokenRef.current(); cleanupTokenRef.current = null; }
        if (cleanupDoneRef.current) { cleanupDoneRef.current(); cleanupDoneRef.current = null; }
        resolve(fullResponse);
      });

      cleanupErrorRef.current = window.antonAPI.onLlamaError((data) => {
        if (cleanupTokenRef.current) { cleanupTokenRef.current(); cleanupTokenRef.current = null; }
        if (cleanupErrorRef.current) { cleanupErrorRef.current(); cleanupErrorRef.current = null; }
        reject(new Error(data.error || 'LLM error'));
      });

      window.antonAPI.startChat({
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt,
        inferenceParams: { temperature: 0.4, maxTokens: 2048 },
      }).catch((err) => {
        if (cleanupTokenRef.current) { cleanupTokenRef.current(); cleanupTokenRef.current = null; }
        reject(err);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* ================================================================ */}
      {/* Action buttons row                                                */}
      {/* ================================================================ */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0
        border-b dark:border-[#334155] border-slate-200">
        <button
          onClick={handleSummarise}
          disabled={isSummarising}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50
            transition-colors"
        >
          {isSummarising ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Summarising...
            </>
          ) : (
            <>📋 Summarise</>
          )}
        </button>
        <button
          className="px-3 py-1.5 rounded-lg text-xs font-medium
            dark:bg-[#1E293B] dark:text-[#CBD5E1] dark:hover:bg-slate-700
            bg-slate-100 text-slate-600 hover:bg-slate-200
            transition-colors"
        >
          🔍 Extract Data
        </button>
        <button
          className="px-3 py-1.5 rounded-lg text-xs font-medium
            dark:bg-[#1E293B] dark:text-[#CBD5E1] dark:hover:bg-slate-700
            bg-slate-100 text-slate-600 hover:bg-slate-200
            transition-colors"
        >
          ✏️ Rewrite
        </button>
      </div>

      {/* ================================================================ */}
      {/* Scrollable: summary card + chat history                          */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {/* Summary card */}
        {summary && <SummaryCard summary={summary} />}

        {/* Chat history */}
        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'ml-8 dark:bg-[#1E3A5F] dark:text-slate-200 bg-blue-50 text-slate-800 border-l-2 border-blue-500'
                : 'dark:bg-[#1E293B] dark:text-[#CBD5E1] bg-slate-50 text-slate-700 border dark:border-[#334155] border-slate-200'
            }`}
          >
            {msg.role === 'assistant'
              ? renderAnswerWithSources(msg.content)
              : msg.content}
          </div>
        ))}

        {/* Streaming answer */}
        {isAnswering && streamingContent && (
          <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed
            dark:bg-[#1E293B] dark:text-[#CBD5E1]
            bg-slate-50 text-slate-700
            border dark:border-[#334155] border-slate-200">
            {renderAnswerWithSources(streamingContent)}
            <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-blue-500 animate-pulse rounded-sm" />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ================================================================ */}
      {/* Input area                                                        */}
      {/* ================================================================ */}
      <div className="shrink-0 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask about ${fileName || 'this document'}...`}
            disabled={isAnswering}
            className="flex-1 px-3 py-2 rounded-lg text-xs
              dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
              dark:placeholder-[#64748B]
              bg-white border border-slate-300 text-slate-800 placeholder-slate-400
              focus:outline-none focus:ring-1 focus:ring-blue-500
              disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAnswering}
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0
              bg-blue-600 text-white hover:bg-blue-500
              disabled:opacity-40 transition-colors"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryCard — renders the parsed summary
// ---------------------------------------------------------------------------
function SummaryCard({ summary }) {
  if (!summary) return null;

  return (
    <div className="rounded-xl p-4 space-y-3
      dark:bg-[#1E293B] dark:border dark:border-[#334155]
      bg-white border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider
          dark:text-[#64748B] text-slate-400 font-medium">
          Summary
        </span>
        <span className="flex items-center gap-1 text-[10px]
          dark:text-green-400 text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Auto-generated
        </span>
      </div>

      {/* Title */}
      {summary.title && (
        <h3 className="text-sm font-bold dark:text-slate-100 text-slate-900">
          {summary.title}
        </h3>
      )}

      {/* Bullets */}
      {summary.bullets.length > 0 && (
        <ul className="space-y-1">
          {summary.bullets.map((b, i) => (
            <li key={i} className="text-xs leading-relaxed dark:text-[#CBD5E1] text-slate-700">
              • {b}
            </li>
          ))}
        </ul>
      )}

      {/* Key facts */}
      {summary.keyFacts.length > 0 && (
        <div className="rounded-lg p-3 dark:bg-[#0F172A] bg-slate-50">
          <p className="text-[10px] uppercase tracking-wider mb-1.5
            dark:text-[#64748B] text-slate-400 font-medium">
            Key Facts
          </p>
          {summary.keyFacts.map((f, i) => (
            <p key={i} className="text-[11px] leading-relaxed dark:text-[#94A3B8] text-slate-600">
              • {f}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
