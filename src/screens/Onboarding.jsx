// src/screens/Onboarding.jsx — 5-step first-launch flow (PRD Feature 11)
// Design: UI/UX SCREEN 5A (Onboarding_Step2_Dark) + SCREEN 5B
//
// Steps:
//   1. Welcome — logo, tagline, feature highlights
//   2. Hardware Scan — animated scan, specs, tier stars
//   3. Primary Use — 3 use-case cards
//   4. Download First Model — filtered list, inline download
//   5. All Set — tips, confetti, tour button
//
// Completion stored in SQLite onboarding table. Never repeats.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Badge } from '../components/ui';

// ---------------------------------------------------------------------------
// Use case options (Step 3)
// ---------------------------------------------------------------------------
const USE_CASES = [
  { id: 'chat',   icon: '💬', title: 'Chat & Writing',        desc: 'Ask questions, write content, brainstorm ideas.' },
  { id: 'email',  icon: '📧', title: 'Email & Productivity',  desc: 'Draft replies, fix grammar, summarise documents.' },
  { id: 'coding', icon: '💻', title: 'Coding',                desc: 'Code review, debugging help, generate functions.' },
];

// Tier descriptions (Step 2)
const TIER_DESCRIPTIONS = {
  1: 'Basic AI performance. Best with small 3B models. Great for quick questions and short writing.',
  2: 'Good AI performance. Can run 7B models smoothly. Handles most tasks well.',
  3: 'Great AI performance. Can run up to 13B models with GPU offload. Fast and capable.',
  4: 'Excellent AI performance. Full GPU offload for 34B+ models. The best local AI experience.',
};

// Model suggestions per use case + tier
function getSuggestedModels(useCase, tier, catalogue) {
  if (!catalogue || catalogue.length === 0) return [];

  const categoryMap = { chat: 'chat', email: 'chat', coding: 'code' };
  const preferredCategory = categoryMap[useCase] || 'chat';

  return catalogue
    .filter((m) => {
      const minTier = m.minTier || 1;
      if (minTier > tier) return false;
      if (m.category !== preferredCategory && m.category !== 'chat') return false;
      if (m.comingSoon) return false;
      return true;
    })
    .sort((a, b) => (a.minTier || 1) - (b.minTier || 1))
    .slice(0, 3);
}

// Speed estimate helper
function getSpeedLabel(model, tier) {
  const size = (model.sizeMB || 0) / 1024;
  if (size <= 2.5) return tier >= 3 ? '~15-30 tok/sec' : tier >= 2 ? '~5-10 tok/sec' : '~2-4 tok/sec';
  if (size <= 5.5) return tier >= 4 ? '~20-40 tok/sec' : tier >= 3 ? '~8-15 tok/sec' : '~3-6 tok/sec';
  return tier >= 4 ? '~10-25 tok/sec' : '~4-8 tok/sec';
}

