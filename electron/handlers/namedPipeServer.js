// electron/handlers/namedPipeServer.js — Windows Named Pipe server (PRD Feature 8)
// Listens on \\.\pipe\antonai_context for messages from the Shell Extension DLL.
// Receives: { action: string, text: string } JSON payloads.
// Processes via llama.singleShot() and writes result to clipboard.
//
// Architecture:
//   Shell Extension DLL → writes JSON to pipe → this server reads it
//   → calls singleShot() → writes result to clipboard → shows toast via IPC
//
// 🔒 Security:
//   - Named pipe is local-only (\\.\pipe\ prefix)
//   - Action validated against whitelist
//   - Text capped at 50,000 chars
//   - Only runs on Windows (graceful no-op on macOS/Linux)

const net = require('net');
const { clipboard } = require('electron');
const { singleShot, getStatus: getLlamaStatus } = require('./llama');
const { getSystemPrompt } = require('./promptEngine');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PIPE_NAME = '\\\\.\\pipe\\antonai_context';
const MAX_TEXT_LENGTH = 50000;

const VALID_ACTIONS = new Set([
  'clipboard-improve',
  'clipboard-shorten',
  'clipboard-formal',
  'clipboard-explain',
  'clipboard-translate',
]);

// ---------------------------------------------------------------------------
// NamedPipeServer
// ---------------------------------------------------------------------------
class NamedPipeServer {
  constructor() {
    this.server = null;
  }

  // -------------------------------------------------------------------------
  // start — create the named pipe server (Windows only)
  // -------------------------------------------------------------------------
  start() {
    if (process.platform !== 'win32') {
      console.log('[pipe] Skipping named pipe server — not Windows.');
      return;
    }

    try {
      this.server = net.createServer((stream) => {
        let data = '';

        stream.on('data', (chunk) => {
          data += chunk.toString('utf8');

          // 🔒 Cap incoming data
          if (data.length > MAX_TEXT_LENGTH + 1024) {
            console.warn('[pipe] Incoming data too large — disconnecting.');
            stream.destroy();
            return;
          }
        });

        stream.on('end', () => {
          this.handleMessage(data);
        });

        stream.on('error', (err) => {
          console.warn('[pipe] Stream error:', err.message);
        });
      });

      this.server.listen(PIPE_NAME, () => {
        console.log(`[pipe] Named pipe server listening on ${PIPE_NAME}`);
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error('[pipe] Pipe already in use — another Anton AI instance may be running.');
        } else {
          console.error('[pipe] Server error:', err.message);
        }
      });
    } catch (err) {
      console.error('[pipe] Failed to start named pipe server:', err.message);
    }
  }

  // -------------------------------------------------------------------------
  // handleMessage — parse JSON and process the action
  // -------------------------------------------------------------------------
  async handleMessage(rawData) {
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch (_err) {
      console.warn('[pipe] Invalid JSON received:', rawData.slice(0, 100));
      return;
    }

    const { action, text } = msg;

    // 🔒 Validate action
    if (!action || typeof action !== 'string' || !VALID_ACTIONS.has(action)) {
      console.warn(`[pipe] Unknown action: ${action}`);
      return;
    }

    // 🔒 Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('[pipe] Empty or missing text.');
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      console.warn(`[pipe] Text too long: ${text.length} chars (max ${MAX_TEXT_LENGTH}).`);
      return;
    }

    // Check model is running
    const llamaStatus = getLlamaStatus();
    if (!llamaStatus.running) {
      console.warn('[pipe] No model loaded — cannot process shell extension action.');
      this.emitToast('error', 'No AI model loaded. Open Anton AI and load a model.');
      return;
    }

    console.log(`[pipe] Processing action: ${action} (${text.length} chars)`);

    try {
      // Get system prompt for this action
      const systemPrompt = getSystemPrompt(action);

      // Process via non-streaming LLM call
      const result = await singleShot({
        systemPrompt,
        userMessage: text,
        maxTokens: 1024,
        temperature: 0.4,
      });

      if (!result || result.trim().length === 0) {
        this.emitToast('error', 'AI returned an empty result.');
        return;
      }

      // Write result to clipboard
      clipboard.writeText(result);

      // Notify the UI via IPC
      this.emitToast('success', 'Clipboard updated — press Ctrl+V to paste.');

      console.log(`[pipe] Action '${action}' complete. Result: ${result.length} chars.`);
    } catch (err) {
      console.error(`[pipe] Action '${action}' failed:`, err.message);
      this.emitToast('error', `Action failed: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // emitToast — send a notification to all renderer windows
  // -------------------------------------------------------------------------
  emitToast(variant, message) {
    try {
      const { BrowserWindow } = require('electron');
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('shell:toast', { variant, message });
        }
      }
    } catch (_err) {
      // Non-critical — toast just won't show
    }
  }

  // -------------------------------------------------------------------------
  // stop — close the named pipe server
  // -------------------------------------------------------------------------
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('[pipe] Named pipe server stopped.');
      });
      this.server = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
const pipeServer = new NamedPipeServer();

module.exports = { pipeServer };
