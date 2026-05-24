// electron/handlers/downloader.js — Model download manager
// Chunked HTTP download with resume, SHA-256 verification, queue, and progress.
//
// Features:
//   - Resume via .part file + HTTP Range header
//   - SHA-256 verification when hash is provided in catalogue
//   - Max 2 concurrent downloads (queue for the rest)
//   - Progress events every 500ms: { modelId, downloaded, total, speedMBps, eta }
//   - Pause, cancel, and status queries
//   - SQLite insert on successful completion
//
// 🔒 Security:
//   - Filenames sanitised (no path traversal)
//   - Dest paths always under app.getPath('userData')/models/
//   - Download URLs validated as https://
//   - Disk space checked before starting

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { getDb } = require('../db');
const { detectHardware } = require('./hardware');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_CONCURRENT = 2;
const PROGRESS_INTERVAL_MS = 500;
const MODELS_BASE_DIR = () => path.join(app.getPath('userData'), 'models');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
// Active + paused downloads: modelId → DownloadState
const activeDownloads = new Map();
// Queued downloads waiting for a slot
const downloadQueue = [];
// Reference to mainWindow for emitting events (set via init)
let _mainWindow = null;

// ---------------------------------------------------------------------------
// DownloadState shape
// ---------------------------------------------------------------------------
// {
//   modelId, model, destPath, partPath,
//   request (http.ClientRequest | null),
//   writeStream (fs.WriteStream | null),
//   progressInterval (timer | null),
//   paused: bool,
//   downloadedBytes: number,
//   totalBytes: number,
//   startTime: number,
//   lastProgressBytes: number,
//   lastProgressTime: number,
// }

// ---------------------------------------------------------------------------
// init — call once from main.js to set the mainWindow ref
// ---------------------------------------------------------------------------
function initDownloader(mainWindow) {
  _mainWindow = mainWindow;
}

// ---------------------------------------------------------------------------
// startDownload — main entry point
// ---------------------------------------------------------------------------
async function startDownload(model) {
  // 🔒 Validate model object
  if (!model || typeof model !== 'object') {
    throw new Error('Invalid model object');
  }
  if (!model.id || !model.downloadUrl || !model.fileName || !model.category) {
    throw new Error('Model missing required fields: id, downloadUrl, fileName, category');
  }
  // 🔒 Validate URL is HTTPS (HuggingFace always is)
  if (!model.downloadUrl.startsWith('https://')) {
    throw new Error('Download URL must be HTTPS');
  }

  // Already downloading or queued?
  if (activeDownloads.has(model.id)) {
    const existing = activeDownloads.get(model.id);
    if (existing.paused) {
      // Resume
      return resumeDownload(model.id);
    }
    throw new Error(`Model ${model.id} is already downloading`);
  }

  // 🔒 Sanitise filename — strip path separators and dangerous chars
  const safeFileName = sanitiseFileName(model.fileName);

  // Build destination paths
  const categoryDir = path.join(MODELS_BASE_DIR(), model.category);
  const destPath = path.join(categoryDir, safeFileName);
  const partPath = destPath + '.part';

  // 🔒 Verify destPath is still under MODELS_BASE_DIR (anti-traversal)
  const resolvedDest = path.resolve(destPath);
  const resolvedBase = path.resolve(MODELS_BASE_DIR());
  if (!resolvedDest.startsWith(resolvedBase)) {
    throw new Error('🔒 Path traversal detected — download blocked');
  }

  // Create category directory
  fs.mkdirSync(categoryDir, { recursive: true });

  // Check disk space
  await checkDiskSpace(model.fileSizeMB);

  // RAM warning (non-blocking — just emit an event)
  await emitRamWarningIfNeeded(model);

  // Check if we have a concurrent slot
  const runningCount = [...activeDownloads.values()].filter(
    (d) => !d.paused
  ).length;

  if (runningCount >= MAX_CONCURRENT) {
    // Queue it
    downloadQueue.push({ model, destPath, partPath });
    emit('download:progress', {
      modelId: model.id,
      status: 'queued',
      downloaded: 0,
      total: model.fileSizeMB * 1024 * 1024,
      speedMBps: 0,
      eta: null,
    });
    return { status: 'queued', modelId: model.id };
  }

  // Start immediately
  return executeDownload(model, destPath, partPath);
}

