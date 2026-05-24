// electron/main.js — Anton AI main process entry point
// Creates the main window, system tray, IPC channels, and app lifecycle.

const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Tray,
  Menu,
  nativeTheme,
  shell,
  globalShortcut,
  screen,
} = require('electron');
const path = require('path');
const { signInWithGoogle, checkAuth, signOut } = require('./handlers/auth');
const { checkAppControl } = require('./handlers/appControl');
const { detectHardware } = require('./handlers/hardware');
const { fetchCatalogue, filterForHardware } = require('./handlers/catalogue');
const { initDownloader, startDownload, pauseDownload, cancelDownload, getDownloadStatus } = require('./handlers/downloader');
const { initLlama, start: startLlama, chat: llamaChat, stop: stopLlama, kill: killLlama, getContextInfo, getStatus: getLlamaStatus } = require('./handlers/llama');
const { estimateTokens, getContextFill } = require('./handlers/contextManager');
const { getDb, closeDb } = require('./db');
const { startMonitoring: startClipboardMonitoring, stopMonitoring: stopClipboardMonitoring, handleClipboardAction, undoClipboard } = require('./handlers/clipboard');
const { whisperEngine } = require('./handlers/whisper');
const { processDocument, getRelevantChunks } = require('./handlers/documentParser');
const { wsServer } = require('./handlers/websocketServer');
const { pipeServer } = require('./handlers/namedPipeServer');

// ---------------------------------------------------------------------------
// Single-instance lock — quit immediately if another instance is running
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  // 🔒 process.exit ensures no further code runs in the duplicate instance
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
let mainWindow = null;
let chatPanel = null;
let chatPanelPinned = false;
let indicatorWin = null;
let indicatorHideTimeout = null;
let audioWin = null;
let recordingOverlay = null;
let isRecording = false;
let recordingTimeout = null;
let recordingStartTime = null;
const MAX_RECORD_SECONDS = 60;
let tray = null;
const isDev = !app.isPackaged;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: 'Anton AI',
    show: false, // show after ready-to-show to avoid flash
    // 🔒 Security: all three flags are mandatory
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,        // 🔒 renderer cannot require('fs') etc.
      contextIsolation: true,        // 🔒 renderer cannot access Electron internals
      webSecurity: true,             // 🔒 enforce same-origin policy
      sandbox: true,                 // 🔒 additional process-level sandbox
      allowRunningInsecureContent: false, // 🔒 block mixed content
      navigateOnDragDrop: false,     // 🔒 prevent file drag opening a URL
    },
  });

  // Show window once DOM is painted — avoids white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Initialise downloader with mainWindow ref for progress events
  initDownloader(mainWindow);

  // Initialise llama engine with mainWindow ref for token events
  initLlama(mainWindow);

  // Load the renderer
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Hide instead of close — keep running in system tray
  mainWindow.on('close', (event) => {
    // On macOS quit means quit; on Windows/Linux hide to tray
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Emit theme changes to renderer when OS preference switches
  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme:changed', theme);
    }
    if (chatPanel && !chatPanel.isDestroyed()) {
      chatPanel.webContents.send('theme:changed', theme);
    }
  });

  // 🔒 Block navigation away from our app (prevents open-redirect attacks)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appOrigin = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
      console.warn(`[security] Blocked navigation to: ${url}`);
    }
  });

  // 🔒 Block new-window creation (no window.open, no target="_blank")
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------------------
// Floating Chat Panel — frameless always-on-top window (PRD Feature 1)
// ---------------------------------------------------------------------------
function createChatPanel() {
  if (chatPanel && !chatPanel.isDestroyed()) {
    return; // already exists
  }

  // Restore saved position or default to right-centre of primary display
  const savedPos = getSavedPanelPosition();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const panelW = 480;
  const panelH = 700;
  const x = savedPos ? savedPos.x : screenW - panelW - 24;
  const y = savedPos ? savedPos.y : Math.round((screenH - panelH) / 2);

  chatPanel = new BrowserWindow({
    width: panelW,
    height: panelH,
    x,
    y,
    frame: false,           // frameless — custom title bar in React
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,       // does not appear in Windows taskbar
    resizable: true,
    minWidth: 420,
    minHeight: 500,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'Anton AI',
    // 🔒 Same security as main window
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  // Load the same React app at the #/panel hash route
  if (isDev) {
    chatPanel.loadURL('http://localhost:5173/#/panel');
  } else {
    chatPanel.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
      { hash: '/panel' }
    );
  }

  // 🔒 Block navigation + new windows (same rules as main)
  chatPanel.webContents.on('will-navigate', (event, url) => {
    const appOrigin = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
    }
  });
  chatPanel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Hide on blur (unless pinned)
  chatPanel.on('blur', () => {
    if (!chatPanelPinned && chatPanel && !chatPanel.isDestroyed()) {
      chatPanel.hide();
    }
  });

  // Save position when moved or resized
  chatPanel.on('moved', () => savePanelPosition());
  chatPanel.on('resized', () => savePanelPosition());

  // Clean up ref on close
  chatPanel.on('closed', () => {
    chatPanel = null;
  });
}

