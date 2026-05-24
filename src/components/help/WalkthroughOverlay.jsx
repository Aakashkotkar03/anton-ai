// src/components/help/WalkthroughOverlay.jsx — 5-step spotlight walkthrough
// Dark overlay with a cutout highlighting UI elements, tooltip with explanation.
// Completion stored in SQLite via IPC. Skip button always visible.
// Design: PRD Feature 10 — interactive walkthrough.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui';

// ---------------------------------------------------------------------------
// Walkthrough steps
// ---------------------------------------------------------------------------
const STEPS = [
  {
    id: 'chat-input',
    title: 'Chat Input',
    description: 'Type your message here and press Ctrl+Enter to send. The AI runs entirely on your PC — your text never leaves this device.',
    selector: '[data-walkthrough="chat-input"]',
    position: 'top', // tooltip position relative to highlighted element
  },
  {
    id: 'persona-switcher',
    title: 'Persona Modes',
    description: 'Switch between General, Coder, Writer, and Analyst modes. Each uses a different system prompt optimised for that task.',
    selector: '[data-walkthrough="persona-switcher"]',
    position: 'bottom',
  },
  {
    id: 'context-bar',
    title: 'Context Bar',
    description: 'This shows how much of the AI\'s memory is in use. Green is good, amber means getting full, red means older messages will be summarised.',
    selector: '[data-walkthrough="context-bar"]',
    position: 'top',
  },
  {
    id: 'model-selector',
    title: 'Active Model',
    description: 'Shows which AI model is currently loaded. Click the Models tab in the left rail to download more models or switch between them.',
    selector: '[data-walkthrough="model-selector"]',
    position: 'bottom',
  },
  {
    id: 'alt-space',
    title: 'Floating Panel — Alt+Space',
    description: 'Press Alt+Space from any application to open the floating AI chat panel. It stays on top of all windows so you can get AI help without switching apps.',
    selector: null, // No element to highlight — this is a shortcut tip
    position: 'center',
  },
];

// ---------------------------------------------------------------------------
// WalkthroughOverlay
// ---------------------------------------------------------------------------
export default function WalkthroughOverlay({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState(null);
  const overlayRef = useRef(null);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  // --- Find and measure the target element ---
  useEffect(() => {
    if (!step?.selector) {
      setHighlightRect(null);
      return;
    }

    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      });

      // Scroll element into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setHighlightRect(null);
    }
  }, [currentStep, step?.selector]);

  // --- Navigation ---
  const goNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLastStep]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleComplete = useCallback(async () => {
    try {
      await window.antonAPI?.completeWalkthrough?.();
    } catch (_err) {
      // Non-critical — walkthrough may show again
    }
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(async () => {
    try {
      await window.antonAPI?.completeWalkthrough?.();
    } catch (_err) {
      // ignore
    }
    onSkip();
  }, [onSkip]);

  // --- Keyboard ---
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      if (e.key === 'ArrowLeft') goBack();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [goNext, goBack, handleSkip]);

  // --- Tooltip position calculation ---
  const getTooltipStyle = () => {
    if (!highlightRect || step.position === 'center') {
      // Centre of screen for no-element steps
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const margin = 16;

    if (step.position === 'bottom') {
      return {
        position: 'fixed',
        top: highlightRect.top + highlightRect.height + margin,
        left: Math.max(16, highlightRect.left + highlightRect.width / 2 - 160),
      };
    }

    // top (default)
    return {
      position: 'fixed',
      top: highlightRect.top - margin - 140, // approximate tooltip height
      left: Math.max(16, highlightRect.left + highlightRect.width / 2 - 160),
    };
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999]"
    >
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="walkthrough-mask">
            <rect width="100%" height="100%" fill="white" />
            {highlightRect && (
              <rect
                x={highlightRect.left}
                y={highlightRect.top}
                width={highlightRect.width}
                height={highlightRect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#walkthrough-mask)"
        />
        {/* Blue glow ring around highlighted element */}
        {highlightRect && (
          <rect
            x={highlightRect.left - 2}
            y={highlightRect.top - 2}
            width={highlightRect.width + 4}
            height={highlightRect.height + 4}
            rx="10"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className="z-10 w-[320px] rounded-xl p-5
          dark:bg-[#1E293B] dark:border dark:border-[#334155]
          bg-white border border-slate-200
          shadow-2xl"
        style={getTooltipStyle()}
      >
        {/* Step number */}
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1
          dark:text-blue-400 text-blue-600">
          Step {currentStep + 1} of {STEPS.length}
        </p>

        {/* Title */}
        <h3 className="text-sm font-bold mb-2 dark:text-slate-100 text-slate-900">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-xs leading-relaxed mb-4 dark:text-slate-300 text-slate-600">
          {step.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200
                  ${i === currentStep
                    ? 'w-6 h-1.5 bg-blue-600'
                    : i < currentStep
                      ? 'w-1.5 h-1.5 bg-blue-600/50'
                      : 'w-1.5 h-1.5 dark:bg-[#334155] bg-slate-300'
                  }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                Back
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={goNext}>
              {isLastStep ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>

      {/* Skip button — always visible, top-right */}
      <button
        onClick={handleSkip}
        className="fixed top-6 right-6 z-10 px-3 py-1.5 rounded-lg text-xs
          dark:bg-[#334155] dark:text-slate-400 dark:hover:text-slate-200
          bg-white/90 text-slate-500 hover:text-slate-700
          shadow-lg transition-colors"
      >
        Skip tour
      </button>
    </div>
  );
}
