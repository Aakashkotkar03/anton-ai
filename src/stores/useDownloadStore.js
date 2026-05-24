// src/stores/useDownloadStore.js — Zustand store for model download tracking
// Tracks active downloads (progress, speed, ETA) and a download queue.
// Used by ModelLibrary and ModelCard components.

import { create } from 'zustand';

const useDownloadStore = create((set) => ({
  // Map of active downloads: { [modelId]: { progress, speed, eta, status } }
  // progress: 0-100 (percentage)
  // speed: string like '2.4 MB/s'
  // eta: string like '3m 12s'
  // status: 'downloading' | 'paused' | 'verifying' | 'complete' | 'failed'
  activeDownloads: {},

  // Queue of model IDs waiting to download (max 2 concurrent in downloader.js)
  downloadQueue: [],

  // --- Actions ---

  setDownloadProgress: (modelId, data) =>
    set((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [modelId]: {
          ...state.activeDownloads[modelId],
          ...data,
        },
      },
    })),

  removeDownload: (modelId) =>
    set((state) => {
      const next = { ...state.activeDownloads };
      delete next[modelId];
      return {
        activeDownloads: next,
        downloadQueue: state.downloadQueue.filter((id) => id !== modelId),
      };
    }),

  addToQueue: (modelId) =>
    set((state) => {
      if (state.downloadQueue.includes(modelId)) return state;
      return { downloadQueue: [...state.downloadQueue, modelId] };
    }),

  removeFromQueue: (modelId) =>
    set((state) => ({
      downloadQueue: state.downloadQueue.filter((id) => id !== modelId),
    })),

  // Convenience: check if a model is actively downloading
  isDownloading: (modelId) => {
    const state = useDownloadStore.getState();
    const dl = state.activeDownloads[modelId];
    return dl && (dl.status === 'downloading' || dl.status === 'verifying');
  },

  // Reset all downloads (e.g. on app restart)
  clearAll: () => set({ activeDownloads: {}, downloadQueue: [] }),
}));

export default useDownloadStore;
