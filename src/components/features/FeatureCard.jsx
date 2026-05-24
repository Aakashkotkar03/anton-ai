// src/components/features/FeatureCard.jsx — 4-state feature card (PRD Feature 10)
// States: available (green), setup (blue), locked (grey/red), coming_soon (dashed grey)
// Design: UI/UX SCREEN 8A (FeaturesTab_Dark)

import { useState } from 'react';
import { Badge, Button, Toggle, KbdBadge } from '../ui';

// Tier upgrade cost estimates (INR, from PRD)
const UPGRADE_HINTS = {
  2: { need: '8 GB RAM', cost: '~₹1,500–₹3,000' },
  3: { need: '16 GB RAM or GPU with 4 GB+ VRAM', cost: '~₹2,500–₹5,000' },
  4: { need: '32 GB+ RAM or GPU with 8 GB+ VRAM', cost: '~₹8,000–₹15,000' },
};

export default function FeatureCard({ feature, onOpen, onSetupAction }) {
  const [notifyMe, setNotifyMe] = useState(false);

  // --- Available ---
  if (feature.status === 'available') {
    return (
      <div className="rounded-xl p-4 border-l-4 border-green-500
        dark:bg-[#1E293B] dark:border-r dark:border-t dark:border-b dark:border-r-[#334155] dark:border-t-[#334155] dark:border-b-[#334155]
        bg-white border-r border-t border-b border-r-slate-200 border-t-slate-200 border-b-slate-200">
        {/* Header row */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{feature.icon}</span>
            <h3 className="text-sm font-semibold dark:text-slate-100 text-slate-800">
              {feature.name}
            </h3>
          </div>
          <Badge variant="green">Active</Badge>
        </div>

        {/* Description */}
        <p className="text-xs dark:text-[#94A3B8] text-slate-500 mb-3">
          {feature.description}
        </p>

        {/* Footer: hotkey + open link */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {feature.hotkey && <KbdBadge>{feature.hotkey}</KbdBadge>}
            {feature.category && (
              <Badge variant="grey">{feature.category}</Badge>
            )}
          </div>
          <button
            onClick={() => onOpen?.(feature)}
            className="text-xs dark:text-blue-400 text-blue-600 hover:underline"
          >
            Open →
          </button>
        </div>
      </div>
    );
  }

  // --- Setup Needed ---
  if (feature.status === 'setup') {
    return (
      <div className="rounded-xl p-4 border-l-4 border-blue-500
        dark:bg-[#1E293B] dark:border-r dark:border-t dark:border-b dark:border-r-[#334155] dark:border-t-[#334155] dark:border-b-[#334155]
        bg-white border-r border-t border-b border-r-slate-200 border-t-slate-200 border-b-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{feature.icon}</span>
            <h3 className="text-sm font-semibold dark:text-slate-100 text-slate-800">
              {feature.name}
            </h3>
          </div>
          <Badge variant="blue">Setup needed</Badge>
        </div>

        <p className="text-xs dark:text-[#94A3B8] text-slate-500 mb-3">
          {feature.description}
        </p>

        {/* Setup steps preview */}
        {feature.setupSteps && feature.setupSteps.length > 0 && (
          <p className="text-[11px] dark:text-[#64748B] text-slate-400 mb-3">
            {feature.setupSteps[0]}
          </p>
        )}

        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => onSetupAction?.(feature)}
        >
          {feature.setupSteps?.[0]?.toLowerCase().includes('install') ? 'Install' : 'Set Up'} →
        </Button>
      </div>
    );
  }

  // --- Hardware Locked ---
  if (feature.status === 'locked') {
    const hint = UPGRADE_HINTS[feature.requiredTier] || UPGRADE_HINTS[2];

    return (
      <div className="rounded-xl p-4 border-l-4 dark:border-l-[#475569] border-l-slate-300
        dark:bg-[#1E293B]/70 dark:border-r dark:border-t dark:border-b dark:border-r-[#334155] dark:border-t-[#334155] dark:border-b-[#334155]
        bg-white/80 border-r border-t border-b border-r-slate-200 border-t-slate-200 border-b-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 opacity-70">
            <span className="text-base">{feature.icon}</span>
            <h3 className="text-sm font-semibold dark:text-slate-300 text-slate-600">
              {feature.name}
            </h3>
          </div>
          <Badge variant="red">Hardware upgrade</Badge>
        </div>

        <p className="text-xs dark:text-[#64748B] text-slate-400 mb-3 opacity-80">
          {feature.description}
        </p>

        {/* Requirement box */}
        <div className="rounded-lg p-2.5
          dark:bg-[#0F172A] bg-slate-50
          border dark:border-[#334155] border-slate-200">
          <p className="text-[11px] dark:text-red-400 text-red-600 mb-0.5">
            Needs: {hint.need}
          </p>
          <p className="text-[11px] dark:text-slate-500 text-slate-400">
            Estimated upgrade: {hint.cost}
          </p>
        </div>
      </div>
    );
  }

  // --- Coming Soon ---
  if (feature.status === 'coming_soon') {
    return (
      <div className="rounded-xl p-4 border-l-4 border-dashed dark:border-l-[#334155] border-l-slate-300
        dark:bg-[#1E293B]/60 dark:border-r dark:border-t dark:border-b dark:border-r-[#334155]/60 dark:border-t-[#334155]/60 dark:border-b-[#334155]/60
        bg-white/70 border-r border-t border-b border-r-slate-200/60 border-t-slate-200/60 border-b-slate-200/60
        opacity-75">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{feature.icon}</span>
            <h3 className="text-sm font-semibold dark:text-slate-400 text-slate-500">
              {feature.name}
            </h3>
          </div>
          <Badge variant="grey">Coming in v{feature.version}</Badge>
        </div>

        <p className="text-xs dark:text-[#64748B] text-slate-400 mb-3">
          {feature.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[11px] dark:text-[#475569] text-slate-400">
            Notify me when available
          </span>
          <Toggle on={notifyMe} onToggle={setNotifyMe} />
        </div>
      </div>
    );
  }

  return null;
}