// ---------------------------------------------------------------------------
// executeDownload — actually begins the HTTP request
// ---------------------------------------------------------------------------
function executeDownload(model, destPath, partPath) {
  return new Promise((resolve, reject) => {
    // Check for existing .part file (resume)
    let startByte = 0;
    if (fs.existsSync(partPath)) {
      startByte = fs.statSync(partPath).size;
    }

    const headers = {
      'User-Agent': `AntonAI/${app.getVersion()} (Windows)`,
    };

    // Resume: request from startByte onwards
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const parsedUrl = new URL(model.downloadUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const state = {
      modelId: model.id,
      model,
      destPath,
      partPath,
      request: null,
      writeStream: null,
      progressInterval: null,
      paused: false,
      downloadedBytes: startByte,
      totalBytes: 0,
      startTime: Date.now(),
      lastProgressBytes: startByte,
      lastProgressTime: Date.now(),
    };

    activeDownloads.set(model.id, state);

    const req = httpModule.get(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers,
      },
      (res) => {
        // Handle redirects (HuggingFace uses 302)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Clean up and follow redirect
          res.resume();
          const redirectModel = { ...model, downloadUrl: res.headers.location };
          // Allow http for redirected CDN URLs (HF CDN uses https but just in case)
          activeDownloads.delete(model.id);
          executeDownload(redirectModel, destPath, partPath)
            .then(resolve)
            .catch(reject);
          return;
        }

        // 416 Range Not Satisfiable — file was already complete
        if (res.statusCode === 416) {
          res.resume();
          activeDownloads.delete(model.id);
          handleDownloadComplete(model, destPath, partPath, startByte)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume();
          cleanupState(model.id);
          const err = new Error(`HTTP ${res.statusCode} from ${parsedUrl.hostname}`);
          emit('download:failed', { modelId: model.id, error: err.message });
          reject(err);
          return;
        }

        // Calculate total size
        if (res.statusCode === 206) {
          // Partial content — Content-Range: bytes START-END/TOTAL
          const range = res.headers['content-range'];
          if (range) {
            const match = range.match(/\/(\d+)$/);
            if (match) {
              state.totalBytes = parseInt(match[1], 10);
            }
          }
          if (!state.totalBytes) {
            state.totalBytes =
              startByte + parseInt(res.headers['content-length'] || '0', 10);
          }
        } else {
          // Fresh download (200)
          state.totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          // Reset startByte — server didn't honour Range
          state.downloadedBytes = 0;
          startByte = 0;
        }

        // Open write stream (append if resuming, write if fresh)
        const writeFlags = startByte > 0 && res.statusCode === 206 ? 'a' : 'w';
        state.writeStream = fs.createWriteStream(partPath, { flags: writeFlags });

        state.writeStream.on('error', (err) => {
          cleanupState(model.id);
          emit('download:failed', {
            modelId: model.id,
            error: `Write error: ${err.message}`,
          });
          reject(err);
        });

        // Start progress interval
        state.progressInterval = setInterval(() => {
          emitProgress(state);
        }, PROGRESS_INTERVAL_MS);

        // Pipe data
        res.on('data', (chunk) => {
          if (state.paused) return;
          state.downloadedBytes += chunk.length;
        });

        res.pipe(state.writeStream);

        res.on('end', () => {
          clearInterval(state.progressInterval);
          state.progressInterval = null;

          handleDownloadComplete(model, destPath, partPath, state.downloadedBytes)
            .then((result) => {
              activeDownloads.delete(model.id);
              processQueue();
              resolve(result);
            })
            .catch((err) => {
              activeDownloads.delete(model.id);
              processQueue();
              reject(err);
            });
        });

        res.on('error', (err) => {
          cleanupState(model.id);
          emit('download:failed', {
            modelId: model.id,
            error: `Network error: ${err.message}`,
          });
          reject(err);
        });
      }
    );

    state.request = req;

    req.on('error', (err) => {
      cleanupState(model.id);
      emit('download:failed', {
        modelId: model.id,
        error: `Request error: ${err.message}`,
      });
      reject(err);
    });

    // Emit initial progress
    emit('download:progress', {
      modelId: model.id,
      status: 'downloading',
      downloaded: state.downloadedBytes,
      total: model.fileSizeMB * 1024 * 1024, // estimate until real total known
      speedMBps: 0,
      eta: null,
    });

    resolve({ status: 'downloading', modelId: model.id });
  });
}