function toggleChatPanel() {
  if (!chatPanel || chatPanel.isDestroyed()) {
    createChatPanel();
    chatPanel.once('ready-to-show', () => {
      chatPanel.show();
      chatPanel.focus();
    });
    return;
  }

  if (chatPanel.isVisible()) {
    chatPanel.hide();
  } else {
    chatPanel.show();
    chatPanel.focus();
  }
}

// ---------------------------------------------------------------------------
// Global Shortcuts (PRD Feature 8)
// ---------------------------------------------------------------------------
function registerGlobalShortcuts() {
  // Alt+Space — toggle floating chat panel
  const registered = globalShortcut.register('Alt+Space', () => {
    toggleChatPanel();
  });

  if (!registered) {
    console.warn('[shortcuts] Failed to register Alt+Space — another app may have claimed it.');
  } else {
    console.log('[shortcuts] Alt+Space registered for chat panel.');
  }

  // Future shortcuts:
  // Ctrl+Shift+M — Model Library

  // Ctrl+Shift+L — Clipboard AI action wheel
  const clipRegistered = globalShortcut.register('Ctrl+Shift+L', () => {
    showClipboardWheel();
  });
  if (!clipRegistered) {
    console.warn('[shortcuts] Failed to register Ctrl+Shift+L.');
  } else {
    console.log('[shortcuts] Ctrl+Shift+L registered for clipboard wheel.');
  }

  // Win+Alt+V — Voice recording toggle
  // On Windows: Super+Alt+V. On macOS: Cmd+Alt+V (dev only).
  const voiceKey = process.platform === 'darwin' ? 'Command+Alt+V' : 'Super+Alt+V';
  const voiceRegistered = globalShortcut.register(voiceKey, () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });
  if (!voiceRegistered) {
    console.warn(`[shortcuts] Failed to register ${voiceKey} for voice.`);
  } else {
    console.log(`[shortcuts] ${voiceKey} registered for voice recording.`);
  }
}

// ---------------------------------------------------------------------------
// Panel position persistence (SQLite settings table)
// ---------------------------------------------------------------------------
function getSavedPanelPosition() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'chatPanelPosition'").get();
    if (row && row.value) {
      const pos = JSON.parse(row.value);
      // 🔒 Validate the position is on a visible display
      if (typeof pos.x === 'number' && typeof pos.y === 'number') {
        const displays = screen.getAllDisplays();
        const isVisible = displays.some((d) => {
          const b = d.bounds;
          return pos.x >= b.x && pos.x < b.x + b.width &&
                 pos.y >= b.y && pos.y < b.y + b.height;
        });
        if (isVisible) return pos;
      }
    }
  } catch (_err) {
    // DB may not be ready yet on first launch
  }
  return null; // use default position
}

