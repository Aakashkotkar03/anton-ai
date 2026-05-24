// src/stores/useDocumentStore.js — Zustand store for Document Intelligence
// Holds the loaded document state, chunk index, summary, and chat history.

import { create } from 'zustand';

const useDocumentStore = create((set) => ({
  // Document metadata
  file: null,           // { name, path, ext, sizeMB }
  strategy: null,       // 'full' | 'chunked' | 'scanned' | 'empty' | null
  content: null,        // full text (strategy=full) or null (strategy=chunked)
  chunkIndex: null,     // array of { id, text, keywords } (strategy=chunked)
  fullTokens: 0,
  docBudget: 0,
  pageCount: 0,

  // Summary
  summary: null,        // { title, bullets: [], keyFacts: [] }
  isSummarising: false,

  // Document chat history
  chatHistory: [],      // [{ id, role, content, source? }]
  isAnswering: false,

  // Loading/error
  isLoading: false,
  error: null,

  // Actions
  setDocument: (docResult, fileInfo) =>
    set({
      file: fileInfo,
      strategy: docResult.strategy,
      content: docResult.content || null,
      chunkIndex: docResult.index || null,
      fullTokens: docResult.fullTokens || 0,
      docBudget: docResult.docBudget || 0,
      pageCount: docResult.pageCount || 0,
      error: docResult.error || null,
      // Reset derived state
      summary: null,
      isSummarising: false,
      chatHistory: [],
      isAnswering: false,
      isLoading: false,
    }),

  setSummary: (summary) => set({ summary, isSummarising: false }),

  setIsSummarising: (v) => set({ isSummarising: v }),

  addChatTurn: (message) =>
    set((state) => ({ chatHistory: [...state.chatHistory, message] })),

  setIsAnswering: (v) => set({ isAnswering: v }),

  setLoading: (v) => set({ isLoading: v }),

  setError: (err) => set({ error: err, isLoading: false }),

  clearDocument: () =>
    set({
      file: null,
      strategy: null,
      content: null,
      chunkIndex: null,
      fullTokens: 0,
      docBudget: 0,
      pageCount: 0,
      summary: null,
      isSummarising: false,
      chatHistory: [],
      isAnswering: false,
      isLoading: false,
      error: null,
    }),
}));

export default useDocumentStore;
