// electron/handlers/llama.js — llama.cpp engine manager
// Spawns llama-server.exe as a child process, manages lifecycle,
// streams chat completions via SSE to the renderer.
//
// Architecture:
//   - One llama-server process at a time (single model loaded)
//   - Binds to 127.0.0.1 only — never exposed to network
//   - Context window computed from hardware + GGUF metadata
//   - SSE tokens forwarded to renderer via IPC events
//   - Child process killed cleanly on stop() and app quit
//
// 🔒 Security:
//   - Binary path is hardcoded relative to app — no user input
//   - Model path validated to be under userData/models/ or engines/
//   - llama-server binds to localhost only
//   - HTTP requests to llama-server are local-only (127.0.0.1)

const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const portfinder = require('portfinder');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let proc = null;           // child_process.ChildProcess
let port = null;           // number — port llama-server is listening on
let ctxInfo = null;        // { native, effective, limitReason, ramGB }
let currentModelPath = null;
let _mainWindow = null;
let isShuttingDown = false;

// ---------------------------------------------------------------------------
// initLlama — call once from main.js to set the mainWindow ref
// ---------------------------------------------------------------------------
function initLlama(mainWindow) {
  _mainWindow = mainWindow;
}

// ---------------------------------------------------------------------------
// selectBinary — choose the right llama-server binary for this hardware
// ---------------------------------------------------------------------------
function selectBinary(hardware) {
  // Base path: in dev relative to project, in prod inside extraResources
  const devBase = path.join(__dirname, '..', '..', 'engines', 'llama', 'binaries');
  const prodBase = path.join(process.resourcesPath, 'engines', 'llama', 'binaries');
  const basePath = app.isPackaged ? prodBase : devBase;

  const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const candidates = [];

  // GPU-accelerated builds first (faster)
  if (hardware.gpu) {
    const vendor = (hardware.gpu.vendor || '').toLowerCase();

    if (vendor.includes('nvidia') || vendor.includes('geforce') || vendor.includes('quadro')) {
      candidates.push(path.join(basePath, 'cuda', exe));
    }

    if (vendor.includes('amd') || vendor.includes('radeon')) {
      candidates.push(path.join(basePath, 'rocm', exe));
    }
  }

  // CPU fallback (always available — requires AVX2)
  candidates.push(path.join(basePath, 'cpu', exe));

  // Find the first binary that exists
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`[llama] Selected binary: ${candidate}`);
      return candidate;
    }
  }

  throw new Error(
    'BINARY_NOT_FOUND: llama-server binary not found. ' +
    `Searched: ${candidates.join(', ')}. ` +
    'Please re-install Anton AI or check the engines/llama/binaries/ folder.'
  );
}

