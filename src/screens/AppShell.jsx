// src/screens/AppShell.jsx — Main application shell (PRD: Layout Shell — Three Panel)
// The primary screen users see 90% of the time.
// Design: UI/UX SCREEN 12A (AppShell_Dark) + SCREEN 12B (AppShell_Light)
//
// Layout:
//   LEFT RAIL (64px) — icon nav, logo, avatar
//   MAIN PANEL (flex-grow) — renders the active screen
//   RIGHT PANEL (320px, toggleable) — inference params placeholder
//
// Keyboard: Ctrl+1–5 switch nav tabs, Ctrl+Shift+P toggles right panel

import { useEffect, useCallback } from 'react';
import useAppStore from '../stores/useAppStore';
import useAuthStore from '../stores/useAuthStore';
import ChatScreen from './ChatScreen';
import DocumentScreen from './DocumentScreen';
import ModelLibrary from './ModelLibrary';
import Settings from './Settings';
import FeaturesTab from './FeaturesTab';
import HelpScreen from './HelpScreen';

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { id: 'chat',      label: 'Chat',      icon: ChatIcon      },
  { id: 'models',    label: 'Models',    icon: ModelsIcon    },
  { id: 'documents', label: 'Documents', icon: DocumentsIcon },
  { id: 'features',  label: 'Features',  icon: FeaturesIcon  },
  { id: 'help',      label: 'Help',      icon: HelpIcon      },
];

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------
export default function AppShell() {
  const activeMode = useAppStore((s) => s.activeMode);
  const setActiveMode = useAppStore((s) => s.setActiveMode);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const user = useAuthStore((s) => s.user);

  // --- Keyboard shortcuts ---
  const handleKeyDown = useCallback(
    (e) => {
      // Ctrl+1 through Ctrl+5 — switch nav tabs
      if (e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        if (NAV_ITEMS[index]) {
          setActiveMode(NAV_ITEMS[index].id);
        }
        return;
      }

      // Ctrl+Shift+P — toggle right panel
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        toggleRightPanel();
        return;
      }
    },
    [setActiveMode, toggleRightPanel]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // --- Render ---
  return (
    <div className="flex h-screen w-screen overflow-hidden
      dark:bg-[#0F172A] bg-white">

      {/* ================================================================ */}
      {/* LEFT RAIL — 64px icon navigation                                 */}
      {/* ================================================================ */}
      <div className="flex flex-col items-center w-16 h-full shrink-0 py-3
        dark:bg-[#0A0F1A] bg-[#F1F5F9]
        border-r dark:border-[#1E293B] border-slate-200
        relative">

        {/* Subtle right edge glow */}
        <div className="absolute top-0 right-0 bottom-0 w-px
          dark:bg-gradient-to-b dark:from-blue-600/20 dark:via-blue-600/5 dark:to-transparent
          bg-transparent" />

        {/* Logo */}
        <div className="flex items-center justify-center w-9 h-9 rounded-full mb-6
          bg-gradient-to-br from-blue-600 to-blue-700
          shadow-lg shadow-blue-600/20">
          <span className="text-sm font-bold text-white">A</span>
        </div>

        {/* Navigation icons */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeMode === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setActiveMode(item.id)}
                title={item.label}
                className={`relative flex items-center justify-center w-10 h-10 rounded-lg
                  transition-colors duration-150 group
                  ${isActive
                    ? 'dark:bg-blue-600/15 bg-blue-50'
                    : 'dark:hover:bg-slate-800 hover:bg-slate-200'
                  }`}
              >
                {/* Active indicator — left border */}
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-blue-600" />
                )}

                <IconComponent
                  className={`w-[18px] h-[18px] transition-colors
                    ${isActive
                      ? 'text-blue-600'
                      : 'dark:text-slate-500 text-slate-400 dark:group-hover:text-slate-400 group-hover:text-slate-600'
                    }`}
                />

                {/* Amber update dot on Models */}
                {item.id === 'models' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 hidden" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Settings + Avatar */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          {/* Settings */}
          <button
            onClick={() => setActiveMode('settings')}
            title="Settings"
            className={`flex items-center justify-center w-10 h-10 rounded-lg
              transition-colors duration-150
              ${activeMode === 'settings'
                ? 'dark:bg-blue-600/15 bg-blue-50'
                : 'dark:hover:bg-slate-800 hover:bg-slate-200'
              }`}
          >
            <SettingsIcon
              className={`w-[18px] h-[18px] transition-colors
                ${activeMode === 'settings'
                  ? 'text-blue-600'
                  : 'dark:text-slate-500 text-slate-400'
                }`}
            />
          </button>

          {/* User avatar */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full
              dark:bg-slate-700 bg-slate-200
              text-xs font-bold dark:text-slate-300 text-slate-600
              overflow-hidden"
            title={user?.displayName || user?.email || 'User'}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              (user?.displayName || user?.email || 'U').charAt(0).toUpperCase()
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN PANEL — renders active screen                               */}
      {/* ================================================================ */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <ActiveScreen activeMode={activeMode} />
      </div>

      {/* ================================================================ */}
      {/* RIGHT PANEL — inference params + hardware (320px, toggleable)     */}
      {/* ================================================================ */}
      {rightPanelOpen && (
        <div className="w-80 h-full shrink-0 overflow-y-auto
          dark:bg-[#0F172A] bg-white
          border-l dark:border-[#1E293B] border-slate-200
          p-4">
          <RightPanelPlaceholder />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveScreen — route to the correct screen component
// ---------------------------------------------------------------------------
function ActiveScreen({ activeMode }) {
  switch (activeMode) {
    case 'chat':
      return <ChatScreen />;
    case 'documents':
      return <DocumentScreen />;
    case 'models':
      return <ModelLibrary />;
    case 'features':
      return <FeaturesTab />;
    case 'help':
      return <HelpScreen />;
    case 'settings':
      return <Settings />;
    default:
      return <ChatScreen />;
  }
}

// ---------------------------------------------------------------------------
// Placeholder for screens not yet built
// ---------------------------------------------------------------------------
function ScreenPlaceholder({ name, shortcut }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex h-12 w-12 items-center justify-center rounded-full
        dark:bg-slate-800 bg-slate-100 mb-4">
        <span className="text-lg dark:text-slate-500 text-slate-400">🚧</span>
      </div>
      <h2 className="text-lg font-semibold dark:text-slate-200 text-slate-800">
        {name}
      </h2>
      <p className="mt-1 text-xs dark:text-slate-500 text-slate-400">
        Coming in a future session
      </p>
      {shortcut && (
        <kbd className="mt-3 px-2 py-0.5 rounded text-[10px] font-mono
          dark:bg-slate-800 dark:text-slate-400 dark:border dark:border-slate-700
          bg-slate-100 text-slate-500 border border-slate-300">
          {shortcut}
        </kbd>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right panel placeholder — built in Settings session
// ---------------------------------------------------------------------------
function RightPanelPlaceholder() {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider
        dark:text-slate-500 text-slate-400">
        Inference Parameters
      </h3>
      <div className="rounded-xl p-4 dark:bg-[#1E293B] bg-slate-50
        border dark:border-[#334155] border-slate-200">
        <p className="text-xs dark:text-slate-400 text-slate-500">
          Temperature, context size, GPU layers, and hardware info will appear here.
        </p>
        <p className="mt-2 text-[10px] dark:text-slate-600 text-slate-400">
          Toggle: Ctrl+Shift+P
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav Icons (inline SVG — no external deps, 18×18 viewBox)
// ---------------------------------------------------------------------------
function ChatIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ModelsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function DocumentsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function FeaturesIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function HelpIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
