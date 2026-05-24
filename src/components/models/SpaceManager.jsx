// src/components/models/SpaceManager.jsx — Disk space management for models
// Shows total usage, per-model sizes, delete with type-to-confirm.
// PRD Feature 9 — Model Library Space Manager.

import { useState } from 'react';
import { Button, Badge } from '../ui';

export default function SpaceManager({ downloadedModels = [], onDelete, onClose }) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const totalMB = downloadedModels.reduce((sum, m) => sum + (m.sizeMB || 0), 0);

  const handleDelete = (model) => {
    if (confirmText === model.name) {
      onDelete?.(model);
      setDeletingId(null);
      setConfirmText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
      dark:bg-black/50 bg-black/20">
      <div className="w-full max-w-md mx-4 rounded-2xl
        dark:bg-[#0F172A] dark:border dark:border-[#1E293B]
        bg-white border border-slate-200
        shadow-2xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0
          border-b dark:border-[#1E293B] border-slate-200">
          <div>
            <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-800">
              Manage Storage
            </h2>
            <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-0.5">
              {downloadedModels.length} model{downloadedModels.length !== 1 ? 's' : ''} · {formatSize(totalMB)} total
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded dark:text-slate-500 dark:hover:text-slate-300
              text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Total usage bar */}
        <div className="px-6 py-3 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] dark:text-slate-400 text-slate-500">Disk Usage</span>
            <span className="text-[11px] font-mono dark:text-slate-300 text-slate-600">
              {formatSize(totalMB)}
            </span>
          </div>
          <div className="h-2 rounded-full dark:bg-[#334155] bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalMB > 20000 ? 'bg-red-500' : totalMB > 10000 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, (totalMB / 30000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Model list */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {downloadedModels.length === 0 && (
            <p className="text-xs dark:text-slate-500 text-slate-400 text-center py-8">
              No models downloaded yet.
            </p>
          )}

          <div className="space-y-2">
            {downloadedModels.map((model) => (
              <div
                key={model.id}
                className="rounded-lg p-3
                  dark:bg-[#1E293B] bg-slate-50
                  border dark:border-[#334155] border-slate-200"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium dark:text-slate-200 text-slate-700 truncate">
                      {model.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="grey">{formatSize(model.sizeMB)}</Badge>
                      <Badge variant={
                        model.category === 'chat' ? 'blue'
                        : model.category === 'code' ? 'blue'
                        : model.category === 'voice' ? 'purple'
                        : 'grey'
                      }>
                        {model.category?.toUpperCase() || 'CHAT'}
                      </Badge>
                      {model.isCustom && <Badge variant="amber">Custom</Badge>}
                    </div>
                  </div>

                  {/* Delete button or confirm UI */}
                  {deletingId !== model.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDeletingId(model.id); setConfirmText(''); }}
                      className="shrink-0 dark:text-red-400 text-red-500 dark:hover:text-red-300 hover:text-red-600"
                    >
                      Delete
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(null)}
                      className="shrink-0"
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                {/* Delete confirmation */}
                {deletingId === model.id && (
                  <div className="mt-2.5 pt-2.5 border-t dark:border-[#334155] border-slate-200">
                    <p className="text-[11px] dark:text-red-400 text-red-600 mb-1.5">
                      Type <span className="font-mono font-bold">{model.name}</span> to confirm
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Type model name..."
                        className="flex-1 px-2 py-1.5 rounded text-xs
                          dark:bg-[#0F172A] dark:border dark:border-[#334155] dark:text-slate-200
                          bg-white border border-slate-300 text-slate-800
                          focus:outline-none focus:ring-1 focus:ring-red-500"
                        autoFocus
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={confirmText !== model.name}
                        onClick={() => handleDelete(model)}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatSize(mb) {
  if (!mb) return '0 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