// ---------------------------------------------------------------------------
// start — spawn llama-server with a model
// ---------------------------------------------------------------------------
async function start(modelPath, hardware) {
  // If already running, stop first
  if (proc) {
    await stop();
  }

  // 🔒 Validate model path exists
  if (!modelPath || typeof modelPath !== 'string') {
    throw new Error('Invalid model path');
  }
  const resolvedModel = path.resolve(modelPath);
  if (!fs.existsSync(resolvedModel)) {
    throw new Error(`Model file not found: ${resolvedModel}`);
  }

  // 🔒 Validate model path is under allowed directories
  const modelsDir = path.resolve(path.join(app.getPath('userData'), 'models'));
  const enginesDir = path.resolve(path.join(__dirname, '..', '..', 'engines'));
  const prodEnginesDir = app.isPackaged
    ? path.resolve(path.join(process.resourcesPath, 'engines'))
    : null;

  const isAllowed =
    resolvedModel.startsWith(modelsDir) ||
    resolvedModel.startsWith(enginesDir) ||
    (prodEnginesDir && resolvedModel.startsWith(prodEnginesDir));

  if (!isAllowed) {
    throw new Error('🔒 Model path is outside allowed directories');
  }

  // Step 1 — Find port
  port = await portfinder.getPortPromise({ port: 8080, stopPort: 8180 });

  // Step 2 — Read GGUF metadata for context length
  let nativeCtx = 4096; // safe default
  try {
    const { gguf } = await import('@huggingface/gguf');
    const { metadata } = await gguf(resolvedModel);
    nativeCtx = metadata['llama.context_length'] || 4096;
    console.log(`[llama] GGUF native context: ${nativeCtx}`);
  } catch (err) {
    console.warn('[llama] Could not read GGUF metadata — using 4096 default:', err.message);
  }

  // Step 3 — Compute effective context window (PRD Layer 1)
  const ramAvailMB = hardware.ram?.availableMB || 4096;
  const vramMB = hardware.gpu?.vramMB || 0;

  // KV cache costs ~256 bytes/token on CPU, ~192 bytes/token on GPU
  const ramCap = Math.floor((ramAvailMB * 1024 * 0.40) / 256);
  const vramCap = vramMB > 0 ? Math.floor((vramMB * 1024 * 0.70) / 192) : 0;
  const hardwareBest = Math.max(ramCap, vramCap);
  const effectiveCtx = Math.min(nativeCtx, hardwareBest, 131072); // 128K ceiling

  let limitReason;
  if (effectiveCtx >= nativeCtx) {
    limitReason = 'model';
  } else if (vramCap > 0 && vramCap >= ramCap) {
    limitReason = 'vram';
  } else {
    limitReason = 'ram';
  }

  const ramGB = Math.round(ramAvailMB / 1024);

  ctxInfo = {
    native: nativeCtx,
    effective: effectiveCtx,
    limitReason,
    ramGB,
  };

  console.log(
    `[llama] Context: native=${nativeCtx}, effective=${effectiveCtx}, ` +
    `limited by ${limitReason}, RAM=${ramGB}GB`
  );

  // Step 4 — Select binary and build args
  const binaryPath = selectBinary(hardware);
  const ngl = hardware.gpu ? 99 : 0;
  const threads = Math.max(1, (hardware.cpu?.physicalCores || 4) - 1);

  const args = [
    '--model', resolvedModel,
    '--host', '127.0.0.1',
    '--port', String(port),
    '-ngl', String(ngl),
    '--threads', String(threads),
    '--ctx-size', String(effectiveCtx),
    '--log-disable',
  ];

  console.log(`[llama] Spawning: ${binaryPath} ${args.join(' ')}`);

  // Step 5 — Spawn child process
  currentModelPath = resolvedModel;
  isShuttingDown = false;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('llama-server failed to start within 30 seconds'));
      kill();
    }, 30000);

    proc = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      // 🔒 No shell — prevents command injection
      shell: false,
      // Detached false — child dies with parent
      detached: false,
      // Set cwd to the binary's directory (some builds need this)
      cwd: path.dirname(binaryPath),
    });

    let started = false;

    // Watch stdout for "listening" message
    proc.stdout.on('data', (data) => {
      const text = data.toString();

      if (!started && text.toLowerCase().includes('listening')) {
        started = true;
        clearTimeout(timeout);
        console.log(`[llama] Server ready on port ${port}`);
        resolve({
          port,
          ctxInfo,
          modelPath: resolvedModel,
        });
      }
    });

    // Log stderr for debugging
    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        // llama.cpp uses stderr for progress — only log non-spam lines
        if (!text.includes('llama_') && !text.includes('ggml_')) {
          console.warn(`[llama:stderr] ${text}`);
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      proc = null;
      port = null;
      emit('llama:error', { error: `Failed to start llama-server: ${err.message}` });
      reject(new Error(`Failed to start llama-server: ${err.message}`));
    });

    proc.on('exit', (code, signal) => {
      clearTimeout(timeout);
      const wasRunning = proc !== null;
      proc = null;
      port = null;

      if (!started && !isShuttingDown) {
        reject(new Error(`llama-server exited before ready (code=${code}, signal=${signal})`));
      }

      if (wasRunning && !isShuttingDown) {
        console.warn(`[llama] Server exited unexpectedly (code=${code}, signal=${signal})`);
        emit('llama:error', {
          error: `llama-server stopped unexpectedly (exit code ${code})`,
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// chat — send messages to llama-server and stream tokens back
// ---------------------------------------------------------------------------
async function chat(messages, systemPrompt, params = {}) {
  if (!proc || !port) {
    throw new Error('llama-server is not running. Load a model first.');
  }

  // Build the messages array with system prompt prepended
  const fullMessages = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }

  // 🔒 Validate messages array
  if (!Array.isArray(messages)) {
    throw new Error('messages must be an array');
  }
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      throw new Error('Each message must have role and content (string)');
    }
    if (msg.content.length > 500000) {
      throw new Error('Message content exceeds 500,000 character limit');
    }
    fullMessages.push({ role: msg.role, content: msg.content });
  }

  const body = JSON.stringify({
    model: 'local',
    messages: fullMessages,
    stream: true,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 2048,
    top_p: params.topP ?? 0.9,
    // llama-server specific
    stop: params.stop || [],
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let errBody = '';
          res.on('data', (chunk) => { errBody += chunk; });
          res.on('end', () => {
            const err = new Error(`llama-server returned ${res.statusCode}: ${errBody.slice(0, 200)}`);
            emit('llama:error', { error: err.message });
            reject(err);
          });
          return;
        }

        let fullResponse = '';
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();

          // Process complete SSE lines
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith(':')) {
              // Empty line or SSE comment — skip
              continue;
            }

            if (trimmed === 'data: [DONE]') {
              // Stream complete
              continue;
            }

            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullResponse += delta;
                  emit('llama:token', delta);
                }

                // Check for finish_reason
                const finishReason = parsed.choices?.[0]?.finish_reason;
                if (finishReason) {
                  // Will be handled by res.on('end')
                }
              } catch (_parseErr) {
                // Malformed JSON chunk — skip
              }
            }
          }
        });

        res.on('end', () => {
          // Process any remaining buffer
          if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(buffer.trim().slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullResponse += delta;
                emit('llama:token', delta);
              }
            } catch (_e) {
              // ignore
            }
          }

          emit('llama:done', { fullResponse });
          resolve({ content: fullResponse });
        });

        res.on('error', (err) => {
          emit('llama:error', { error: `Stream error: ${err.message}` });
          reject(err);
        });
      }
    );

    req.on('error', (err) => {
      emit('llama:error', { error: `Request error: ${err.message}` });
      reject(err);
    });

    // 5-minute timeout for long generations
    req.setTimeout(300000, () => {
      req.destroy();
      emit('llama:error', { error: 'Generation timed out after 5 minutes' });
      reject(new Error('Generation timed out'));
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// stop — kill the child process
// ---------------------------------------------------------------------------
async function stop() {
  if (!proc) {
    return { status: 'not_running' };
  }

  isShuttingDown = true;

  return new Promise((resolve) => {
    const killTimeout = setTimeout(() => {
      // Force kill if graceful shutdown takes too long
      if (proc) {
        console.warn('[llama] Force killing (SIGKILL) after 5s timeout');
        kill();
      }
      resolve({ status: 'force_killed' });
    }, 5000);

    proc.on('exit', () => {
      clearTimeout(killTimeout);
      proc = null;
      port = null;
      currentModelPath = null;
      console.log('[llama] Server stopped.');
      resolve({ status: 'stopped' });
    });

    // Try graceful shutdown first — SIGTERM on Unix, taskkill on Windows
    try {
      if (process.platform === 'win32') {
        // On Windows, spawn taskkill to terminate the process tree
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
          stdio: 'ignore',
          shell: false,
        });
      } else {
        proc.kill('SIGTERM');
      }
    } catch (err) {
      console.warn('[llama] Error sending kill signal:', err.message);
      kill();
      resolve({ status: 'force_killed' });
    }
  });
}

