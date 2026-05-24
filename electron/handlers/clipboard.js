// electron/handlers/clipboard.js — Clipboard AI (PRD Feature 4)
// Monitors clipboard for changes, processes 7 AI actions, auto-paste result.
//
// Architecture:
//   - Polling-based clipboard monitoring (500ms interval)
//   - Single-shot non-streaming LLM calls (does NOT use llama.js chat/emit)
//   - Direct HTTP to llama-server with stream:false — no token broadcast
//   - This prevents clipboard actions from polluting active chat sessions
//   - Auto-paste via PowerShell SendKeys on Windows (graceful skip on Mac)
//   - Undo restores original clipboard text
//
// 🔒 Security:
//   - Auto-paste uses execFile (no shell) with hardcoded PowerShell path
//   - Clipboard text is never sent externally — only to localhost llama-server
//   - isProcessing flag prevents concurrent actions

const { clipboard } = require('electron');
const { execFile } = require('child_process');
const http = require('http');
const { getSystemPrompt } = require('./promptEngine');
const { getStatus: getLlamaStatus } = require('./llama');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let lastText = '';
let isProcessing = false;
let pollingInterval = null;
let _mainWindow = null;
let _onChangeCallback = null;
let lastOriginalText = null; // for undo

// ---------------------------------------------------------------------------
// startMonitoring — begin polling the clipboard every 500ms
// ---------------------------------------------------------------------------
function startMonitoring(mainWindow, onChangeCallback) {
  _mainWindow = mainWindow;
  _onChangeCallback = onChangeCallback || null;

  // Read initial clipboard so we don't trigger on existing content
  lastText = clipboard.readText() || '';

  pollingInterval = setInterval(() => {
    if (isProcessing) return;

    try {
      const current = clipboard.readText();
      if (!current) return;

      // Only trigger if text actually changed and has meaningful content
      if (current !== lastText && current.trim().length > 5) {
        lastText = current;
        emit('clipboard:changed', {
          text: current,
          preview: current.slice(0, 100), // first 100 chars for indicator
          charCount: current.length,
        });
        // Notify main process (e.g. to show indicator overlay)
        if (_onChangeCallback) _onChangeCallback(current);
      }
    } catch (_err) {
      // clipboard.readText can throw on some platforms — ignore
    }
  }, 500);

  console.log('[clipboard] Monitoring started (500ms polling).');
}

// ---------------------------------------------------------------------------
// stopMonitoring — stop polling
// ---------------------------------------------------------------------------
function stopMonitoring() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[clipboard] Monitoring stopped.');
  }
}

// ---------------------------------------------------------------------------
// handleClipboardAction — run one of the 7 AI actions on clipboard text
// ---------------------------------------------------------------------------
// Actions: clipboard-improve, clipboard-shorten, clipboard-formal,
//          clipboard-casual, clipboard-translate, clipboard-explain,
//          clipboard-continue
//
async function handleClipboardAction(action, text, options = {}) {
  // 🔒 Validate inputs
  if (!action || typeof action !== 'string') {
    throw new Error('Invalid clipboard action');
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('No text to process');
  }
  if (text.length > 50000) {
    throw new Error('Clipboard text exceeds 50,000 character limit');
  }

  // Validate action is one of the known clipboard modes
  const validActions = [
    'clipboard-improve', 'clipboard-shorten', 'clipboard-formal',
    'clipboard-casual', 'clipboard-translate', 'clipboard-explain',
    'clipboard-continue',
  ];
  if (!validActions.includes(action)) {
    throw new Error(`Unknown clipboard action: ${action}`);
  }

  // Check if model is running
  const llamaStatus = getLlamaStatus();
  if (!llamaStatus.running || !llamaStatus.port) {
    throw new Error('No AI model is loaded. Open Anton AI and load a model first.');
  }

  // Prevent concurrent actions
  if (isProcessing) {
    throw new Error('A clipboard action is already in progress');
  }

  isProcessing = true;

  // Store original for undo
  const originalText = text;
  lastOriginalText = originalText;

  try {
    // Get the system prompt for this action
    const promptOptions = {};
    if (action === 'clipboard-translate' && options.translateLanguage) {
      promptOptions.language = options.translateLanguage;
    }
    const systemPrompt = getSystemPrompt(action, promptOptions);

    // Emit processing state to renderer
    emit('clipboard:processing', { action, charCount: text.length });

    // Single-shot non-streaming LLM call
    const result = await singleShotLLM(
      llamaStatus.port,
      systemPrompt,
      text,
      {
        temperature: 0.4,     // low temp for deterministic transformations
        maxTokens: 1024,
      }
    );

    if (!result || result.trim().length === 0) {
      throw new Error('AI returned an empty result');
    }

    // Write result to clipboard
    clipboard.writeText(result);
    lastText = result; // update lastText so monitoring doesn't re-trigger

    // Auto-paste if enabled
    if (options.autopasteEnabled) {
      await autoPaste();
    }

    // Emit success to renderer
    emit('clipboard:result', {
      action,
      result,
      originalText,
      preview: result.slice(0, 200),
    });

    console.log(`[clipboard] Action '${action}' complete. ${text.length} → ${result.length} chars.`);

    return {
      success: true,
      result,
      originalText,
    };
  } catch (err) {
    emit('clipboard:error', {
      action,
      error: err.message,
    });
    throw err;
  } finally {
    // 🔒 Always reset — even on error
    isProcessing = false;
  }
}

