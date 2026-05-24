// src/screens/ModelLibrary.jsx — Model catalogue, downloads, management (PRD Feature 9)
// Design: UI/UX SCREEN 2A (ModelLibrary_Dark) + SCREEN 2B (ModelLibrary_Light)
//
// Sections:
//   1. My Models — horizontal row of downloaded models
//   2. Filter bar — category tabs + search + sort
//   3. Model grid — 3-column catalogue with hardware gating
//   4. Import button — opens CustomImportPanel
//
// Uses: useModelStore, useDownloadStore, useHardwareStore

import { useState, useEffect, useCallback, useRef } from 'react';
import useModelStore from '../stores/useModelStore';
import useDownloadStore from '../stores/useDownloadStore';
import useHardwareStore from '../stores/useHardwareStore';
import ModelCard from '../components/models/ModelCard';
import ModelDetailPanel from '../components/models/ModelDetailPanel';
import CustomImportPanel from '../components/models/CustomImportPanel';
import ModelUpdateModal from '../components/models/ModelUpdateModal';
import SpaceManager from '../components/models/SpaceManager';
import { Skeleton } from '../components/ui';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { id: 'all',   label: 'All' },
  { id: 'chat',  label: 'Chat' },
  { id: 'code',  label: 'Code' },
  { id: 'image', label: 'Image' },
  { id: 'voice', label: 'Voice' },
];

const SORT_OPTIONS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'size',        label: 'Size' },
  { id: 'name',        label: 'Name' },
];