// ---------------------------------------------------------------------------
// kill — immediate force kill (no waiting)
// ---------------------------------------------------------------------------
function kill() {
  if (!proc) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
      });
    } else {
      proc.kill('SIGKILL');
    }
  } catch (_err) {
    // Process may already be dead
  }
  proc = null;
  port = null;
}

// ---------------------------------------------------------------------------
// getContextInfo — return the current context window info
// ---------------------------------------------------------------------------
function getContextInfo() {
  return ctxInfo || {
    native: 0,
    effective: 0,
    limitReason: 'none',
    ramGB: 0,
  };
}

// ---------------------------------------------------------------------------
// getStatus — is a model loaded?
// ---------------------------------------------------------------------------
function getStatus() {
  return {
    running: proc !== null,
    port,
    modelPath: currentModelPath,
    ctxInfo: getContextInfo(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emit an IPC event to ALL renderer windows (main + chat panel) */
function emit(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

// ---------------------------------------------------------------------------
// singleShot — non-streaming single request (used by clipboard, websocket, etc.)
// ---------------------------------------------------------------------------
// Returns the full response as a string. No SSE. No token broadcast.
// Completely isolated from the streaming chat() function.
//
async function singleShot({ systemPrompt, userMessage, maxTokens, temperature }) {
  if (!proc || !port) {
    throw new Error('llama-server is not running. Load a model first.');
  }

  // 🔒 Validate
  if (!userMessage || typeof userMessage !== 'string') {
    throw new Error('userMessage is required');
  }
  if (userMessage.length > 500000) {
    throw new Error('userMessage exceeds 500,000 character limit');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: String(systemPrompt) });
  }
  messages.push({ role: 'user', content: userMessage });

  const body = JSON.stringify({
    model: 'local',
    messages,
    stream: false,
    temperature: temperature ?? 0.4,
    max_tokens: maxTokens ?? 1024,
    top_p: 0.9,
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
          // 🔒 Cap at 1 MB
          if (responseBody.length > 1024 * 1024) {
            req.destroy();
            reject(new Error('LLM response exceeded 1 MB'));
          }
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(
              `llama-server returned ${res.statusCode}: ${responseBody.slice(0, 200)}`
            ));
            return;
          }
          try {
            const parsed = JSON.parse(responseBody);
            const content = parsed.choices?.[0]?.message?.content;
            if (!content) {
              reject(new Error('LLM response missing content field'));
              return;
            }
            resolve(content.trim());
          } catch (err) {
            reject(new Error(`Failed to parse LLM response: ${err.message}`));
          }
        });

        res.on('error', (err) => {
          reject(new Error(`LLM response error: ${err.message}`));
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`LLM request failed: ${err.message}`));
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Single-shot LLM call timed out after 120 seconds'));
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  initLlama,
  selectBinary,
  start,
  chat,
  singleShot,
  stop,
  kill,
  getContextInfo,
  getStatus,
};
