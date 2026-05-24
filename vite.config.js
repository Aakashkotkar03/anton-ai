import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Electron loads from file://, so relative paths are required
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Target modern Electron Chromium — no legacy polyfills needed
    target: 'chrome120',
    rollupOptions: {
      output: {
        // Keep chunk names readable for debugging in dev builds
        manualChunks: undefined,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Dev server — only used during development, not in production Electron app
  server: {
    port: 5173,
    strictPort: true,
  },
});
