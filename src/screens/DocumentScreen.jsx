// src/screens/DocumentScreen.jsx — Document Intelligence screen (PRD Feature 3)
// Two-pane layout: left (DocumentViewer), right (DocumentChat).
// Empty state: drag-and-drop zone with file browser fallback.
// Design: PRD Feature 3 + UI/UX SCREEN 3A/3B (DocumentScreen).

import { useState, useCallback, useEffect } from 'react';
import useDocumentStore from '../stores/useDocumentStore';
import useHardwareStore from '../stores/useHardwareStore';
import DocumentViewer from '../components/documents/DocumentViewer';
import DocumentChat from '../components/documents/DocumentChat';
import ChunkWarning from '../components/documents/ChunkWarning';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv'];

export default function DocumentScreen() {
  const {
    file, strategy, content, chunkIndex, fullTokens, docBudget,
    isLoading, error, setDocument, setLoading, setError, clearDocument,
  } = useDocumentStore();

  const hardware = useHardwareStore((s) => s.specs);
  const [isDragOver, setIsDragOver] = useState(false);

  // Calculate effective context from hardware store (or fallback)
  const getEffectiveCtx = useCallback(async () => {
    try {
      const info = await window.antonAPI.getContextInfo();
      return info?.effective || 4096;
    } catch {
      return 4096;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Load document from file path
  // -------------------------------------------------------------------------
  const loadDocument = useCallback(async (filePath) => {
    setLoading(true);
    setError(null);

    try {
      const ext = filePath.split('.').pop().toLowerCase();
      const fileName = filePath.split(/[/\\]/).pop();
      const effectiveCtx = await getEffectiveCtx();

      const result = await window.antonAPI.parseDocument(filePath, effectiveCtx);

      if (result.error === 'SCANNED_PDF') {
        setError('This PDF contains scanned images. Text extraction requires OCR, which is not available in v1.0.');
        setLoading(false);
        return;
      }

      if (result.error === 'EMPTY_DOCUMENT') {
        setError('No text content found in this document.');
        setLoading(false);
        return;
      }

      setDocument(result, {
        name: fileName,
        path: filePath,
        ext: `.${ext}`,
        sizeMB: 0, // we don't have the size from IPC, non-critical
      });
    } catch (err) {
      setError(err.message || 'Failed to parse document.');
      setLoading(false);
    }
  }, [setDocument, setLoading, setError, getEffectiveCtx]);

  // -------------------------------------------------------------------------
  // Listen for document:open IPC from main process (File Explorer integration)
  // -------------------------------------------------------------------------
  useEffect(() => {
    // If main process sends a file path (e.g. from File Explorer right-click)
    // we'll need an onDocumentOpen listener. For now this is a placeholder.
    // TODO: Wire ipcRenderer.on('document:open') in preload.js when
    // File Explorer integration is built in Phase 6.
  }, []);

  // -------------------------------------------------------------------------
  // Drag and drop
  // -------------------------------------------------------------------------
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Use .pdf, .docx, .txt, .md, or .csv.`);
      return;
    }

    // In Electron, dropped files have a .path property with the full filesystem path
    if (file.path) {
      await loadDocument(file.path);
    } else {
      setError('Could not read file path. Try using the file browser instead.');
    }
  }, [loadDocument, setError]);

  // -------------------------------------------------------------------------
  // File browser (click to browse)
  // -------------------------------------------------------------------------
  const handleBrowse = useCallback(() => {
    // Create a hidden file input to trigger the browser's file dialog
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_EXTENSIONS.join(',');
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.path) {
        await loadDocument(file.path);
      }
    };
    input.click();
  }, [loadDocument]);

  // -------------------------------------------------------------------------
  // Render: Empty state
  // -------------------------------------------------------------------------
  if (!file && !isLoading) {
    return (
      <div
        className="flex items-center justify-center h-full p-8"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`flex flex-col items-center justify-center w-full max-w-lg py-20
            rounded-2xl border-2 border-dashed transition-colors cursor-pointer
            ${isDragOver
              ? 'dark:border-blue-500 dark:bg-blue-900/10 border-blue-400 bg-blue-50'
              : 'dark:border-slate-600 dark:hover:border-slate-500 border-slate-300 hover:border-slate-400'
            }`}
          onClick={handleBrowse}
        >
          {/* Icon */}
          <span className="text-4xl mb-4 dark:text-slate-500 text-slate-300">📄</span>

          {/* Heading */}
          <p className="text-base font-medium dark:text-slate-300 text-slate-700">
            Drop a PDF, Word, or text file here
          </p>

          {/* Subtext */}
          <p className="mt-1.5 text-sm dark:text-blue-400 text-blue-600 hover:underline">
            or click to browse
          </p>

          {/* Accepted formats */}
          <p className="mt-4 text-xs dark:text-slate-600 text-slate-400">
            Supports: .pdf, .docx, .txt, .md, .csv
          </p>

          {/* Error message */}
          {error && (
            <div className="mt-4 px-4 py-2 rounded-lg text-xs
              dark:bg-red-900/20 dark:text-red-400
              bg-red-50 text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Loading skeleton
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm dark:text-slate-400 text-slate-500">
            Parsing document...
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Error after loading (scanned PDF, etc.)
  // -------------------------------------------------------------------------
  if (error && !file) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="px-6 py-4 rounded-xl text-sm
          dark:bg-red-900/20 dark:text-red-400
          bg-red-50 text-red-600">
          {error}
        </div>
        <button
          onClick={() => { clearDocument(); }}
          className="text-xs dark:text-blue-400 text-blue-600 hover:underline"
        >
          ← Try another file
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Loaded document — two-panel layout
  // -------------------------------------------------------------------------
  return (
    <div
      className="flex h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Left panel — 55% — Document Viewer */}
      <div className="flex flex-col w-[55%] h-full
        border-r dark:border-[#334155] border-slate-200">
        {/* Chunk warning (shown above viewer when strategy=chunked) */}
        {strategy === 'chunked' && (
          <ChunkWarning
            fullTokens={fullTokens}
            docBudget={docBudget}
            fileName={file?.name}
          />
        )}

        <DocumentViewer
          content={content}
          fileName={file?.name}
          fullTokens={fullTokens}
          strategy={strategy}
          ext={file?.ext}
        />
      </div>

      {/* Right panel — 45% — AI Analysis + Q&A */}
      <div className="flex flex-col w-[45%] h-full">
        <DocumentChat fileName={file?.name} />
      </div>
    </div>
  );
}
