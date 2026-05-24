// electron/handlers/websocketServer.js — WebSocket server for browser extension (PRD Feature 6+7)
// Listens on 127.0.0.1:58000 for connections from the Chrome/Edge extension.
// Handles: email actions (reply, fix, expand, summarise), text enhance, page summarise.
//
// Architecture:
//   - WebSocket server bound to localhost ONLY — never exposed to network
//   - Origin header validated against allowed chrome-extension:// origins
//   - All AI calls use llama.singleShot() (non-streaming, isolated from chat)
//   - Each message is { action, payload } → response is { action, result, success }
//
// 🔒 Security:
//   - Only connections from whitelisted chrome-extension:// origins accepted
//   - All other origins immediately disconnected (code 1008)
//   - Payload text sizes capped per action
//   - No arbitrary prompt injection — system prompts come from promptEngine only
//   - Port 58000 is localhost-only (host: '127.0.0.1')

const { getSystemPrompt } = require('./promptEngine');
const { singleShot, getStatus: getLlamaStatus } = require('./llama');

// ---------------------------------------------------------------------------
// Valid actions whitelist
// ---------------------------------------------------------------------------
const VALID_ACTIONS = new Set([
  'email:reply', 'email:fix', 'email:expand', 'email:summarise', 'email:subjects',
  'text:enhance',
  'page:summarise',
  'ping',
]);

// Valid text:enhance sub-actions
const VALID_ENHANCE_MODES = new Set([
  'improve', 'shorten', 'formal', 'casual', 'translate', 'explain',
]);

