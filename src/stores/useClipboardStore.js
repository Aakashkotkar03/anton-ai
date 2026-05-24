// src/stores/useClipboardStore.js — Zustand store for Clipboard AI state
// Tracks clipboard text, processing state, action results, and undo.

import { create } from 'zustand';

const useClipboardStore = create((set) => ({
  // Current clipboard text (from polling)
  currentText: '',

  // Action result
  result: null,       // string — the AI-processed text
  originalText: '',   // string — for undo

  // UI state
  isProcessing: false,
  showWheel: false,

  // Settings
  autopasteEnabled: false,

  // Actions
  setCurrentText: (text) => set({ currentText: text }),

  setResult: (result, originalText) => set({
    result,
    originalText,
    isProcessing: false,
  }),

  setProcessing: (v) => set({ isProcessing: v }),

  setShowWheel: (v) => set({ showWheel: v }),

  toggleAutopaste: () => set((s) => ({ autopasteEnabled: !s.autopasteEnabled })),

  reset: () => set({
    result: null,
    originalText: '',
    isProcessing: false,
    showWheel: false,
  }),
}));

export default useClipboardStore;
