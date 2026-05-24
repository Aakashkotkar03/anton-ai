// extension/background/service_worker.js — Manifest V3 service worker
// Manages one persistent WebSocket connection to Anton AI on localhost:58000.
// Routes messages between content scripts and the desktop app.
//
// 🔒 Security:
//   - Connects only to ws://127.0.0.1:58000 (localhost)
//   - Uses request IDs for message correlation (prevents cross-tab response leaks)
//   - Reconnects automatically every 5 seconds if disconnected

let ws = null;
let isConnected = false;
let requestCounter = 0;
const pendingRequests = new Map(); // id → { resolve, reject, timer }

// ---------------------------------------------------------------------------
// WebSocket connection management
// ---------------------------------------------------------------------------

function connect() {
  try {
    ws = new WebSocket('ws://127.0.0.1:58000');
  } catch (_err) {
    isConnected = false;
    updateIcon('disconnected');
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    isConnected = true;
    updateIcon('connected');
    console.log('[antonai] Connected to desktop app.');

    // Send ping to verify model status
    sendToApp({ action: 'ping' }).catch(() => {});
  };

  ws.onclose = () => {
    isConnected = false;
    updateIcon('disconnected');
    rejectAllPending('Connection lost');
    scheduleReconnect();
  };

  ws.onerror = () => {
    isConnected = false;
    updateIcon('disconnected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const id = data.id;

      // Route response to the correct pending request
      if (id && pendingRequests.has(id)) {
        const { resolve, reject, timer } = pendingRequests.get(id);
        clearTimeout(timer);
        pendingRequests.delete(id);

        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error || 'Unknown error'));
        }
      }
    } catch (err) {
      console.warn('[antonai] Failed to parse WS message:', err);
    }
  };
}

function scheduleReconnect() {
  setTimeout(() => {
    if (!isConnected) {
      console.log('[antonai] Reconnecting...');
      connect();
    }
  }, 5000);
}

function rejectAllPending(reason) {
  for (const [id, { reject, timer }] of pendingRequests) {
    clearTimeout(timer);
    reject(new Error(reason));
  }
  pendingRequests.clear();
}

// ---------------------------------------------------------------------------
// Send a message to the desktop app and wait for response
// ---------------------------------------------------------------------------

function sendToApp(payload, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Anton AI is not running. Open the desktop app first.'));
      return;
    }

    const id = `ext_${++requestCounter}_${Date.now()}`;

    // Timeout for this request
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timed out after ' + (timeoutMs / 1000) + 's'));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });

    ws.send(JSON.stringify({ ...payload, id }));
  });
}

// ---------------------------------------------------------------------------
// Update toolbar icon
// ---------------------------------------------------------------------------

function updateIcon(status) {
  const path = status === 'connected'
    ? { 16: 'icons/icon16.png', 48: 'icons/icon48.png' }
    : { 16: 'icons/icon16_grey.png', 48: 'icons/icon48_grey.png' };

  chrome.action.setIcon({ path }).catch(() => {});

  chrome.action.setTitle({
    title: status === 'connected'
      ? 'Anton AI — Connected'
      : 'Anton AI — Open the app to connect',
  });
}

// ---------------------------------------------------------------------------
// Message routing — content scripts and popup talk to us via chrome.runtime
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'antonai:getStatus') {
    sendResponse({ connected: isConnected });
    return false; // synchronous
  }

  if (msg.type === 'antonai:request') {
    if (!isConnected) {
      sendResponse({ success: false, error: 'Anton AI is not running.' });
      return false;
    }

    // Forward to desktop app via WebSocket
    sendToApp(msg.payload)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    return true; // async response
  }

  return false;
});

// ---------------------------------------------------------------------------
// Start connection
// ---------------------------------------------------------------------------
connect();