// ---------------------------------------------------------------------------
// handleDownloadComplete — verify SHA-256, rename .part, insert SQLite
// ---------------------------------------------------------------------------
async function handleDownloadComplete(model, destPath, partPath, finalSize) {
  // SHA-256 verification (if hash provided)
  if (model.sha256) {
    emit('download:progress', {
      modelId: model.id,
      status: 'verifying',
      downloaded: finalSize,
      total: finalSize,
      speedMBps: 0,
      eta: null,
    });

    const hash = await computeSha256(partPath);

    if (hash !== model.sha256.toLowerCase()) {
      // Hash mismatch — delete the .part file
      try {
        fs.unlinkSync(partPath);
      } catch (_e) {
        // ignore
      }
      const err = new Error(
        `SHA-256 mismatch. Expected: ${model.sha256}, got: ${hash}. File deleted.`
      );
      emit('download:failed', { modelId: model.id, error: err.message });
      throw err;
    }
  }

  // Rename .part → final
  try {
    // If final file exists (from a previous incomplete rename), remove it
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    fs.renameSync(partPath, destPath);
  } catch (err) {
    emit('download:failed', {
      modelId: model.id,
      error: `Failed to finalise file: ${err.message}`,
    });
    throw err;
  }

  // Insert into SQLite
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO downloaded_models
        (id, name, version, category, file_path, file_size_mb, downloaded_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      model.id,
      model.name,
      model.version || '1.0',
      model.category,
      destPath,
      model.fileSizeMB
    );
  } catch (err) {
    console.error('[downloader] SQLite insert failed:', err.message);
    // Non-fatal — file is downloaded, just not tracked
  }

  emit('download:complete', { modelId: model.id, filePath: destPath });

  return { status: 'complete', modelId: model.id, filePath: destPath };
}

// ---------------------------------------------------------------------------
// pauseDownload
// ---------------------------------------------------------------------------
function pauseDownload(modelId) {
  const state = activeDownloads.get(modelId);
  if (!state) {
    throw new Error(`No active download for ${modelId}`);
  }
  if (state.paused) return { status: 'already_paused', modelId };

  state.paused = true;

  // Abort the HTTP request — .part file is preserved for resume
  if (state.request) {
    state.request.destroy();
    state.request = null;
  }
  if (state.writeStream) {
    state.writeStream.end();
    state.writeStream = null;
  }
  if (state.progressInterval) {
    clearInterval(state.progressInterval);
    state.progressInterval = null;
  }

  emit('download:progress', {
    modelId,
    status: 'paused',
    downloaded: state.downloadedBytes,
    total: state.totalBytes,
    speedMBps: 0,
    eta: null,
  });

  processQueue();
  return { status: 'paused', modelId };
}

// ---------------------------------------------------------------------------
// resumeDownload
// ---------------------------------------------------------------------------
function resumeDownload(modelId) {
  const state = activeDownloads.get(modelId);
  if (!state || !state.paused) {
    throw new Error(`No paused download for ${modelId}`);
  }

  // Remove from active so executeDownload re-registers it
  activeDownloads.delete(modelId);

  return executeDownload(state.model, state.destPath, state.partPath);
}

// ---------------------------------------------------------------------------
// cancelDownload
// ---------------------------------------------------------------------------
function cancelDownload(modelId) {
  const state = activeDownloads.get(modelId);

  // Also check queue
  const queueIdx = downloadQueue.findIndex((q) => q.model.id === modelId);
  if (queueIdx !== -1) {
    downloadQueue.splice(queueIdx, 1);
    return { status: 'cancelled', modelId };
  }

  if (!state) {
    throw new Error(`No download to cancel for ${modelId}`);
  }

  // Abort request
  if (state.request) {
    state.request.destroy();
  }
  if (state.writeStream) {
    state.writeStream.end();
  }
  if (state.progressInterval) {
    clearInterval(state.progressInterval);
  }

  // Delete .part file
  try {
    if (fs.existsSync(state.partPath)) {
      fs.unlinkSync(state.partPath);
    }
  } catch (err) {
    console.warn('[downloader] Failed to delete .part file:', err.message);
  }

  activeDownloads.delete(modelId);

  emit('download:progress', {
    modelId,
    status: 'cancelled',
    downloaded: 0,
    total: 0,
    speedMBps: 0,
    eta: null,
  });

  processQueue();
  return { status: 'cancelled', modelId };
}

// ---------------------------------------------------------------------------
// getDownloadStatus — snapshot of all active/paused/queued downloads
// ---------------------------------------------------------------------------
function getDownloadStatus() {
  const active = [];
  for (const [modelId, state] of activeDownloads) {
    active.push({
      modelId,
      status: state.paused ? 'paused' : 'downloading',
      downloaded: state.downloadedBytes,
      total: state.totalBytes,
    });
  }
  const queued = downloadQueue.map((q) => ({
    modelId: q.model.id,
    status: 'queued',
    downloaded: 0,
    total: q.model.fileSizeMB * 1024 * 1024,
  }));
  return [...active, ...queued];
}

