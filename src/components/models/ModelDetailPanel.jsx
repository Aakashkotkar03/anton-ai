// src/components/models/ModelDetailPanel.jsx — Slide-in model detail panel
// 320px panel from right with full model info, benchmarks placeholder, delete.

import { useState } from 'react';
import { Button, Badge } from '../ui';

export default function ModelDetailPanel({ model, onClose, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  if (!model) return null;

  const handleDelete = () => {
    if (deleteInput === model.name) {
      onDelete?.(model);
      onClose();
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 z-40
      dark:bg-[#0F172A] bg-white
      border-l dark:border-[#1E293B] border-slate-200
      shadow-2xl
      flex flex-col
      animate-in slide-in-from-right duration-200">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0
        border-b dark:border-[#1E293B] border-slate-200">
        <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-800 truncate pr-2">
          {model.name}
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded dark:text-slate-500 dark:hover:text-slate-300
            text-slate-400 hover:text-slate-600 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="blue">{model.category?.toUpperCase() || 'CHAT'}</Badge>
          <Badge variant="grey">{model.size || formatSize(model.sizeMB)}</Badge>
          <Badge variant="green">Tier {model.minTier || 1}+</Badge>
          {model.isCustom && <Badge variant="amber">Custom</Badge>}
        </div>

        {/* Description */}
        <Section title="Description">
          <p className="text-xs leading-relaxed dark:text-slate-300 text-slate-600">
            {model.description || 'No description available.'}
          </p>
        </Section>

        {/* Model info */}
        <Section title="File Info">
          <InfoRow label="File" value={model.fileName || model.id} />
          <InfoRow label="Size" value={model.size || formatSize(model.sizeMB)} />
          <InfoRow label="Quantisation" value={model.quantisation || 'Q4_K_M'} />
          <InfoRow label="Parameters" value={model.parameters || '—'} />
          <InfoRow label="Context" value={model.nativeContext ? `${model.nativeContext.toLocaleString()} tokens` : '—'} />
          {model.filePath && (
            <InfoRow label="Path" value={model.filePath} truncate />
          )}
        </Section>

        {/* Benchmarks placeholder */}
        <Section title="Benchmarks">
          <div className="rounded-lg p-3 dark:bg-[#1E293B] bg-slate-50
            border dark:border-[#334155] border-slate-200">
            <p className="text-[11px] dark:text-slate-500 text-slate-400 text-center">
              Benchmarks coming in v1.1
            </p>
          </div>
        </Section>

        {/* Source */}
        {model.downloadUrl && (
          <Section title="Source">
            <button
              onClick={() => window.antonAPI?.openExternal(model.downloadUrl)}
              className="text-xs dark:text-blue-400 text-blue-600 hover:underline truncate block"
            >
              View on HuggingFace →
            </button>
          </Section>
        )}

        {/* Danger zone */}
        <Section title="Danger Zone">
          {!showDeleteConfirm ? (
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Model
            </Button>
          ) : (
            <div className="space-y-2 rounded-lg p-3
              dark:bg-red-900/10 bg-red-50
              border dark:border-red-800/30 border-red-200">
              <p className="text-[11px] dark:text-red-400 text-red-600">
                Type <span className="font-mono font-bold">{model.name}</span> to confirm deletion.
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Type model name..."
                className="w-full px-2.5 py-1.5 rounded text-xs
                  dark:bg-[#0F172A] dark:border dark:border-[#334155] dark:text-slate-200
                  bg-white border border-slate-300 text-slate-800
                  focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  disabled={deleteInput !== model.name}
                  onClick={handleDelete}
                >
                  Confirm Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2
        dark:text-slate-500 text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, truncate = false }) {
  return (
    <div className="flex items-start justify-between py-1.5
      border-b dark:border-[#1E293B] border-slate-100 last:border-0">
      <span className="text-[11px] dark:text-[#64748B] text-slate-400 shrink-0 mr-3">
        {label}
      </span>
      <span className={`text-[11px] dark:text-slate-300 text-slate-600 text-right
        ${truncate ? 'truncate max-w-[160px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function formatSize(mb) {
  if (!mb) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
