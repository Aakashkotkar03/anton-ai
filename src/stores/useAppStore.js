// src/stores/useAppStore.js — Global app state (Zustand)
// Theme, active mode, right panel toggle.

import { create } from 'zustand';

const useAppStore = create((set) => ({
  // --- State ---
  activeMode: 'chat',        // 'chat' | 'models' | 'features' | 'help' | 'settings'
  theme: 'dark',             // 'dark' | 'light'
  rightPanelOpen: false,
  isFirstLaunch: false,

  // --- Actions ---
  setTheme: (theme) => {
    set({ theme });
    // Apply class to <html> for Tailwind darkMode: 'class'
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  },

  setActiveMode: (activeMode) => set({ activeMode }),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  setFirstLaunch: (isFirstLaunch) => set({ isFirstLaunch }),
}));

export default useAppStore;
