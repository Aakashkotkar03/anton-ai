// src/stores/useModelStore.js — Model catalogue + download state (Zustand)
// Populated during startup via window.antonAPI calls.

import { create } from 'zustand';

const useModelStore = create((set) => ({
  // --- State ---
  allModels: [],           // full catalogue (with compatible flag)
  downloadedModels: [],    // models present on disk
  activeModels: {          // currently loaded model per mode
    chat: null,            // model id
    code: null,
    image: null,
    voice: 'whisper-tiny-voice', // bundled, always available
  },
  catalogueSource: null,   // 'remote' | 'cache' | 'bundled' | null
  isLoaded: false,

  // --- Actions ---
  setCatalogue: (models, source) =>
    set({
      allModels: models,
      catalogueSource: source,
      isLoaded: true,
    }),

  setDownloadedModels: (models) =>
    set({ downloadedModels: models }),

  addDownloadedModel: (model) =>
    set((state) => ({
      downloadedModels: [...state.downloadedModels, model],
    })),

  removeDownloadedModel: (modelId) =>
    set((state) => ({
      downloadedModels: state.downloadedModels.filter((m) => m.id !== modelId),
    })),

  setActiveModel: (mode, modelId) =>
    set((state) => ({
      activeModels: { ...state.activeModels, [mode]: modelId },
    })),
}));

export default useModelStore;