function savePanelPosition() {
  if (!chatPanel || chatPanel.isDestroyed()) return;
  try {
    const [x, y] = chatPanel.getPosition();
    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('chatPanelPosition', ?)"
    ).run(JSON.stringify({ x, y }));
  } catch (_err) {
    // Non-critical — position just won’t be remembered
  }
}

// ---------------------------------------------------------------------------
// Clipboard Indicator Overlay (PRD Feature 4 — tiny always-on-top window)
// ---------------------------------------------------------------------------
function createClipboardIndicator() {
  if (indicatorWin && !indicatorWin.isDestroyed()) return;

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  indicatorWin = new BrowserWindow({
    width: 220,
    height: 56,
    x: screenW - 236,
    y: screenH - 72,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focusable: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'Anton AI Clipboard',
    // 🔒 Same security as all other windows
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  if (isDev) {
    indicatorWin.loadURL('http://localhost:5173/#/clipboard-indicator');
  } else {
    indicatorWin.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
      { hash: '/clipboard-indicator' }
    );
  }

  // 🔒 Block navigation + new windows
  indicatorWin.webContents.on('will-navigate', (event, url) => {
    const appOrigin = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(appOrigin)) event.preventDefault();
  });
  indicatorWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  indicatorWin.on('closed', () => {
    indicatorWin = null;
  });
}

function showIndicator() {
  if (!indicatorWin || indicatorWin.isDestroyed()) {
    createClipboardIndicator();
    indicatorWin.once('ready-to-show', () => indicatorWin.showInactive());
  } else {
    indicatorWin.showInactive(); // showInactive — don’t steal focus from user’s app
  }

  // Auto-hide after 8 seconds
  if (indicatorHideTimeout) clearTimeout(indicatorHideTimeout);
  indicatorHideTimeout = setTimeout(() => {
    if (indicatorWin && !indicatorWin.isDestroyed()) {
      indicatorWin.hide();
    }
  }, 8000);
}

function showClipboardWheel() {
  if (!indicatorWin || indicatorWin.isDestroyed()) {
    createClipboardIndicator();
    indicatorWin.once('ready-to-show', () => {
      indicatorWin.showInactive();
      indicatorWin.webContents.send('clipboard:openWheel');
    });
  } else {
    indicatorWin.showInactive();
    indicatorWin.webContents.send('clipboard:openWheel');
  }
  // Cancel auto-hide when wheel is open — user is interacting
  if (indicatorHideTimeout) {
    clearTimeout(indicatorHideTimeout);
    indicatorHideTimeout = null;
  }
}

// ---------------------------------------------------------------------------
// Voice Recording — Audio Capture + Recording Overlay (PRD Feature 5)
// ---------------------------------------------------------------------------

/**
 * Hidden 1×1 window that captures microphone audio via browser MediaRecorder API.
 * We need a BrowserWindow because Electron’s main process has no MediaRecorder.
 * The window is invisible — no UI. It just captures and sends the buffer back.
 */
function createAudioCaptureWindow() {
  if (audioWin && !audioWin.isDestroyed()) return;

  audioWin = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    frame: false,
    resizable: false,
    // 🔒 Same security as all other windows
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  if (isDev) {
    audioWin.loadURL('http://localhost:5173/#/audio-capture');
  } else {
    audioWin.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
      { hash: '/audio-capture' }
    );
  }

  // 🔒 Block navigation + new windows
  audioWin.webContents.on('will-navigate', (event, url) => {
    const appOrigin = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(appOrigin)) event.preventDefault();
  });
  audioWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  audioWin.on('closed', () => {
    audioWin = null;
  });
}

/**
 * Small always-on-top overlay showing recording state:
 * pulsing red dot, timer, "Release Win+Alt+V to stop".
 * Positioned at bottom-centre of primary display.
 */