// ---------------------------------------------------------------------------
// Onboarding (main component)
// ---------------------------------------------------------------------------
export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [hardware, setHardware] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedUseCase, setSelectedUseCase] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadDone, setDownloadDone] = useState(false);

  // Cleanup refs for download listeners
  const cleanupProgressRef = useRef(null);
  const cleanupCompleteRef = useRef(null);

  // Cleanup download listeners on unmount
  useEffect(() => {
    return () => {
      if (cleanupProgressRef.current) cleanupProgressRef.current();
      if (cleanupCompleteRef.current) cleanupCompleteRef.current();
    };
  }, []);

  // --- Step 2: Hardware scan ---
  const runScan = useCallback(async () => {
    setIsScanning(true);
    try {
      // Minimum 2-second animation even if scan is instant
      const [result] = await Promise.all([
        window.antonAPI.getHardware(),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
      setHardware(result);
    } catch (err) {
      console.error('[onboarding] Hardware scan failed:', err);
      setHardware({ cpu: 'Unknown', ramGB: 0, gpu: null, tier: 1, imageTier: 'IMG-Hidden' });
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Auto-start scan when reaching step 2
  useEffect(() => {
    if (step === 2 && !hardware && !isScanning) {
      runScan();
    }
  }, [step, hardware, isScanning, runScan]);

  // --- Step 4: Load catalogue ---
  useEffect(() => {
    if (step === 4 && catalogue.length === 0) {
      window.antonAPI.getCatalogue()
        .then((result) => {
          if (result?.models) setCatalogue(result.models);
        })
        .catch(() => {});
    }
  }, [step, catalogue.length]);

  // --- Step 4: Download handler ---
  const handleDownload = useCallback(async (model) => {
    setDownloadingId(model.id);
    setDownloadProgress(0);
    setDownloadDone(false);

    // Listen for progress
    if (cleanupProgressRef.current) cleanupProgressRef.current();
    cleanupProgressRef.current = window.antonAPI.onDownloadProgress((data) => {
      if (data.modelId === model.id) {
        setDownloadProgress(data.progress || 0);
      }
    });

    if (cleanupCompleteRef.current) cleanupCompleteRef.current();
    cleanupCompleteRef.current = window.antonAPI.onDownloadComplete((data) => {
      if (data.modelId === model.id) {
        setDownloadDone(true);
        setDownloadProgress(100);
      }
    });

    try {
      await window.antonAPI.startDownload(model);
    } catch (err) {
      console.error('[onboarding] Download failed:', err);
      setDownloadingId(null);
    }
  }, []);

  // --- Step 5: Complete onboarding ---
  const handleFinish = useCallback(async () => {
    try {
      await window.antonAPI.completeOnboarding();
    } catch (_err) {
      // Non-critical — worst case, onboarding shows once more
    }
    onComplete();
  }, [onComplete]);

  // --- Navigation ---
  const goNext = () => setStep((s) => Math.min(5, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // --- Render ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen
      dark:bg-[#0F172A] bg-slate-50 p-4">

      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none
        dark:bg-[radial-gradient(ellipse_at_center,#1E3A5F_0%,transparent_60%)]
        bg-[radial-gradient(ellipse_at_center,#EFF6FF_0%,transparent_60%)]
        opacity-30" />

      {/* Card */}
      <div className="relative w-full max-w-lg rounded-2xl p-8 z-10
        dark:bg-[#1E293B] dark:border dark:border-[#334155]
        dark:shadow-[0_24px_64px_rgba(0,0,0,0.5),0_0_0_1px_#334155]
        bg-white border border-slate-200
        shadow-[0_24px_64px_rgba(0,0,0,0.08)]">

        {step === 1 && <StepWelcome onNext={goNext} />}
        {step === 2 && <StepHardware hardware={hardware} isScanning={isScanning} onNext={goNext} onBack={goBack} />}
        {step === 3 && <StepUseCase selected={selectedUseCase} onSelect={setSelectedUseCase} onNext={goNext} onBack={goBack} />}
        {step === 4 && (
          <StepDownload
            catalogue={catalogue}
            tier={hardware?.tier || 1}
            useCase={selectedUseCase}
            downloadingId={downloadingId}
            downloadProgress={downloadProgress}
            downloadDone={downloadDone}
            onDownload={handleDownload}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 5 && (
          <StepComplete
            useCase={selectedUseCase}
            downloadDone={downloadDone}
            downloadProgress={downloadProgress}
            onFinish={handleFinish}
          />
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mt-6 z-10">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`rounded-full transition-all duration-300
              ${step === s
                ? 'w-8 h-2 bg-blue-600'
                : step > s
                  ? 'w-2 h-2 bg-blue-600/50'
                  : 'w-2 h-2 dark:bg-[#334155] bg-slate-300'
              }`}
          />
        ))}
      </div>

      {/* Step indicator */}
      <p className="mt-2 text-[11px] dark:text-[#64748B] text-slate-400 z-10">
        {step} of 5
      </p>
    </div>
  );
}

// ===========================================================================
// STEP 1 — Welcome
// ===========================================================================
function StepWelcome({ onNext }) {
  return (
    <div className="text-center">
      {/* Logo */}
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full
        bg-gradient-to-br from-blue-600 to-blue-700
        shadow-lg shadow-blue-600/30">
        <span className="text-2xl font-bold text-white">A</span>
      </div>

      <h1 className="text-2xl font-bold dark:text-slate-100 text-slate-900">
        Anton AI
      </h1>
      <p className="text-xs dark:text-[#64748B] text-slate-400 mt-1">
        by Local Intelligence
      </p>

      {/* Feature highlights */}
      <div className="mt-6 space-y-2.5 text-left">
        {[
          { icon: '💬', text: 'Chat with AI — runs entirely on your PC' },
          { icon: '📧', text: 'AI email assistant for Gmail & Outlook' },
          { icon: '📄', text: 'Summarise documents, ask questions about files' },
        ].map((f) => (
          <div key={f.icon} className="flex items-center gap-3 px-3 py-2 rounded-lg
            dark:bg-[#0F172A] bg-slate-50">
            <span className="text-base">{f.icon}</span>
            <span className="text-xs dark:text-slate-300 text-slate-600">{f.text}</span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[11px] dark:text-[#64748B] text-slate-400">
        Free — no credit card, no subscription, ever.
      </p>

      <Button variant="primary" size="lg" className="w-full mt-5" onClick={onNext}>
        Get Started →
      </Button>
    </div>
  );
}

// ===========================================================================
// STEP 2 — Hardware Scan
// ===========================================================================
function StepHardware({ hardware, isScanning, onNext, onBack }) {
  const tier = hardware?.tier || 1;

  return (
    <div className="text-center">
      {/* Scan animation / result */}
      <div className="mx-auto mb-5 relative flex items-center justify-center w-28 h-28">
        {isScanning ? (
          <>
            <div className="absolute inset-0 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
            <div className="flex flex-col items-center">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 rounded-full border-[3px] border-green-500 opacity-30" />
            <span className="text-xs font-medium dark:text-green-400 text-green-600">
              Scan complete
            </span>
          </>
        )}
      </div>

      <h2 className="text-xl font-bold dark:text-slate-100 text-slate-900">
        {isScanning ? 'Scanning your PC...' : 'Your PC is ready'}
      </h2>
      {!isScanning && (
        <p className="text-xs dark:text-[#94A3B8] text-slate-500 mt-1">
          Here's what Anton AI found on your machine
        </p>
      )}

      {/* Hardware results */}
      {hardware && !isScanning && (
        <>
          <div className="mt-5 rounded-xl p-4 space-y-0
            dark:bg-[#0F172A] bg-slate-50 border dark:border-[#334155] border-slate-200">
            <HardwareRow icon="🔲" label="Processor" value={hardware.cpu || 'Unknown'} />
            <HardwareRow icon="🧱" label="Memory" value={hardware.ramGB ? `${hardware.ramGB} GB` : 'Unknown'} />
            <HardwareRow icon="🎮" label="Graphics" value={hardware.gpu || 'No dedicated GPU'} />
          </div>

          {/* Tier stars */}
          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-wider dark:text-[#64748B] text-slate-400 mb-2">
              Your AI Performance Tier
            </p>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4].map((s) => (
                <span key={s} className={`text-2xl ${s <= tier ? 'text-amber-400' : 'dark:text-[#334155] text-slate-300'}`}>
                  {s <= tier ? '★' : '☆'}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold dark:text-slate-100 text-slate-800">
              Tier {tier} — {tier === 1 ? 'Basic' : tier === 2 ? 'Good' : tier === 3 ? 'Great' : 'Excellent'}
            </p>
            <p className="text-xs dark:text-[#94A3B8] text-slate-500 mt-1 px-4">
              {TIER_DESCRIPTIONS[tier]}
            </p>
          </div>
        </>
      )}

      <div className="flex gap-2 mt-6">
        <Button variant="ghost" size="md" onClick={onBack}>Back</Button>
        <Button variant="primary" size="md" className="flex-1" onClick={onNext} disabled={isScanning}>
          Next →
        </Button>
      </div>
    </div>
  );
}

function HardwareRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5
      border-b dark:border-[#1E293B] border-slate-100 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="text-sm dark:text-[#64748B] text-slate-400">{icon}</span>
        <span className="text-xs dark:text-[#64748B] text-slate-400">{label}</span>
      </div>
      <span className="text-xs font-medium dark:text-slate-200 text-slate-700">{value}</span>
    </div>
  );
}

// ===========================================================================
// STEP 3 — Primary Use Case
// ===========================================================================
function StepUseCase({ selected, onSelect, onNext, onBack }) {
  return (
    <div>
      <h2 className="text-xl font-bold dark:text-slate-100 text-slate-900 text-center">
        What will you use most?
      </h2>
      <p className="text-xs dark:text-[#94A3B8] text-slate-500 mt-1 text-center">
        This helps us recommend the best model. You can use all features any time.
      </p>

      <div className="mt-5 space-y-2.5">
        {USE_CASES.map((uc) => (
          <button
            key={uc.id}
            onClick={() => onSelect(uc.id)}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all
              ${selected === uc.id
                ? 'dark:border-blue-600 dark:bg-blue-900/10 border-blue-500 bg-blue-50'
                : 'dark:border-[#334155] dark:hover:border-slate-500 border-slate-200 hover:border-slate-300'
              }`}
          >
            <span className="text-2xl">{uc.icon}</span>
            <div>
              <p className="text-sm font-semibold dark:text-slate-100 text-slate-800">{uc.title}</p>
              <p className="text-xs dark:text-[#94A3B8] text-slate-500 mt-0.5">{uc.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-6">
        <Button variant="ghost" size="md" onClick={onBack}>Back</Button>
        <Button variant="primary" size="md" className="flex-1" onClick={onNext} disabled={!selected}>
          Next →
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// STEP 4 — Download First Model
// ===========================================================================
function StepDownload({
  catalogue, tier, useCase, downloadingId, downloadProgress, downloadDone,
  onDownload, onNext, onBack,
}) {
  const suggested = getSuggestedModels(useCase, tier, catalogue);

  return (
    <div>
      <h2 className="text-xl font-bold dark:text-slate-100 text-slate-900 text-center">
        Download your first model
      </h2>
      <p className="text-xs dark:text-[#94A3B8] text-slate-500 mt-1 text-center">
        Recommended for your PC and use case. Download once, use offline forever.
      </p>

      <div className="mt-5 space-y-2.5">
        {suggested.length === 0 && (
          <p className="text-xs dark:text-slate-500 text-slate-400 text-center py-4">
            Loading models...
          </p>
        )}

        {suggested.map((model) => {
          const isThis = downloadingId === model.id;
          const isDone = isThis && downloadDone;

          return (
            <div
              key={model.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl
                dark:bg-[#0F172A] bg-slate-50 border dark:border-[#334155] border-slate-200"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium dark:text-slate-200 text-slate-700 truncate">
                  {model.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="grey">
                    {model.sizeMB >= 1024 ? `${(model.sizeMB / 1024).toFixed(1)} GB` : `${model.sizeMB} MB`}
                  </Badge>
                  <span className="text-[10px] dark:text-amber-400/80 text-amber-600">
                    {getSpeedLabel(model, tier)}
                  </span>
                </div>

                {/* Progress bar */}
                {isThis && !isDone && (
                  <div className="mt-2 h-1.5 rounded-full dark:bg-[#334155] bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="shrink-0">
                {isDone ? (
                  <Badge variant="green">Downloaded ✓</Badge>
                ) : isThis ? (
                  <span className="text-xs dark:text-blue-400 text-blue-600">
                    {downloadProgress.toFixed(0)}%
                  </span>
                ) : downloadingId ? (
                  <Button variant="ghost" size="sm" disabled>—</Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => onDownload(model)}>
                    Download
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-6">
        <Button variant="ghost" size="md" onClick={onBack}>Back</Button>
        <Button variant="primary" size="md" className="flex-1" onClick={onNext}>
          {downloadDone ? 'Next →' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// STEP 5 — All Set
// ===========================================================================
function StepComplete({ useCase, downloadDone, downloadProgress, onFinish }) {
  const confettiRef = useRef(false);

  // Fire confetti on mount (only once)
  useEffect(() => {
    if (confettiRef.current) return;
    confettiRef.current = true;

    // Canvas-confetti is optional — skip if not available
    try {
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'],
        });
      }).catch(() => {
        // canvas-confetti not installed — skip silently
      });
    } catch (_e) {
      // ignore
    }
  }, []);

  const tips = [
    { icon: '⌨️', text: 'Press Alt+Space from any app to open the AI chat panel.' },
    { icon: '🌐', text: 'Install the browser extension to use AI in Gmail and Outlook.' },
    { icon: '💾', text: 'Your models and history are saved locally — they survive app updates.' },
  ];

  const featureMap = { chat: 'Chat', email: 'Email', coding: 'Code' };
  const featureLabel = featureMap[useCase] || 'Chat';

  return (
    <div className="text-center">
      <span className="text-4xl mb-4 inline-block">🎉</span>
      <h2 className="text-xl font-bold dark:text-slate-100 text-slate-900">
        You're all set!
      </h2>
      <p className="text-xs dark:text-[#94A3B8] text-slate-500 mt-1">
        Anton AI is ready to use on your PC.
      </p>

      {/* Download progress (if still running) */}
      {!downloadDone && downloadProgress > 0 && downloadProgress < 100 && (
        <div className="mt-4 px-4">
          <p className="text-[11px] dark:text-slate-400 text-slate-500 mb-1">
            Model downloading... {downloadProgress.toFixed(0)}%
          </p>
          <div className="h-1.5 rounded-full dark:bg-[#334155] bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick tips */}
      <div className="mt-5 space-y-2 text-left">
        {tips.map((tip) => (
          <div key={tip.icon} className="flex items-center gap-3 px-3 py-2 rounded-lg
            dark:bg-[#0F172A] bg-slate-50">
            <span className="text-base">{tip.icon}</span>
            <span className="text-xs dark:text-slate-300 text-slate-600">{tip.text}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <Button variant="primary" size="lg" className="w-full" onClick={onFinish}>
          Go to {featureLabel} →
        </Button>
      </div>
    </div>
  );
}
