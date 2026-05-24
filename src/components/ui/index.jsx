// src/components/ui/index.jsx — Shared UI primitives for Anton AI
// All components use Tailwind dark: classes for theme support.
// Design: Anton AI UI/UX Design Philosophy — warm, precise, premium.
//
// Exports: Button, Badge, Toggle, Skeleton, Toast, KbdBadge

import { useState, useEffect, useRef, useCallback } from 'react';

// ===========================================================================
// 1. BUTTON
// ===========================================================================
// variant: 'primary' | 'secondary' | 'danger' | 'ghost'
// size: 'sm' | 'md' | 'lg'
// loading: shows spinner, disables interaction
// icon: ReactNode — rendered left of children

const BUTTON_VARIANTS = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-600/50',
  secondary:
    'dark:bg-[#334155] dark:text-slate-200 dark:hover:bg-slate-600 ' +
    'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 ' +
    'disabled:opacity-50',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:bg-red-600/50',
  ghost:
    'bg-transparent dark:text-slate-300 dark:hover:bg-[#334155] ' +
    'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50',
};

const BUTTON_SIZES = {
  sm: 'px-2.5 py-1 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon = null,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium
        transition-colors duration-150
        disabled:cursor-not-allowed
        ${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary}
        ${BUTTON_SIZES[size] || BUTTON_SIZES.md}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

function Spinner({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin shrink-0"
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-75"
      />
    </svg>
  );
}

// ===========================================================================
// 2. BADGE
// ===========================================================================
// variant: 'blue' | 'green' | 'amber' | 'red' | 'grey' | 'purple'

const BADGE_VARIANTS = {
  blue:
    'dark:bg-blue-900/50 dark:text-blue-300 bg-blue-100 text-blue-700',
  green:
    'dark:bg-green-900/50 dark:text-green-300 bg-green-100 text-green-700',
  amber:
    'dark:bg-amber-900/50 dark:text-amber-300 bg-amber-100 text-amber-700',
  red:
    'dark:bg-red-900/50 dark:text-red-300 bg-red-100 text-red-700',
  grey:
    'dark:bg-slate-700 dark:text-slate-300 bg-slate-100 text-slate-600',
  purple:
    'dark:bg-purple-900/50 dark:text-purple-300 bg-purple-100 text-purple-700',
};

export function Badge({ variant = 'grey', children, className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full
        text-[10px] font-medium leading-tight
        ${BADGE_VARIANTS[variant] || BADGE_VARIANTS.grey}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// ===========================================================================
// 3. TOGGLE
// ===========================================================================
// on: boolean, onToggle: () => void, disabled: boolean
// 44×24px pill — pure Tailwind, no headless UI.

export function Toggle({ on = false, onToggle, disabled = false, label = '' }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onToggle?.(!on)}
      className={`
        relative inline-flex items-center shrink-0
        w-11 h-6 rounded-full transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${on
          ? 'bg-blue-600'
          : 'dark:bg-slate-600 bg-slate-200'
        }
      `}
    >
      <span
        className={`
          inline-block w-4 h-4 rounded-full bg-white
          shadow-sm transition-transform duration-200
          ${on ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

// ===========================================================================
// 4. SKELETON
// ===========================================================================
// variant: 'text' | 'card' | 'circle'
// Animated shimmer using Tailwind animate-pulse.

export function Skeleton({ variant = 'text', className = '' }) {
  const base = 'animate-pulse dark:bg-slate-700 bg-slate-200 rounded';

  switch (variant) {
    case 'circle':
      return <div className={`${base} w-10 h-10 rounded-full ${className}`} />;
    case 'card':
      return (
        <div className={`${base} rounded-xl p-4 space-y-3 ${className}`}>
          <div className="dark:bg-slate-600 bg-slate-300 h-4 w-3/4 rounded" />
          <div className="dark:bg-slate-600 bg-slate-300 h-3 w-full rounded" />
          <div className="dark:bg-slate-600 bg-slate-300 h-3 w-5/6 rounded" />
        </div>
      );
    case 'text':
    default:
      return <div className={`${base} h-4 w-full ${className}`} />;
  }
}

// ===========================================================================
// 5. TOAST
// ===========================================================================
// variant: 'success' | 'error' | 'info'
// message: string
// onDismiss: () => void
// autoDismissMs: number (default 4000)
// Position: fixed bottom-4 right-4. Left coloured border.

const TOAST_STYLES = {
  success: {
    border: 'border-l-4 border-green-500',
    icon: '✓',
    iconBg: 'dark:text-green-400 text-green-600',
  },
  error: {
    border: 'border-l-4 border-red-500',
    icon: '✕',
    iconBg: 'dark:text-red-400 text-red-600',
  },
  info: {
    border: 'border-l-4 border-blue-500',
    icon: 'ℹ',
    iconBg: 'dark:text-blue-400 text-blue-600',
  },
};

export function Toast({
  variant = 'info',
  message,
  onDismiss,
  autoDismissMs = 4000,
}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    // Small delay for exit animation before calling onDismiss
    setTimeout(() => onDismiss?.(), 150);
  }, [onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, autoDismissMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoDismissMs, dismiss]);

  // Pause on hover
  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  const handleMouseLeave = () => {
    timerRef.current = setTimeout(dismiss, 2000); // 2s grace after hover
  };

  const style = TOAST_STYLES[variant] || TOAST_STYLES.info;

  if (!visible) return null;

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50
        w-80 rounded-lg overflow-hidden
        dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:shadow-2xl
        bg-white border border-slate-200 shadow-lg
        ${style.border}
        animate-in slide-in-from-right
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Content */}
      <div className="flex items-start gap-3 p-3">
        <span className={`text-sm font-bold mt-0.5 ${style.iconBg}`}>
          {style.icon}
        </span>
        <p className="text-xs leading-relaxed flex-1
          dark:text-slate-200 text-slate-700">
          {message}
        </p>
        <button
          onClick={dismiss}
          className="text-xs shrink-0 dark:text-slate-500 dark:hover:text-slate-300
            text-slate-400 hover:text-slate-600 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 dark:bg-[#334155] bg-slate-100">
        <div
          className={`h-full rounded-r-full ${
            variant === 'success' ? 'bg-green-500'
            : variant === 'error' ? 'bg-red-500'
            : 'bg-blue-500'
          }`}
          style={{
            animation: `antonai-toast-bar ${autoDismissMs}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes antonai-toast-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// ===========================================================================
// 6. KBD BADGE
// ===========================================================================
// Keyboard shortcut display badge. e.g. <KbdBadge>Alt+Space</KbdBadge>

export function KbdBadge({ children, className = '' }) {
  return (
    <kbd
      className={`
        inline-flex items-center px-1.5 py-0.5 rounded
        text-[10px] font-mono font-medium leading-tight
        dark:bg-[#334155] dark:text-slate-300 dark:border dark:border-slate-600
        bg-slate-100 text-slate-600 border border-slate-300
        ${className}
      `}
    >
      {children}
    </kbd>
  );
}