function createRecordingOverlay() {
  if (recordingOverlay && !recordingOverlay.isDestroyed()) return;

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const overlayW = 280;
  const overlayH = 60;

  recordingOverlay = new BrowserWindow({
    width: overlayW,
    height: overlayH,
    x: Math.round((screenW - overlayW) / 2),
    y: screenH - overlayH - 24,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focusable: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'Anton AI Recording',
    // 🔒 Same security
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  if (isDev) {
    recordingOverlay.loadURL('http://localhost:5173/#/recording-overlay');
  } else {
    recordingOverlay.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
      { hash: '/recording-overlay' }
    );
  }

  // 🔒 Block navigation + new windows
  recordingOverlay.webContents.on('will-navigate', (event, url) => {
    const appOrigin = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(appOrigin)) event.preventDefault();
  });
  recordingOverlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  recordingOverlay.on('closed', () => {
    recordingOverlay = null;
  });
}

function startRecording() {
  if (isRecording) return; // already recording
  isRecording = true;
  recordingStartTime = Date.now();

  // Ensure audio capture window exists
  if (!audioWin || audioWin.isDestroyed()) {
    createAudioCaptureWindow();
    audioWin.once('ready-to-show', () => {
      audioWin.webContents.send('audio:startRecording');
    });
  } else {
    audioWin.webContents.send('audio:startRecording');
  }

  // Show recording overlay
  if (!recordingOverlay || recordingOverlay.isDestroyed()) {
    createRecordingOverlay();
    recordingOverlay.once('ready-to-show', () => {
      recordingOverlay.showInactive();
      recordingOverlay.webContents.send('recording:started', { startTime: recordingStartTime });
    });
  } else {
    recordingOverlay.showInactive();
    recordingOverlay.webContents.send('recording:started', { startTime: recordingStartTime });
  }

  // Safety auto-stop after MAX_RECORD_SECONDS
  recordingTimeout = setTimeout(() => {
    console.log(`[voice] Auto-stopping after ${MAX_RECORD_SECONDS}s.`);
    stopRecording();
  }, MAX_RECORD_SECONDS * 1000);

  console.log('[voice] Recording started.');
}

