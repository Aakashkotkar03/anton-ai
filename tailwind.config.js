/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],

  // Theme switching via class on <html> element: <html class="dark">
  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        // === Anton AI Design Tokens (from PRD v1.0) ===

        // Background tokens — use semantic names in components
        bg: {
          primary: {
            light: '#FFFFFF',
            dark: '#0F172A',       // slate-900
          },
          surface: {
            light: '#F8FAFC',      // slate-50
            dark: '#1E293B',       // slate-800
          },
          raised: {
            light: '#F1F5F9',      // slate-100
            dark: '#334155',       // slate-700
          },
          hover: {
            light: '#E2E8F0',      // slate-200
            dark: '#475569',       // slate-600
          },
        },

        // Brand / Accent
        brand: {
          DEFAULT: '#2563EB',      // blue-600 — same in both themes
          hover: '#1D4ED8',        // blue-700
          light: '#EFF6FF',        // blue-50 (light theme accent bg)
          'dark-bg': '#1E3A5F',    // dark theme accent bg
        },

        // Context bar colours
        ctx: {
          green: {
            light: '#059669',      // emerald-600
            dark: '#10B981',       // emerald-500
          },
          amber: {
            light: '#D97706',      // amber-600
            dark: '#F59E0B',       // amber-500
          },
          red: {
            light: '#DC2626',      // red-600
            dark: '#EF4444',       // red-500
          },
          purple: {
            light: '#7C3AED',      // violet-600
            dark: '#8B5CF6',       // violet-500
          },
        },

        // Semantic status colours
        success: {
          light: '#059669',        // emerald-600
          dark: '#10B981',         // emerald-500
        },
        warning: {
          light: '#D97706',        // amber-600
          dark: '#F59E0B',         // amber-500
        },
        error: {
          light: '#DC2626',        // red-600
          dark: '#EF4444',         // red-500
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },

      fontSize: {
        label: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '20px' }],
        chat: ['16px', { lineHeight: '24px' }],
        section: ['20px', { lineHeight: '28px' }],
        heading: ['28px', { lineHeight: '36px' }],
      },

      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },

      boxShadow: {
        panel: '0 8px 24px rgba(0, 0, 0, 0.12)',
        'panel-dark': '0 8px 24px rgba(0, 0, 0, 0.5)',
      },

      width: {
        rail: '64px',
        'rail-expanded': '240px',
        'right-panel': '320px',
      },
    },
  },

  plugins: [],
};
