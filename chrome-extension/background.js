// Browser Control MCP — Chrome Extension Background Service Worker
// Connects to the MCP WebSocket server on localhost:9999

const WS_URL = 'ws://127.0.0.1:9999';
const MAX_BACKOFF_MS = 30_000;
const KEEPALIVE_INTERVAL_MS = 20_000;

let ws = null;
let reconnectDelay = 1000;
let reconnectTimer = null;
let keepaliveTimer = null;

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log('[BrowserControlMCP] Connecting to', WS_URL);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[BrowserControlMCP] Connected to MCP server');
    reconnectDelay = 1000;
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'keepalive' }));
      }
    }, KEEPALIVE_INTERVAL_MS);
  };

  ws.onmessage = async (event) => {
    let request;
    try {
      request = JSON.parse(event.data);
    } catch {
      console.error('[BrowserControlMCP] Failed to parse message:', event.data);
      return;
    }

    const { id, action, payload } = request;
    let response;

    try {
      response = await handleAction(action, payload);
      ws.send(JSON.stringify({ id, success: true, data: response }));
    } catch (error) {
      ws.send(JSON.stringify({
        id,
        success: false,
        error: { code: 'ACTION_FAILED', message: error.message ?? String(error) }
      }));
    }
  };

  ws.onclose = () => {
    console.log('[BrowserControlMCP] Disconnected. Reconnecting in', reconnectDelay, 'ms');
    ws = null;
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error('[BrowserControlMCP] WebSocket error:', error);
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_BACKOFF_MS);
    connect();
  }, reconnectDelay);
}

async function handleAction(action, payload) {
  switch (action) {
    case 'take_screenshot': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) throw new Error('No active tab found');
      const dataUrl = await chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' });
      return { dataUrl };
    }

    case 'get_url': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab found');
      return { url: tabs[0].url ?? '' };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Start connecting immediately
connect();