// ---------------------------------------------------------------------------
// ModelLibrary
// ---------------------------------------------------------------------------
export default function ModelLibrary() {
  const { allModels, downloadedModels, isLoaded, setCatalogue, setDownloadedModels, addDownloadedModel } = useModelStore();
  const { activeDownloads, setDownloadProgress, removeDownload } = useDownloadStore();
  const hardwareTier = useHardwareStore((s) => s.tier) || 1;

  // UI state
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
  const [selectedModel, setSelectedModel] = useState(null);     // for detail panel
  const [showImport, setShowImport] = useState(false);
  const [showSpaceManager, setShowSpaceManager] = useState(false);
  const [updateModel, setUpdateModel] = useState(null);         // for update modal
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(!isLoaded);

  // IPC listener cleanup refs
  const cleanupProgressRef = useRef(null);
  const cleanupCompleteRef = useRef(null);
  const cleanupFailedRef = useRef(null);

  // --- Load catalogue on mount ---
  useEffect(() => {
    async function loadCatalogue() {
      if (isLoaded && allModels.length > 0) {
        setIsLoadingCatalogue(false);
        return;
      }
      try {
        const result = await window.antonAPI.getCatalogue();
        if (result?.models) {
          setCatalogue(result.models, result.source);
        }
      } catch (err) {
        console.error('[ModelLibrary] Failed to load catalogue:', err);
      } finally {
        setIsLoadingCatalogue(false);
      }
    }
    loadCatalogue();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Listen for download events ---
  useEffect(() => {
    cleanupProgressRef.current = window.antonAPI.onDownloadProgress((data) => {
      setDownloadProgress(data.modelId, {
        progress: data.progress,
        speed: data.speed,
        eta: data.eta,
        status: 'downloading',
      });
    });

    cleanupCompleteRef.current = window.antonAPI.onDownloadComplete((data) => {
      removeDownload(data.modelId);
      // Add to downloaded models
      const model = allModels.find((m) => m.id === data.modelId);
      if (model) {
        addDownloadedModel({ ...model, filePath: data.filePath });
      }
    });

    cleanupFailedRef.current = window.antonAPI.onDownloadFailed((data) => {
      setDownloadProgress(data.modelId, {
        status: 'failed',
        error: data.error,
      });
      // Auto-remove failed status after 5 seconds
      setTimeout(() => removeDownload(data.modelId), 5000);
    });

    return () => {
      if (cleanupProgressRef.current) cleanupProgressRef.current();
      if (cleanupCompleteRef.current) cleanupCompleteRef.current();
      if (cleanupFailedRef.current) cleanupFailedRef.current();
    };
  }, [allModels, setDownloadProgress, removeDownload, addDownloadedModel]);

  // --- Filter + sort models ---
  const filteredModels = getFilteredModels(allModels, activeCategory, searchQuery, sortBy);

  // --- Handlers ---
  const handleDownload = useCallback(async (model) => {
    try {
      setDownloadProgress(model.id, { progress: 0, speed: '', eta: '', status: 'downloading' });
      await window.antonAPI.startDownload(model);
    } catch (err) {
      console.error('[ModelLibrary] Download failed:', err);
      removeDownload(model.id);
    }
  }, [setDownloadProgress, removeDownload]);

  const handleUse = useCallback(async (model) => {
    try {
      await window.antonAPI.startModel({
        modelPath: model.filePath,
        category: model.category,
      });
    } catch (err) {
      console.error('[ModelLibrary] Failed to load model:', err);
    }
  }, []);

  const handleDelete = useCallback(async (model) => {
    try {
      // TODO: Wire IPC for model deletion — for now just remove from store
      useModelStore.getState().removeDownloadedModel(model.id);
    } catch (err) {
      console.error('[ModelLibrary] Delete failed:', err);
    }
  }, []);

  const handleImportStarted = useCallback((importData) => {
    setShowImport(false);
    // TODO: Wire to downloader IPC based on importData.type
    console.log('[ModelLibrary] Import started:', importData);
  }, []);

  // --- Render ---
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ================================================================ */}
      {/* MY MODELS section — downloaded models, horizontal scroll          */}
      {/* ================================================================ */}
      <div className="shrink-0 px-6 pt-5 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold dark:text-slate-100 text-slate-800">
              My Models
            </h2>
            <span className="text-xs dark:text-[#64748B] text-slate-400">
              {downloadedModels.length} downloaded
            </span>
          </div>
          <button
            onClick={() => setShowSpaceManager(true)}
            className="text-xs dark:text-blue-400 text-blue-600 hover:underline"
          >
            Manage Storage
          </button>
        </div>

        {/* Horizontal scroll of downloaded models */}
        {downloadedModels.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {downloadedModels.map((model) => (
              <div key={model.id} className="shrink-0 w-64">
                <ModelCard
                  model={model}
                  hardwareTier={hardwareTier}
                  isDownloaded
                  isDownloading={!!activeDownloads[model.id]}
                  downloadProgress={activeDownloads[model.id]}
                  onUse={handleUse}
                  onUpdate={() => setUpdateModel(model)}
                  onClick={setSelectedModel}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4 px-4 rounded-xl
            dark:bg-[#1E293B] bg-slate-50 border dark:border-[#334155] border-slate-200">
            <span className="text-2xl">⬇️</span>
            <div>
              <p className="text-xs font-medium dark:text-slate-300 text-slate-700">
                No models downloaded yet
              </p>
              <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-0.5">
                Browse the catalogue below and download a model to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* FILTER BAR                                                       */}
      {/* ================================================================ */}
      <div className="shrink-0 px-6 py-3
        border-t border-b dark:border-[#1E293B] border-slate-200">
        <div className="flex items-center gap-3">
          {/* Category tabs */}
          <div className="flex gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                  ${activeCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'dark:bg-[#334155] dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full px-3 py-1.5 rounded-lg text-xs
                dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
                dark:placeholder-[#475569]
                bg-white border border-slate-300 text-slate-800 placeholder-slate-400
                focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs
              dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-300
              bg-white border border-slate-300 text-slate-600
              focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODEL GRID — scrollable                                          */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Loading state */}
        {isLoadingCatalogue && (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="card" className="h-52" />
            ))}
          </div>
        )}

        {/* Empty search result */}
        {!isLoadingCatalogue && filteredModels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-2xl mb-3">🔍</span>
            <p className="text-sm dark:text-slate-400 text-slate-500">
              No models found for "{searchQuery || activeCategory}"
            </p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="mt-2 text-xs dark:text-blue-400 text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Model grid */}
        {!isLoadingCatalogue && filteredModels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredModels.map((model) => {
              const isDownloaded = downloadedModels.some((d) => d.id === model.id);
              const dlState = activeDownloads[model.id];
              const isDownloading = dlState && (dlState.status === 'downloading' || dlState.status === 'verifying');

              return (
                <ModelCard
                  key={model.id}
                  model={model}
                  hardwareTier={hardwareTier}
                  isDownloaded={isDownloaded}
                  isDownloading={isDownloading}
                  downloadProgress={dlState}
                  onDownload={handleDownload}
                  onUse={handleUse}
                  onUpdate={() => setUpdateModel(model)}
                  onClick={setSelectedModel}
                />
              );
            })}
          </div>
        )}

        {/* Import button */}
        {!isLoadingCatalogue && (
          <button
            onClick={() => setShowImport(true)}
            className="mt-6 mb-4 w-full flex items-center justify-center gap-2 py-4
              rounded-xl border-2 border-dashed transition-colors
              dark:border-[#334155] dark:text-[#64748B] dark:hover:border-blue-600/40 dark:hover:text-blue-400
              border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600"
          >
            <span className="text-lg">+</span>
            <span className="text-xs font-medium">Import Custom Model</span>
          </button>
        )}
      </div>

      {/* ================================================================ */}
      {/* Overlays: Detail panel, Import modal, Update modal, Space mgr    */}
      {/* ================================================================ */}
      {selectedModel && (
        <ModelDetailPanel
          model={selectedModel}
          onClose={() => setSelectedModel(null)}
          onDelete={handleDelete}
        />
      )}

      {showImport && (
        <CustomImportPanel
          onClose={() => setShowImport(false)}
          onImportStarted={handleImportStarted}
        />
      )}

      {updateModel && (
        <ModelUpdateModal
          model={updateModel}
          onUpdate={(m) => { handleDownload(m); setUpdateModel(null); }}
          onDismiss={() => setUpdateModel(null)}
        />
      )}

      {showSpaceManager && (
        <SpaceManager
          downloadedModels={downloadedModels}
          onDelete={handleDelete}
          onClose={() => setShowSpaceManager(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter + sort helper
// ---------------------------------------------------------------------------
function getFilteredModels(allModels, category, query, sortBy) {
  let filtered = [...allModels];

  // Category filter
  if (category !== 'all') {
    filtered = filtered.filter((m) => m.category === category);
  }

  // Search filter
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter((m) =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.creator || '').toLowerCase().includes(q)
    );
  }

  // Sort
  switch (sortBy) {
    case 'size':
      filtered.sort((a, b) => (a.sizeMB || 0) - (b.sizeMB || 0));
      break;
    case 'name':
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'recommended':
    default:
      // Recommended: compatible first, then by minTier ascending (simpler models first)
      filtered.sort((a, b) => (a.minTier || 1) - (b.minTier || 1));
      break;
  }

  return filtered;
}
