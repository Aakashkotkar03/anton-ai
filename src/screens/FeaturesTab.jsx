// src/screens/FeaturesTab.jsx — Feature discovery screen (PRD Feature 10)
// Shows every Anton AI feature with status on this machine.
// Design: UI/UX SCREEN 8A (FeaturesTab_Dark) + SCREEN 8B
//
// Layout: summary card (top) + 2-column grid of FeatureCards

import { useMemo } from 'react';
import useHardwareStore from '../stores/useHardwareStore';
import useAppStore from '../stores/useAppStore';
import { getFeatureStatuses, getFeatureSummary } from '../data/featuresData';
import FeatureCard from '../components/features/FeatureCard';

export default function FeaturesTab() {
  const tier = useHardwareStore((s) => s.tier) || 1;
  const imageTier = useHardwareStore((s) => s.imageTier) || 'IMG-Hidden';
  const setActiveMode = useAppStore((s) => s.setActiveMode);

  // Compute feature statuses from hardware
  // TODO: track installedFeatures in a store (browser extension, etc.)
  const features = useMemo(
    () => getFeatureStatuses(tier, imageTier, new Set()),
    [tier, imageTier]
  );

  const summary = useMemo(() => getFeatureSummary(features), [features]);

  // Find a "quick win" — first feature with status 'setup'
  const quickWin = features.find((f) => f.status === 'setup');

  // --- Navigation handler ---
  const handleOpen = (feature) => {
    const navMap = {
      'chat': 'chat',
      'context-display': 'chat',
      'documents': 'documents',
      'clipboard': 'chat',
      'voice': 'chat',
      'model-library': 'models',
      'custom-import': 'models',
      'features-tab': 'features',
      'help': 'help',
      'settings': 'settings',
    };
    const target = navMap[feature.id];
    if (target) setActiveMode(target);
  };

  const handleSetup = (feature) => {
    if (feature.id === 'browser-extension' || feature.id === 'email') {
      // Open extension install link
      window.antonAPI?.openExternal('https://chrome.google.com/webstore');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ================================================================ */}
      {/* SUMMARY CARD                                                     */}
      {/* ================================================================ */}
      <div className="shrink-0 mx-6 mt-5 mb-4 rounded-xl px-6 py-4
        dark:bg-gradient-to-r dark:from-[#1E3A5F] dark:to-[#0F172A]
        dark:border dark:border-blue-600/20
        bg-gradient-to-r from-[#EFF6FF] to-white
        border border-blue-100">
        <div className="flex items-center justify-between">
          {/* Stat blocks */}
          <div className="flex items-center gap-6">
            <StatBlock value={summary.available} label="Features active" color="dark:text-slate-100 text-slate-900" />
            <Divider />
            <StatBlock value={summary.setup} label="Need setup" color="dark:text-amber-400 text-amber-600" />
            <Divider />
            <StatBlock value={summary.locked} label="Hardware upgrade" color="dark:text-red-400 text-red-500" />
            <Divider />
            <StatBlock value={summary.coming_soon} label="Coming soon" color="dark:text-[#94A3B8] text-slate-400" />
          </div>

          {/* Quick win suggestion */}
          {quickWin && (
            <button
              onClick={() => handleSetup(quickWin)}
              className="text-xs dark:text-blue-400 text-blue-600 hover:underline shrink-0 ml-4"
            >
              ✨ Quick win: {quickWin.setupSteps?.[0]?.split(' ').slice(0, 4).join(' ')}... →
            </button>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* FEATURE GRID — 2-column, scrollable                              */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              onOpen={handleOpen}
              onSetupAction={handleSetup}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary sub-components
// ---------------------------------------------------------------------------
function StatBlock({ value, label, color }) {
  return (
    <div className="text-center min-w-[60px]">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] dark:text-[#64748B] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-10 dark:bg-[#334155] bg-slate-200" />;
}
