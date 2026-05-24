// src/stores/useSettingsStore.js — Zustand store for app settings
// Holds user-configurable settings. Persisted to SQLite via IPC on change.

import { create } from 'zustand';

const useSettingsStore = create((set) => ({
  // Browser Extension
  chromeExtensionId: 'hhkmgifjhchlkcjiamfijndoaiklempb',
  edgeExtensionId: '',

  // Clipboard AI
  autopasteEnabled: false,
  translateLanguage: 'English',

  // Voice
  whisperModel: 'tiny',

  // Inference defaults
  temperature: 0.7,
  maxTokens: 2048,

  // Actions
  setChromeExtensionId: (id) => set({ chromeExtensionId: id }),
  setEdgeExtensionId: (id) => set({ edgeExtensionId: id }),
  setAutopasteEnabled: (v) => set({ autopasteEnabled: v }),
  setTranslateLanguage: (lang) => set({ translateLanguage: lang }),
  setWhisperModel: (model) => set({ whisperModel: model }),
  setTemperature: (t) => set({ temperature: t }),
  setMaxTokens: (t) => set({ maxTokens: t }),

  // Bulk load from SQLite on startup
  loadFromDb: (settings) => set({ ...settings }),
}));

export default useSettingsStore;