// ---------------------------------------------------------------------------
// Queue processor — starts next queued download if a slot is free
// ---------------------------------------------------------------------------
function processQueue() {
  const runningCount = [...activeDownloads.values()].filter(
    (d) => !d.paused
  ).length;

  while (runningCount < MAX_CONCURRENT && downloadQueue.length > 0) {
    const next = downloadQueue.shift();
    executeDownload(next.model, next.destPath, next.partPath).catch((err) => {
      console.error(`[downloader] Queued download failed: ${err.message}`);
    });
    break; // re-check count on next processQueue call
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emit an IPC event to the renderer */
function emit(channel, data) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(channel, data);
  }
}

/** Emit progress for a single download */
function emitProgress(state) {
  const now = Date.now();
  const elapsed = (now - state.lastProgressTime) / 1000; // seconds
  const deltaBytes = state.downloadedBytes - state.lastProgressBytes;
  const speedBps = elapsed > 0 ? deltaBytes / elapsed : 0;
  const speedMBps = Math.round((speedBps / (1024 * 1024)) * 100) / 100;

  const remaining = state.totalBytes - state.downloadedBytes;
  const eta = speedBps > 0 ? Math.round(remaining / speedBps) : null; // seconds

  state.lastProgressBytes = state.downloadedBytes;
  state.lastProgressTime = now;

  emit('download:progress', {
    modelId: state.modelId,
    status: 'downloading',
    downloaded: state.downloadedBytes,
    total: state.totalBytes,
    speedMBps,
    eta,
  });
}

/** Clean up a download state (on error or cancel) */
function cleanupState(modelId) {
  const state = activeDownloads.get(modelId);
  if (!state) return;

  if (state.request) {
    state.request.destroy();
  }
  if (state.writeStream) {
    state.writeStream.end();
  }
  if (state.progressInterval) {
    clearInterval(state.progressInterval);
  }
  activeDownloads.delete(modelId);
}

/**
 * 🔒 Sanitise filename — remove path separators, .., and control chars.
 * Only allow alphanumeric, hyphens, underscores, dots.
 */
function sanitiseFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Invalid filename');
  }
  // Take only the basename (strip any directory components)
  let safe = path.basename(fileName);
  // Remove any characters that aren't safe
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Ensure it doesn't start with a dot (hidden file / directory traversal)
  if (safe.startsWith('.')) {
    safe = '_' + safe;
  }
  // Must have some content
  if (safe.length === 0 || safe.length > 255) {
    throw new Error('Filename empty or too long after sanitisation');
  }
  return safe;
}

/** Check available disk space before starting download */
async function checkDiskSpace(fileSizeMB) {
  try {
    const hardware = await detectHardware();
    const requiredGB = fileSizeMB / 1024 + 2; // model size + 2 GB buffer
    if (hardware.diskFreeGB > 0 && hardware.diskFreeGB < requiredGB) {
      throw new Error(
        `DISK_SPACE: Need ${requiredGB.toFixed(1)} GB free, ` +
        `only ${hardware.diskFreeGB} GB available.`
      );
    }
  } catch (err) {
    if (err.message.startsWith('DISK_SPACE')) throw err;
    // If hardware detection fails, don't block the download
    console.warn('[downloader] Disk space check failed:', err.message);
  }
}

/** Emit a RAM warning if model is too large for available memory */
async function emitRamWarningIfNeeded(model) {
  try {
    const hardware = await detectHardware();
    const availableGB = hardware.ram.availableMB / 1024;
    if (model.ramRequiredGB && model.ramRequiredGB > availableGB * 0.8) {
      emit('download:progress', {
        modelId: model.id,
        status: 'ram_warning',
        downloaded: 0,
        total: 0,
        speedMBps: 0,
        eta: null,
        warning: `This model needs ~${model.ramRequiredGB} GB RAM. ` +
          `You have ${availableGB.toFixed(1)} GB available. ` +
          `It may run slowly.`,
      });
    }
  } catch (_err) {
    // Non-fatal
  }
}

/** Compute SHA-256 of a file — streaming, not loaded into memory */
function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  initDownloader,
  startDownload,
  pauseDownload,
  cancelDownload,
  getDownloadStatus,
};
