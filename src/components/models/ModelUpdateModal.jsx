// src/components/models/ModelUpdateModal.jsx — Model update notification
// Shows current vs new version, changelog, Update + Later buttons.
// PRD Feature 9 — Model update system.

import { Button, Badge } from '../ui';

export default function ModelUpdateModal({ model, onUpdate, onDismiss }) {
  if (!model) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
      dark:bg-black/50 bg-black/20">
      <div className="w-full max-w-sm mx-4 rounded-2xl p-6
        dark:bg-[#0F172A] dark:border dark:border-[#1E293B]
        bg-white border border-slate-200
        shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full
            bg-amber-500/10">
            <span className="text-lg">🔄</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-800">
              Update Available
            </h2>
            <p className="text-[11px] dark:text-slate-500 text-slate-400">
              {model.name}
            </p>
          </div>
        </div>

        {/* Version comparison */}
        <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-lg
          dark:bg-[#1E293B] bg-slate-50 border dark:border-[#334155] border-slate-200">
          <div className="text-center flex-1">
            <p className="text-[10px] dark:text-slate-500 text-slate-400 mb-0.5">Current</p>
            <Badge variant="grey">{model.currentVersion || 'v1.0'}</Badge>
          </div>
          <span className="dark:text-slate-600 text-slate-300">→</span>
          <div className="text-center flex-1">
            <p className="text-[10px] dark:text-slate-500 text-slate-400 mb-0.5">New</p>
            <Badge variant="green">{model.newVersion || 'v1.1'}</Badge>
          </div>
        </div>

        {/* Changelog */}
        {model.changelog && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5
              dark:text-slate-500 text-slate-400">
              What's new
            </p>
            <p className="text-xs leading-relaxed dark:text-slate-300 text-slate-600">
              {model.changelog}
            </p>
          </div>
        )}

        {/* Size info */}
        <p className="text-[11px] dark:text-slate-500 text-slate-400 mb-4">
          Download size: {model.updateSizeMB
            ? model.updateSizeMB >= 1024
              ? `${(model.updateSizeMB / 1024).toFixed(1)} GB`
              : `${model.updateSizeMB} MB`
            : model.size || '—'
          }
        </p>

        {/* Buttons */}
        <div className="flex gap-2">
          <Button variant="primary" size="md" className="flex-1" onClick={() => onUpdate?.(model)}>
            Update Now
          </Button>
          <Button variant="ghost" size="md" onClick={onDismiss}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
