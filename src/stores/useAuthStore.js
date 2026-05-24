// src/stores/useAuthStore.js — Zustand store for authentication state
// Tracks the signed-in user, auth status, and loading state.
// Used by App.jsx startup sequence and Login/Settings screens.

import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,            // { uid, email, displayName, photoURL } or null
  isAuthenticated: false,
  isLoading: true,       // true until first auth check completes

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));

export default useAuthStore;