// ---------------------------------------------------------------------------
// singleShotLLM — non-streaming HTTP call to llama-server
// ---------------------------------------------------------------------------
// This is separate from llama.js chat() which streams and broadcasts.
// We use stream:false and parse the complete JSON response.
// No tokens are emitted to any window — completely silent.
//
function singleShotLLM(port, systemPrompt, userText, params = {}) {
  return new Promise((resolve, reject) => {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ];

    const body = JSON.stringify({
      model: 'local',
      messages,
      stream: false,          // ← KEY: no streaming, no token broadcast
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens ?? 1024,
      top_p: 0.9,
    });

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
          // 🔒 Cap response at 1 MB
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
          reject(new Error(`LLM response stream error: ${err.message}`));
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`LLM request failed: ${err.message}`));
    });

    // 60-second timeout — clipboard actions should be fast
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Clipboard action timed out after 60 seconds'));
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// autoPaste — send Ctrl+V to the previously focused window (Windows only)
// ---------------------------------------------------------------------------
async function autoPaste() {
  if (process.platform !== 'win32') {
    // macOS/Linux: skip silently — user pastes manually
    // Clipboard already contains the result
    console.log('[clipboard] Auto-paste skipped (not Windows).');
    return;
  }

  return new Promise((resolve) => {
    // 🔒 Using execFile (no shell) with hardcoded PowerShell path
    // The command is entirely hardcoded — no user input in the arguments
    const psPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const psCommand = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")';

    execFile(
      psPath,
      ['-NoProfile', '-NonInteractive', '-Command', psCommand],
      { timeout: 5000, shell: false },
      (err) => {
        if (err) {
          console.warn('[clipboard] Auto-paste failed:', err.message);
        } else {
          console.log('[clipboard] Auto-pasted via SendKeys.');
        }
        // Always resolve — auto-paste failure is non-fatal
        resolve();
      }
    );
  });
}

// ---------------------------------------------------------------------------
// undoClipboard — restore the original clipboard text
// ---------------------------------------------------------------------------
function undoClipboard(originalText) {
  // 🔒 Validate input
  if (!originalText || typeof originalText !== 'string') {
    // Fall back to last stored original if available
    if (lastOriginalText) {
      clipboard.writeText(lastOriginalText);
      lastText = lastOriginalText; // update so monitor doesn't re-trigger
      return { success: true, restored: true };
    }
    return { success: false, error: 'No original text to restore' };
  }

  clipboard.writeText(originalText);
  lastText = originalText;
  return { success: true, restored: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emit an IPC event to all renderer windows */
function emit(channel, data) {
  const { BrowserWindow } = require('electron');
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  startMonitoring,
  stopMonitoring,
  handleClipboardAction,
  undoClipboard,
};
