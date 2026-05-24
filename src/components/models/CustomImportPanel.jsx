// src/components/models/CustomImportPanel.jsx — Import custom GGUF models
// 3 tabs: HuggingFace URL | HuggingFace Model ID | Local File
// PRD Feature 9 — Custom Model Import

import { useState, useCallback } from 'react';
import { Button, Badge } from '../ui';

const TABS = [
  { id: 'url', label: 'HuggingFace URL' },
  { id: 'model-id', label: 'Model ID' },
  { id: 'local', label: 'Local File' },
];

export default function CustomImportPanel({ onClose, onImportStarted }) {
  const [activeTab, setActiveTab] = useState('url');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Show disclaimer on first use
  if (!disclaimerAccepted) {
    return (
      <PanelWrapper onClose={onClose}>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold dark:text-slate-100 text-slate-800">
            Import Custom Model
          </h3>
          <div className="rounded-lg p-4 text-xs leading-relaxed space-y-2
            dark:bg-amber-900/15 dark:border dark:border-amber-800/30 dark:text-amber-300
            bg-amber-50 border border-amber-200 text-amber-800">
            <p className="font-medium">Before importing:</p>
            <p>• Only GGUF format models are supported (first 4 bytes must be "GGUF").</p>
            <p>• Large models may exceed your available RAM and cause slow performance or crashes.</p>
            <p>• Custom models are not verified by Anton AI — download only from trusted sources.</p>
            <p>• Anton AI is not responsible for the output of third-party models.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={() => setDisclaimerAccepted(true)}>
              I Understand — Continue
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper onClose={onClose}>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'dark:bg-[#334155] dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'url' && <TabURL onImportStarted={onImportStarted} />}
      {activeTab === 'model-id' && <TabModelID onImportStarted={onImportStarted} />}
      {activeTab === 'local' && <TabLocal onImportStarted={onImportStarted} />}
    </PanelWrapper>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: HuggingFace URL
// ---------------------------------------------------------------------------
function TabURL({ onImportStarted }) {
  const [url, setUrl] = useState('');
  const [fileInfo, setFileInfo] = useState(null); // { size, filename }
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const checkUrl = useCallback(async () => {
    if (!url.trim() || !url.endsWith('.gguf')) {
      setError('URL must point to a .gguf file.');
      return;
    }
    setChecking(true);
    setError('');
    try {
      // We'd call a HEAD request via IPC — for now show the URL is accepted
      const filename = url.split('/').pop();
      setFileInfo({ filename, size: 'Checking...' });
      // In production: await window.antonAPI.checkModelUrl(url)
      setFileInfo({ filename, size: 'Size will be shown after download starts' });
    } catch (err) {
      setError(err.message || 'Failed to check URL.');
    } finally {
      setChecking(false);
    }
  }, [url]);

  return (
    <div className="space-y-3">
      <label className="block text-xs dark:text-slate-400 text-slate-500">
        Paste a direct link to a .gguf file from HuggingFace
      </label>
      <input
        type="url"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setFileInfo(null); setError(''); }}
        placeholder="https://huggingface.co/.../model.gguf"
        className="w-full px-3 py-2 rounded-lg text-xs
          dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200 dark:placeholder-[#475569]
          bg-white border border-slate-300 text-slate-800 placeholder-slate-400
          focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {fileInfo && (
        <div className="rounded-lg p-3 dark:bg-[#1E293B] bg-slate-50 border dark:border-[#334155] border-slate-200">
          <p className="text-xs dark:text-slate-200 text-slate-700 font-medium truncate">{fileInfo.filename}</p>
          <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-0.5">{fileInfo.size}</p>
        </div>
      )}

      <div className="flex gap-2">
        {!fileInfo ? (
          <Button variant="secondary" size="sm" className="flex-1" onClick={checkUrl} loading={checking}>
            Check URL
          </Button>
        ) : (
          <Button variant="primary" size="sm" className="flex-1"
            onClick={() => onImportStarted?.({ type: 'url', url })}>
            Start Download
          </Button>
        )}
      </div>

      <RamWarning />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: HuggingFace Model ID
// ---------------------------------------------------------------------------
function TabModelID({ onImportStarted }) {
  const [modelId, setModelId] = useState('');
  const [files, setFiles] = useState(null); // [{ name, size }]
  const [selectedFile, setSelectedFile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchFiles = useCallback(async () => {
    if (!modelId.trim() || !modelId.includes('/')) {
      setError('Enter a model ID like "bartowski/Llama-3.2-3B-GGUF"');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // In production: const result = await window.antonAPI.fetchHFModelFiles(modelId)
      // For now, show placeholder
      setFiles([
        { name: `${modelId.split('/').pop()}-Q4_K_M.gguf`, size: '~4 GB' },
        { name: `${modelId.split('/').pop()}-Q5_K_M.gguf`, size: '~5 GB' },
        { name: `${modelId.split('/').pop()}-Q8_0.gguf`, size: '~8 GB' },
      ]);
    } catch (err) {
      setError(err.message || 'Failed to fetch model files.');
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  return (
    <div className="space-y-3">
      <label className="block text-xs dark:text-slate-400 text-slate-500">
        Enter a HuggingFace model ID
      </label>
      <input
        type="text"
        value={modelId}
        onChange={(e) => { setModelId(e.target.value); setFiles(null); setError(''); }}
        placeholder="bartowski/Llama-3.2-3B-GGUF"
        className="w-full px-3 py-2 rounded-lg text-xs
          dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200 dark:placeholder-[#475569]
          bg-white border border-slate-300 text-slate-800 placeholder-slate-400
          focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {!files && (
        <Button variant="secondary" size="sm" className="w-full" onClick={fetchFiles} loading={loading}>
          Fetch Available Files
        </Button>
      )}

      {/* File selection */}
      {files && (
        <div className="space-y-1.5">
          <p className="text-[11px] dark:text-slate-500 text-slate-400">Select quantisation:</p>
          {files.map((f) => (
            <button
              key={f.name}
              onClick={() => setSelectedFile(f.name)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors
                ${selectedFile === f.name
                  ? 'dark:bg-blue-600/10 dark:border-blue-600/40 dark:text-blue-300 bg-blue-50 border-blue-300 text-blue-700'
                  : 'dark:bg-[#1E293B] dark:border-[#334155] dark:text-slate-300 bg-white border-slate-200 text-slate-600 hover:dark:border-slate-500 hover:border-slate-300'
                }`}
            >
              <span className="truncate">{f.name}</span>
              <Badge variant="grey">{f.size}</Badge>
            </button>
          ))}
          <Button
            variant="primary"
            size="sm"
            className="w-full mt-2"
            disabled={!selectedFile}
            onClick={() => onImportStarted?.({ type: 'model-id', modelId, file: selectedFile })}
          >
            Download Selected
          </Button>
        </div>
      )}

      <RamWarning />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Local File
// ---------------------------------------------------------------------------
function TabLocal({ onImportStarted }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');

  const handleBrowse = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gguf';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith('.gguf')) {
        setError('Only .gguf files are supported.');
        return;
      }
      setError('');
      setSelectedFile({
        name: file.name,
        path: file.path, // Electron provides full filesystem path
        sizeMB: Math.round(file.size / (1024 * 1024)),
      });
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs dark:text-slate-400 text-slate-500">
        Select a .gguf model file from your computer
      </label>

      <button
        onClick={handleBrowse}
        className="w-full flex items-center justify-center gap-2 px-4 py-6
          rounded-xl border-2 border-dashed transition-colors
          dark:border-[#334155] dark:text-slate-400 dark:hover:border-blue-600/40 dark:hover:text-blue-400
          border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600"
      >
        <span className="text-lg">📁</span>
        <span className="text-xs font-medium">Browse for .gguf file</span>
      </button>

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {selectedFile && (
        <div className="rounded-lg p-3 dark:bg-[#1E293B] bg-slate-50 border dark:border-[#334155] border-slate-200">
          <p className="text-xs dark:text-slate-200 text-slate-700 font-medium truncate">{selectedFile.name}</p>
          <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-0.5">
            {selectedFile.sizeMB >= 1024
              ? `${(selectedFile.sizeMB / 1024).toFixed(1)} GB`
              : `${selectedFile.sizeMB} MB`}
          </p>
          <Button
            variant="primary"
            size="sm"
            className="w-full mt-3"
            onClick={() => onImportStarted?.({ type: 'local', path: selectedFile.path, name: selectedFile.name })}
          >
            Import Model
          </Button>
        </div>
      )}

      <RamWarning />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------
function PanelWrapper({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
      dark:bg-black/50 bg-black/20">
      <div className="w-full max-w-md mx-4 rounded-2xl p-6
        dark:bg-[#0F172A] dark:border dark:border-[#1E293B]
        bg-white border border-slate-200
        shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-800">
            Import Custom Model
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded dark:text-slate-500 dark:hover:text-slate-300
              text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RamWarning() {
  return (
    <div className="rounded-lg p-2.5 text-[11px] leading-relaxed
      dark:bg-amber-900/10 dark:text-amber-400/70
      bg-amber-50 text-amber-700">
      ⚠️ Large models may exceed your available RAM. Check Settings → Hardware for your tier before downloading.
    </div>
  );
}