// ---------------------------------------------------------------------------
// WebSocketServer
// ---------------------------------------------------------------------------
class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();

    // 🔒 Real extension IDs — can be updated via Settings if user reinstalls
    this.allowedOrigins = new Set([
      'chrome-extension://hhkmgifjhchlkcjiamfijndoaiklempb',
      // Edge extension ID — add after publishing to Edge Add-ons
    ]);
  }

  // -------------------------------------------------------------------------
  // start — bind to 127.0.0.1:58000
  // -------------------------------------------------------------------------
  start() {
    const WebSocket = require('ws');

    this.wss = new WebSocket.Server({
      host: '127.0.0.1',  // 🔒 localhost only — never exposed to LAN/internet
      port: 58000,
    });

    this.wss.on('connection', (ws, req) => {
      // 🔒 Validate origin header
      const origin = req.headers.origin || '';
      if (!this.allowedOrigins.has(origin)) {
        console.warn(`[ws] Rejected connection from unauthorized origin: ${origin}`);
        ws.close(1008, 'Unauthorized origin');
        return;
      }

      console.log(`[ws] Extension connected: ${origin}`);
      this.clients.add(ws);

      ws.on('message', async (rawMsg) => {
        let msg;
        try {
          msg = JSON.parse(rawMsg.toString());
        } catch (_err) {
          ws.send(JSON.stringify({ action: null, error: 'Invalid JSON', success: false }));
          return;
        }

        try {
          const result = await this.handleMessage(msg);
          ws.send(JSON.stringify({
            id: msg.id || null, // echo request ID for correlation
            action: msg.action,
            result,
            success: true,
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            id: msg.id || null,
            action: msg.action,
            error: err.message,
            success: false,
          }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[ws] Extension disconnected.');
      });

      ws.on('error', (err) => {
        this.clients.delete(ws);
        console.warn('[ws] Client error:', err.message);
      });
    });

    this.wss.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('[ws] Port 58000 already in use — WebSocket server not started.');
      } else {
        console.error('[ws] Server error:', err.message);
      }
    });

    console.log('[ws] WebSocket server started on 127.0.0.1:58000');
  }

  // -------------------------------------------------------------------------
  // handleMessage — route action to the right handler
  // -------------------------------------------------------------------------
  async handleMessage(msg) {
    const { action, payload } = msg || {};

    // 🔒 Validate action is in the whitelist
    if (!action || typeof action !== 'string') {
      throw new Error('Missing or invalid action');
    }
    if (!VALID_ACTIONS.has(action)) {
      throw new Error(`Unknown action: ${action}`);
    }

    // Check model is running
    if (action !== 'ping') {
      const status = getLlamaStatus();
      if (!status.running) {
        throw new Error('No AI model is loaded. Open Anton AI and load a model first.');
      }
    }

    // 🔒 Validate payload exists for non-ping actions
    if (action !== 'ping' && (!payload || typeof payload !== 'object')) {
      throw new Error('Missing payload');
    }

    switch (action) {
      case 'ping':
        return { status: 'connected', model: getLlamaStatus().modelPath || null };

      case 'email:reply':
        return await this.handleEmailReply(payload);

      case 'email:fix':
        return await this.handleEmailFix(payload);

      case 'email:expand':
        return await this.handleEmailExpand(payload);

      case 'email:summarise':
        return await this.handleEmailSummarise(payload);

      case 'email:subjects':
        return await this.handleEmailSubjects(payload);

      case 'text:enhance':
        return await this.handleTextEnhance(payload);

      case 'page:summarise':
        return await this.handlePageSummarise(payload);

      default:
        throw new Error(`Unhandled action: ${action}`);
    }
  }

  // -------------------------------------------------------------------------
  // Email handlers
  // -------------------------------------------------------------------------

  async handleEmailReply(payload) {
    validateString(payload.emailText, 'emailText', 30000);
    const subject = typeof payload.subject === 'string' ? payload.subject.slice(0, 500) : '';

    return await singleShot({
      systemPrompt: getSystemPrompt('email-reply'),
      userMessage: `Subject: ${subject}\n\n${payload.emailText}`,
      maxTokens: 800,
      temperature: 0.6,
    });
  }

  async handleEmailFix(payload) {
    validateString(payload.emailText, 'emailText', 15000);

    return await singleShot({
      systemPrompt: getSystemPrompt('email-fix'),
      userMessage: payload.emailText,
      maxTokens: 600,
      temperature: 0.3,
    });
  }

  async handleEmailExpand(payload) {
    validateString(payload.bullets, 'bullets', 5000);

    return await singleShot({
      systemPrompt: getSystemPrompt('email-expand'),
      userMessage: payload.bullets,
      maxTokens: 500,
      temperature: 0.5,
    });
  }

  async handleEmailSummarise(payload) {
    validateString(payload.threadText, 'threadText', 50000);

    return await singleShot({
      systemPrompt: getSystemPrompt('email-summarise'),
      userMessage: payload.threadText,
      maxTokens: 400,
      temperature: 0.3,
    });
  }

  async handleEmailSubjects(payload) {
    validateString(payload.emailText, 'emailText', 15000);

    return await singleShot({
      systemPrompt: getSystemPrompt('email-subjects'),
      userMessage: payload.emailText,
      maxTokens: 200,
      temperature: 0.6,
    });
  }

  // -------------------------------------------------------------------------
  // Text enhance (universal text enhancer on any input field)
  // -------------------------------------------------------------------------

  async handleTextEnhance(payload) {
    validateString(payload.text, 'text', 20000);

    // 🔒 Validate sub-action against whitelist
    if (!payload.mode || !VALID_ENHANCE_MODES.has(payload.mode)) {
      throw new Error(
        `Invalid enhance mode: '${payload.mode}'. ` +
        `Valid: ${[...VALID_ENHANCE_MODES].join(', ')}`
      );
    }

    const promptMode = `clipboard-${payload.mode}`;

    return await singleShot({
      systemPrompt: getSystemPrompt(promptMode),
      userMessage: payload.text,
      maxTokens: 400,
      temperature: 0.4,
    });
  }

  // -------------------------------------------------------------------------
  // Page summarise (Readability-extracted page content)
  // -------------------------------------------------------------------------

  async handlePageSummarise(payload) {
    validateString(payload.pageText, 'pageText', 100000);

    // 🔒 Truncate to 8000 chars — limits context usage for page summaries
    const truncatedText = payload.pageText.slice(0, 8000);

    return await singleShot({
      systemPrompt: getSystemPrompt('doc-summarise'),
      userMessage: truncatedText,
      maxTokens: 500,
      temperature: 0.3,
    });
  }

  // -------------------------------------------------------------------------
  // stop — close the WebSocket server
  // -------------------------------------------------------------------------
  stop() {
    if (this.wss) {
      // Close all client connections
      for (const client of this.clients) {
        try {
          client.close(1001, 'Server shutting down');
        } catch (_err) {
          // ignore
        }
      }
      this.clients.clear();

      this.wss.close(() => {
        console.log('[ws] WebSocket server stopped.');
      });
      this.wss = null;
    }
  }

  // -------------------------------------------------------------------------
  // updateAllowedOrigins — called from Settings when user enters extension IDs
  // -------------------------------------------------------------------------
  updateAllowedOrigins(chromeId, edgeId) {
    this.allowedOrigins.clear();

    if (chromeId && typeof chromeId === 'string' && chromeId.length > 5) {
      this.allowedOrigins.add(`chrome-extension://${chromeId}`);
    }
    if (edgeId && typeof edgeId === 'string' && edgeId.length > 5) {
      this.allowedOrigins.add(`chrome-extension://${edgeId}`);
    }

    console.log(`[ws] Updated allowed origins: ${[...this.allowedOrigins].join(', ')}`);
  }

  // -------------------------------------------------------------------------
  // getConnectionCount — for Settings UI status display
  // -------------------------------------------------------------------------
  getConnectionCount() {
    return this.clients.size;
  }
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Validate that a payload field is a non-empty string within a max length.
 * 🔒 Prevents arbitrary-length text injection.
 */
function validateString(value, fieldName, maxLength) {
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing or invalid field: ${fieldName}`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} is empty`);
  }
  if (value.length > maxLength) {
    throw new Error(`${fieldName} exceeds ${maxLength.toLocaleString()} character limit`);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
const wsServer = new WebSocketServer();

module.exports = { wsServer };
