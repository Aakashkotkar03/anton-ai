// src/components/models/ModelCard.jsx — Individual model card (PRD Feature 9)
// Shows model info, download/use/update actions, hardware gating overlay.
// Design: UI/UX SCREEN 2A (ModelLibrary_Dark)

import { Badge, Button } from '../ui';

const CATEGORY_BADGES = {
  chat:  { variant: 'blue',   label: 'CHAT' },
  code:  { variant: 'blue',   label: 'CODE' },    // teal not in Badge — use blue
  voice: { variant: 'purple', label: 'VOICE' },
  image: { variant: 'red',    label: 'IMAGE' },
  multi: { variant: 'amber',  label: 'MULTI' },
};

export default function ModelCard({
  model,
  hardwareTier = 1,
  isDownloaded = false,
  isDownloading = false,
  downloadProgress = null,
  onDownload,
  onUse,
  onUpdate,
  onClick,
}) {
  const category = CATEGORY_BADGES[model.category] || CATEGORY_BADGES.chat;
  const isCompatible = hardwareTier >= (model.minTier || 1);
  const speedEstimate = getSpeedEstimate(model, hardwareTier);

  return (
    <div
      onClick={() => onClick?.(model)}
      className={`relative rounded-xl border p-4 transition-all duration-150 cursor-pointer
        ${isCompatible
          ? 'dark:bg-[#1E293B] dark:border-[#334155] dark:hover:border-blue-600/40 dark:hover:bg-blue-600/[0.03] bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
          : 'dark:bg-[#1E293B]/70 dark:border-[#334155]/60 bg-slate-50 border-slate-200/60'
        }`}
    >
      {/* Incompatible overlay */}
      {!isCompatible && (
        <div className="absolute inset-0 rounded-xl backdrop-blur-[1px]
          dark:bg-slate-900/40 bg-white/50 z-10
          flex items-end justify-center pb-4">
          <span className="text-[11px] dark:text-slate-500 text-slate-400">
            Needs Tier {model.minTier}+ — {getTierUpgradeHint(model.minTier)}
          </span>
        </div>
      )}

      {/* Top row: category badge + update dot */}
      <div className="flex items-center justify-between mb-2.5">
        <Badge variant={category.variant}>{category.label}</Badge>
        <div className="flex items-center gap-1.5">
          {model.isCustom && (
            <Badge variant="amber">Custom</Badge>
          )}
          {model.hasUpdate && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] dark:text-amber-400 text-amber-600">Update</span>
            </span>
          )}
        </div>
      </div>

      {/* Name + creator */}
      <h3 className="text-[15px] font-semibold truncate
        dark:text-slate-100 text-slate-800">
        {model.name}
      </h3>
      {model.creator && (
        <p className="text-[11px] mt-0.5 dark:text-[#64748B] text-slate-400">
          {model.creator}
        </p>
      )}

      {/* Description */}
      {model.description && (
        <p className="text-xs mt-2 truncate
          dark:text-[#94A3B8] text-slate-500">
          {model.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge variant="grey">{model.sizeMB ? formatSize(model.sizeMB) : model.size || '?'}</Badge>
        <Badge variant="green">Tier {model.minTier || 1}+</Badge>
        {speedEstimate && (
          <span className="text-[11px] dark:text-amber-400/80 text-amber-600">
            ~{speedEstimate} tok/sec
          </span>
        )}
      </div>

      {/* Action area */}
      <div className="mt-4">
        {/* Download in progress */}
        {isDownloading && downloadProgress && (
          <DownloadProgressBar progress={downloadProgress} />
        )}

        {/* Download button */}
        {!isDownloaded && !isDownloading && isCompatible && (
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={(e) => { e.stopPropagation(); onDownload?.(model); }}
          >
            Download
          </Button>
        )}

        {/* Use + Update buttons (downloaded) */}
        {isDownloaded && !isDownloading && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={(e) => { e.stopPropagation(); onUse?.(model); }}
            >
              Use
            </Button>
            {model.hasUpdate && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onUpdate?.(model); }}
              >
                Update
              </Button>
            )}
          </div>
        )}

        {/* Not available */}
        {!isCompatible && (
          <Button variant="ghost" size="sm" className="w-full opacity-50 cursor-not-allowed" disabled>
            Not available for your PC
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Download progress bar
// ---------------------------------------------------------------------------
function DownloadProgressBar({ progress }) {
  return (
    <div className="space-y-1.5">
      <div className="h-2 rounded-full dark:bg-[#334155] bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${Math.min(100, progress.progress || 0)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]
        dark:text-slate-500 text-slate-400">
        <span>{progress.progress?.toFixed(0)}%</span>
        <span>{progress.speed || ''}{progress.eta ? ` · ${progress.eta}` : ''}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatSize(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function getSpeedEstimate(model, tier) {
  // Very rough estimates based on PRD hardware tiers
  const sizeGB = (model.sizeMB || 0) / 1024;
  if (sizeGB <= 2.5) {
    // 3B models
    return tier >= 3 ? '15-30' : tier >= 2 ? '5-10' : '2-4';
  }
  if (sizeGB <= 5.5) {
    // 7-8B models
    return tier >= 4 ? '20-40' : tier >= 3 ? '8-15' : tier >= 2 ? '3-6' : null;
  }
  return tier >= 4 ? '10-25' : tier >= 3 ? '4-8' : null;
}

function getTierUpgradeHint(minTier) {
  switch (minTier) {
    case 2: return '8 GB RAM needed';
    case 3: return '16 GB RAM or GPU needed';
    case 4: return '32 GB RAM or 8 GB GPU needed';
    default: return 'hardware upgrade needed';
  }
}
