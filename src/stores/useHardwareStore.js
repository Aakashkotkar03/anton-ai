// src/stores/useHardwareStore.js — Hardware specs state (Zustand)
// Populated once during App.jsx startup via window.antonAPI.getHardware()

import { create } from 'zustand';

const useHardwareStore = create((set) => ({
  // --- State ---
  specs: null,              // { cpu, ram, gpu, diskFreeGB, arch } or null
  tier: 0,                  // 1–4 (0 = not yet scanned)
  imageTier: 'IMG-Hidden',  // 'IMG-Hidden' | 'IMG-Slow' | 'IMG-Full'
  isLoaded: false,

  // --- Actions ---
  setHardwareInfo: (specs, tier, imageTier) =>
    set({
      specs,
      tier,
      imageTier,
      isLoaded: true,
    }),
}));

export default useHardwareStore;
