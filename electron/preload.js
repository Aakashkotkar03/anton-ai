// electron/preload.js — contextBridge ONLY
// This is the FULL list of what the React renderer can call.
// If it is not exposed here, React cannot do it.
//
// 🔒 Security: contextIsolation is true. The renderer process has zero
//    access to Node.js, Electron internals, or the file system.
//    Every function here is a thin IPC wrapper — the main process
//    validates all arguments before acting on them.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('antonAPI', {
  // -----------------------------------------------------------------------
  // Auth (Phase 1)
  // -----------------------------------------------------------------------
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  checkAuth: () => ipcRenderer.invoke('auth:check'),

  // -----------------------------------------------------------------------
  // App Control — force update / maintenance (Phase 1)
  // -----------------------------------------------------------------------
  checkAppControl: () => ipcRenderer.invoke('appControl:check'),

  // -----------------------------------------------------------------------
  // Hardware detection (Phase 1)
  // -----------------------------------------------------------------------
  getHardware: () => ipcRenderer.invoke('hardware:getSpecs'),

  // -----------------------------------------------------------------------
  // Model catalogue (Phase 2)
  // -----------------------------------------------------------------------
  getCatalogue: () => ipcRenderer.invoke('catalogue:get'),

  // -----------------------------------------------------------------------
  // Model downloads (Phase 2)
  // -----------------------------------------------------------------------
  startDownload: (model) => ipcRenderer.invoke('download:start', model),

  pauseDownload: (modelId) => ipcRenderer.invoke('download:pause', modelId),

  cancelDownload: (modelId) => ipcRenderer.invoke('download:cancel', modelId),

  getDownloadStatus: () => ipcRenderer.invoke('download:status'),

  onDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => {
      ipcRenderer.removeListener('download:progress', handler);
    };
  },

  onDownloadComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:complete', handler);
    return () => {
      ipcRenderer.removeListener('download:complete', handler);
    };
  },

  onDownloadFailed: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:failed', handler);
    return () => {
      ipcRenderer.removeListener('download:failed', handler);
    };
  },

  // -----------------------------------------------------------------------
  // Chat / Inference (Phase 2)
  // -----------------------------------------------------------------------
  startModel: (params) => ipcRenderer.invoke('llama:start', params),

  stopModel: () => ipcRenderer.invoke('llama:stop'),

  startChat: (params) => ipcRenderer.invoke('llama:chat', params),

  getContextInfo: () => ipcRenderer.invoke('llama:getContextInfo'),

  getModelStatus: () => ipcRenderer.invoke('llama:getStatus'),

  // -----------------------------------------------------------------------
  // Context Management (Phase 2)
  // -----------------------------------------------------------------------
  getContextFill: (params) => ipcRenderer.invoke('context:getInfo', params),

  estimateTokens: (text) => ipcRenderer.invoke('context:estimateTokens', text),

  onToken: (callback) => {
    const handler = (_event, token) => callback(token);
    ipcRenderer.on('llama:token', handler);
    return () => {
      ipcRenderer.removeListener('llama:token', handler);
    };
  },

  onChatDone: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('llama:done', handler);
    return () => {
      ipcRenderer.removeListener('llama:done', handler);
    };
  },

  onLlamaError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('llama:error', handler);
    return () => {
      ipcRenderer.removeListener('llama:error', handler);
    };
  },

  // -----------------------------------------------------------------------
  // Theme — listen for OS theme changes (from main.js nativeTheme)
  // -----------------------------------------------------------------------
  onThemeChange: (callback) => {
    const handler = (_event, theme) => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => {
      ipcRenderer.removeListener('theme:changed', handler);
    };
  },

  // -----------------------------------------------------------------------
  // Shell — open external URLs (validated in main process)
  // -----------------------------------------------------------------------
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // -----------------------------------------------------------------------
  // Chat Panel controls (Phase 3)
  // -----------------------------------------------------------------------
  hidePanel: () => ipcRenderer.invoke('panel:hide'),
  togglePin: (pinned) => ipcRenderer.invoke('panel:togglePin', pinned),
  isPanelPinned: () => ipcRenderer.invoke('panel:isPinned'),
  getPanelPosition: () => ipcRenderer.invoke('panel:getPosition'),
  setPanelPosition: (pos) => ipcRenderer.invoke('panel:setPosition', pos),

  // -----------------------------------------------------------------------
  // Clipboard AI (Phase 3)
  // -----------------------------------------------------------------------
  clipboardAction: (action, text) => ipcRenderer.invoke('clipboard:action', { action, text }),

  clipboardUndo: (originalText) => ipcRenderer.invoke('clipboard:undo', originalText),

  onClipboardChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('clipboard:changed', handler);
    return () => ipcRenderer.removeListener('clipboard:changed', handler);
  },

  onClipboardProcessing: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('clipboard:processing', handler);
    return () => ipcRenderer.removeListener('clipboard:processing', handler);
  },

  onClipboardResult: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('clipboard:result', handler);
    return () => ipcRenderer.removeListener('clipboard:result', handler);
  },

  onClipboardError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('clipboard:error', handler);
    return () => ipcRenderer.removeListener('clipboard:error', handler);
  },

  onOpenWheel: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('clipboard:openWheel', handler);
    return () => ipcRenderer.removeListener('clipboard:openWheel', handler);
  },

  // -----------------------------------------------------------------------
  // Whisper / Voice (Phase 3)
  // -----------------------------------------------------------------------
  transcribeAudio: (buffer) => ipcRenderer.invoke('whisper:transcribe', buffer),

  getWhisperModels: () => ipcRenderer.invoke('whisper:getModels'),

  // Send recorded audio buffer back to main process
  sendRecordedAudio: (buffer) => ipcRenderer.invoke('audio:recorded', buffer),

  // Report audio capture error to main process
  reportAudioError: (msg) => ipcRenderer.invoke('audio:error', msg),

  // Listen for recording commands from main process (used by AudioCaptureWindow)
  onStartRecording: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('audio:startRecording', handler);
    return () => ipcRenderer.removeListener('audio:startRecording', handler);
  },

  onStopRecording: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('audio:stopRecording', handler);
    return () => ipcRenderer.removeListener('audio:stopRecording', handler);
  },

  // Listen for recording overlay events
  onRecordingStarted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('recording:started', handler);
    return () => ipcRenderer.removeListener('recording:started', handler);
  },

  onRecordingTranscribing: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('recording:transcribing', handler);
    return () => ipcRenderer.removeListener('recording:transcribing', handler);
  },

  // Listen for transcript result (broadcast to all windows)
  onVoiceTranscript: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('voice:transcript', handler);
    return () => ipcRenderer.removeListener('voice:transcript', handler);
  },

  onVoiceError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('voice:error', handler);
    return () => ipcRenderer.removeListener('voice:error', handler);
  },

  // -----------------------------------------------------------------------
  // Document Intelligence (Phase 4)
  // -----------------------------------------------------------------------
  parseDocument: (filePath, effectiveCtx) =>
    ipcRenderer.invoke('document:parse', { filePath, effectiveCtx }),

  getDocumentChunks: (query, index, maxChunks) =>
    ipcRenderer.invoke('document:getChunks', { query, index, maxChunks }),

  // -----------------------------------------------------------------------
  // WebSocket / Browser Extension (Phase 5)
  // -----------------------------------------------------------------------
  updateExtensionIds: (ids) => ipcRenderer.invoke('ws:updateExtensionIds', ids),

  getWsStatus: () => ipcRenderer.invoke('ws:getStatus'),

  // -----------------------------------------------------------------------
  // Onboarding (Phase 9)
  // -----------------------------------------------------------------------
  checkOnboarding: () => ipcRenderer.invoke('onboarding:check'),

  completeOnboarding: () => ipcRenderer.invoke('onboarding:complete'),

  // -----------------------------------------------------------------------
  // Shell Extension toast (Phase 6)
  // -----------------------------------------------------------------------
  onShellToast: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('shell:toast', handler);
    return () => ipcRenderer.removeListener('shell:toast', handler);
  },
});