async function stopRecording() {
  if (!isRecording) return; // not recording
  isRecording = false;

  // Clear auto-stop timer
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }

  // Tell audio capture window to stop recording and send the buffer
  if (audioWin && !audioWin.isDestroyed()) {
    audioWin.webContents.send('audio:stopRecording');
  }

  // Update overlay to show "Transcribing..." state
  if (recordingOverlay && !recordingOverlay.isDestroyed()) {
    recordingOverlay.webContents.send('recording:transcribing');
  }

  console.log('[voice] Recording stopped, waiting for audio buffer...');
  // The audio buffer will arrive via IPC 'audio:recorded' from AudioCaptureWindow
  // Transcription + overlay dismiss happens in the IPC handler below
}

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // 🔒 CSP: only allow scripts and styles from the app itself
        'Content-Security-Policy': [
          "default-src 'self';" +
          " script-src 'self';" +
          " style-src 'self' 'unsafe-inline';" +
          " img-src 'self' data:;" +
          " font-src 'self';" +
          " connect-src 'self' http://127.0.0.1:* https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;" +
          " object-src 'none';" +
          " base-uri 'self';" +
          " form-action 'none';",
        ],
      },
    });
  });
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------
function createTray() {
  // Tray icon path — use a placeholder path; actual icon added in Phase 9
  const iconPath = path.join(__dirname, '..', 'build', 'tray-icon.png');

  // Tray creation can fail if the icon file doesn't exist yet during early dev
  try {
    tray = new Tray(iconPath);
  } catch (_err) {
    console.warn('[tray] Icon not found — tray creation skipped in dev.');
    return;
  }

  tray.setToolTip('Anton AI');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Anton AI',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Left-click toggles window visibility
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// IPC channel registration — placeholder handlers
// Filled in as real handlers are built in later phases.
// ---------------------------------------------------------------------------
function registerIPC() {
  // --- Auth (Phase 1) ---
  ipcMain.handle('auth:signIn', async () => {
    return await signInWithGoogle();
  });

  ipcMain.handle('auth:signOut', async () => {
    return await signOut();
  });

  ipcMain.handle('auth:check', async () => {
    return await checkAuth();
  });

  // --- App Control (Phase 1) ---
  ipcMain.handle('appControl:check', async () => {
    const { db } = require('./config/firebase');
    return await checkAppControl(db);
  });

  // --- Hardware (Phase 1) ---
  ipcMain.handle('hardware:getSpecs', async () => {
    return await detectHardware();
  });

  // --- Catalogue (Phase 2) ---
  ipcMain.handle('catalogue:get', async () => {
    const catalogue = await fetchCatalogue();
    const hardware = await detectHardware();
    return filterForHardware(catalogue, hardware.tier, hardware.imageTier);
  });

  // --- Downloads (Phase 2) ---
  ipcMain.handle('download:start', async (_event, model) => {
    // 🔒 Validate model is an object with required fields
    if (!model || typeof model !== 'object') {
      throw new Error('Invalid model object');
    }
    if (!model.id || typeof model.id !== 'string' || model.id.length > 128) {
      throw new Error('Invalid model ID');
    }
    return await startDownload(model);
  });

  ipcMain.handle('download:pause', async (_event, modelId) => {
    if (typeof modelId !== 'string' || modelId.length > 128) {
      throw new Error('Invalid model ID');
    }
    return pauseDownload(modelId);
  });

  ipcMain.handle('download:cancel', async (_event, modelId) => {
    if (typeof modelId !== 'string' || modelId.length > 128) {
      throw new Error('Invalid model ID');
    }
    return cancelDownload(modelId);
  });

  ipcMain.handle('download:status', async () => {
    return getDownloadStatus();
  });

  // --- Chat / Inference (Phase 2) ---
  ipcMain.handle('llama:start', async (_event, params) => {
    // 🔒 Validate params
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid params');
    }
    if (!params.modelPath || typeof params.modelPath !== 'string' || params.modelPath.length > 1024) {
      throw new Error('Invalid model path');
    }
    const hardware = await detectHardware();
    return await startLlama(params.modelPath, hardware);
  });

  ipcMain.handle('llama:stop', async () => {
    return await stopLlama();
  });

  ipcMain.handle('llama:chat', async (_event, params) => {
    // 🔒 Validate params is an object with messages array
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid chat params');
    }
    if (!Array.isArray(params.messages)) {
      throw new Error('params.messages must be an array');
    }
    return await llamaChat(params.messages, params.systemPrompt, params.inferenceParams);
  });

  ipcMain.handle('llama:getContextInfo', async () => {
    return getContextInfo();
  });

  ipcMain.handle('llama:getStatus', async () => {
    return getLlamaStatus();
  });

  // --- Context Management (Phase 2) ---
  ipcMain.handle('context:getInfo', async (_event, params) => {
    if (!params || !Array.isArray(params.messages)) {
      return getContextFill([], '');
    }
    return getContextFill(params.messages, params.systemPrompt || '');
  });

  ipcMain.handle('context:estimateTokens', async (_event, text) => {
    if (typeof text !== 'string') return 0;
    return estimateTokens(text);
  });

  // --- Shell (always available) ---
  ipcMain.handle('shell:openExternal', async (_event, url) => {
    // 🔒 Only allow https:// and mailto: URLs — block file://, javascript:, etc.
    if (typeof url !== 'string' || url.length > 2048) {
      throw new Error('Invalid URL');
    }
    const allowed = url.startsWith('https://') || url.startsWith('mailto:');
    if (!allowed) {
      console.warn(`[security] Blocked openExternal for: ${url}`);
      throw new Error('Only https:// and mailto: URLs are allowed');
    }
    await shell.openExternal(url);
  });

  // --- Chat Panel (Phase 3) ---
  ipcMain.handle('panel:hide', () => {
    if (chatPanel && !chatPanel.isDestroyed()) {
      chatPanel.hide();
    }
  });

  ipcMain.handle('panel:togglePin', (_event, pinned) => {
    // 🔒 Validate boolean
    const isPinned = pinned === true;
    chatPanelPinned = isPinned;
    if (chatPanel && !chatPanel.isDestroyed()) {
      chatPanel.setAlwaysOnTop(isPinned);
    }
    return { pinned: chatPanelPinned };
  });

  ipcMain.handle('panel:isPinned', () => {
    return { pinned: chatPanelPinned };
  });

  ipcMain.handle('panel:getPosition', () => {
    if (!chatPanel || chatPanel.isDestroyed()) return null;
    const [x, y] = chatPanel.getPosition();
    const [width, height] = chatPanel.getSize();
    return { x, y, width, height };
  });

  ipcMain.handle('panel:setPosition', (_event, pos) => {
    if (!chatPanel || chatPanel.isDestroyed()) return;
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
    chatPanel.setPosition(Math.round(pos.x), Math.round(pos.y));
  });

  // --- Clipboard AI (Phase 3) ---
  ipcMain.handle('clipboard:action', async (_event, params) => {
    // 🔒 Validate
    if (!params || typeof params !== 'object') throw new Error('Invalid params');
    if (typeof params.action !== 'string' || params.action.length > 64) throw new Error('Invalid action');
    if (typeof params.text !== 'string' || params.text.length > 50000) throw new Error('Invalid text');
    // Read user settings for translate language + autopaste
    const db = getDb();
    const translateRow = db.prepare("SELECT value FROM settings WHERE key = 'translateLanguage'").get();
    const autopasteRow = db.prepare("SELECT value FROM settings WHERE key = 'autopasteEnabled'").get();
    const options = {
      translateLanguage: translateRow?.value || 'English',
      autopasteEnabled: autopasteRow?.value === 'true',
    };
    return await handleClipboardAction(params.action, params.text, options);
  });

  ipcMain.handle('clipboard:undo', (_event, originalText) => {
    if (originalText && typeof originalText !== 'string') throw new Error('Invalid text');
    return undoClipboard(originalText);
  });

  // --- Whisper / Voice (Phase 3) ---
  ipcMain.handle('whisper:transcribe', async (_event, audioBuffer) => {
    // 🔒 Validate: must be an ArrayBuffer-like (arrives as Uint8Array via IPC)
    if (!audioBuffer || !(audioBuffer instanceof Uint8Array || Buffer.isBuffer(audioBuffer))) {
      throw new Error('Invalid audio buffer');
    }
    return await whisperEngine.transcribe(Buffer.from(audioBuffer));
  });

  ipcMain.handle('whisper:getModels', () => {
    return whisperEngine.getAvailableModels();
  });

  // --- Voice Recording (Phase 3) ---
  // Receives the audio buffer from AudioCaptureWindow after recording stops
  ipcMain.handle('audio:recorded', async (_event, audioBuffer) => {
    // 🔒 Validate
    if (!audioBuffer || !(audioBuffer instanceof Uint8Array || Buffer.isBuffer(audioBuffer))) {
      throw new Error('Invalid audio buffer from recording');
    }
    if (audioBuffer.length < 100) {
      // Recording was too short or empty
      if (recordingOverlay && !recordingOverlay.isDestroyed()) {
        recordingOverlay.hide();
      }
      return { transcript: '', error: 'Recording too short' };
    }

    try {
      // Transcribe using whisper engine
      const transcript = await whisperEngine.transcribe(Buffer.from(audioBuffer));

      // Broadcast transcript to all windows (main + panel can use it)
      const { BrowserWindow: BW } = require('electron');
      for (const win of BW.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('voice:transcript', { transcript });
        }
      }

      console.log(`[voice] Transcription complete: "${transcript.slice(0, 60)}..."`);
      return { transcript };
    } catch (err) {
      console.error('[voice] Transcription failed:', err.message);
      // Broadcast error
      const { BrowserWindow: BW } = require('electron');
      for (const win of BW.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('voice:error', { error: err.message });
        }
      }
      return { transcript: '', error: err.message };
    } finally {
      // Hide overlay after transcription completes (success or error)
      if (recordingOverlay && !recordingOverlay.isDestroyed()) {
        recordingOverlay.hide();
      }
    }
  });

  // Called by renderer when mic permission is denied
  ipcMain.handle('audio:error', (_event, errorMsg) => {
    isRecording = false;
    if (recordingTimeout) { clearTimeout(recordingTimeout); recordingTimeout = null; }
    if (recordingOverlay && !recordingOverlay.isDestroyed()) {
      recordingOverlay.hide();
    }
    console.error('[voice] Audio error:', errorMsg);
  });

  // --- Document Intelligence (Phase 4) ---
  ipcMain.handle('document:parse', async (_event, params) => {
    // 🔒 Validate
    if (!params || typeof params !== 'object') throw new Error('Invalid params');
    if (typeof params.filePath !== 'string' || params.filePath.length > 1024) {
      throw new Error('Invalid file path');
    }
    // 🔒 Path traversal check (redundant with documentParser's own check — defense in depth)
    if (params.filePath.includes('..')) throw new Error('INVALID_PATH: path traversal blocked');
    const effectiveCtx = typeof params.effectiveCtx === 'number' ? params.effectiveCtx : 4096;
    return await processDocument(params.filePath, effectiveCtx);
  });

  ipcMain.handle('document:getChunks', (_event, params) => {
    if (!params || typeof params !== 'object') throw new Error('Invalid params');
    if (typeof params.query !== 'string' || params.query.length > 2000) {
      throw new Error('Invalid query');
    }
    if (!Array.isArray(params.index)) throw new Error('Invalid chunk index');
    const maxChunks = typeof params.maxChunks === 'number' ? params.maxChunks : 5;
    return getRelevantChunks(params.query, params.index, maxChunks);
  });

  // --- WebSocket Server (Phase 5) ---
  ipcMain.handle('ws:updateExtensionIds', (_event, ids) => {
    // 🔒 Validate
    if (!ids || typeof ids !== 'object') throw new Error('Invalid IDs');
    const chrome = typeof ids.chrome === 'string' ? ids.chrome.slice(0, 64) : '';
    const edge = typeof ids.edge === 'string' ? ids.edge.slice(0, 64) : '';
    wsServer.updateAllowedOrigins(chrome, edge);
    return { success: true };
  });

  ipcMain.handle('ws:getStatus', () => {
    return { connections: wsServer.getConnectionCount() };
  });

  // --- Onboarding (Phase 9) ---
  ipcMain.handle('onboarding:check', () => {
    const db = getDb();
    const row = db.prepare('SELECT completed FROM onboarding WHERE id = 1').get();
    return { completed: row?.completed === 1 };
  });

  ipcMain.handle('onboarding:complete', () => {
    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO onboarding (id, completed, completed_at) VALUES (1, 1, datetime('now'))"
    ).run();
    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  setupCSP();
  createMainWindow();
  createTray();
  registerIPC();
  registerGlobalShortcuts();
  startClipboardMonitoring(mainWindow, showIndicator);
  wsServer.start();
  pipeServer.start();

  // Register antonai:// deep link protocol
  app.setAsDefaultProtocolClient('antonai');
});

// Second instance tried to launch — focus existing window instead
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// macOS: re-create window if dock icon clicked and all windows closed
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

// Prevent app from quitting when all windows are closed (stays in tray)
app.on('window-all-closed', () => {
  // Do nothing — tray keeps the app alive
  // On macOS this is the expected behaviour.
  // On Windows/Linux the tray icon keeps the process running.
});

// Clean up before quit
app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  stopClipboardMonitoring();
  wsServer.stop();
  pipeServer.stop();
  killLlama();
  closeDb();
});
