// Browser Control MCP — Chrome Extension Background Service Worker
// Connects to the MCP WebSocket server on localhost:9999

const WS_URL = 'ws://127.0.0.1:9999';
const MAX_BACKOFF_MS = 30_000;
const KEEPALIVE_INTERVAL_MS = 20_000;

let ws = null;
let reconnectDelay = 1000;
let reconnectTimer = null;
let keepaliveTimer = null;
let lastTabId = null; // last tab MCP worked on

// Get the tab MCP should operate on:
// 1. Use lastTabId if still valid
// 2. Fall back to active tab in the focused normal window
async function getWorkingTab() {
  if (lastTabId !== null) {
    try {
      const tab = await chrome.tabs.get(lastTabId);
      if (tab && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        return tab;
      }
    } catch {
      lastTabId = null;
    }
  }
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const normalWindow = windows.find(w => w.focused) ?? windows[windows.length - 1];
  if (!normalWindow?.id) throw new Error('No normal browser window found');
  const tabs = await chrome.tabs.query({ active: true, windowId: normalWindow.id });
  if (!tabs[0]) throw new Error('No active tab found');
  lastTabId = tabs[0].id;
  return tabs[0];
}

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
      const tab = await getWorkingTab();
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      await new Promise(resolve => setTimeout(resolve, 150));
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return { dataUrl };
    }

    case 'get_url': {
      const tab = await getWorkingTab();
      return { url: tab.url ?? '' };
    }

    case 'navigate': {
      const { url } = payload;
      if (!url) throw new Error('url is required');
      // Find existing tab with matching URL (exact or same origin)
      const allTabs = await chrome.tabs.query({});
      const existing = allTabs.find(t => t.url && (t.url === url || t.url.startsWith(new URL(url).origin)));
      if (existing) {
        // Just activate it
        await chrome.tabs.update(existing.id, { active: true });
        await chrome.windows.update(existing.windowId, { focused: true });
        lastTabId = existing.id;
        return { url: existing.url ?? url };
      }
      // Not found — navigate the last working tab (or active)
      const tab = await getWorkingTab();
      await chrome.tabs.update(tab.id, { url });
      await new Promise(resolve => setTimeout(resolve, 1500));
      const updated = await chrome.tabs.get(tab.id);
      lastTabId = tab.id;
      return { url: updated.url ?? url };
    }

    case 'click_element': {
      const { selector } = payload;
      if (!selector) throw new Error('selector is required');
      const clickTab = await getWorkingTab();
      const clickResults = await chrome.scripting.executeScript({
        target: { tabId: clickTab.id },
        func: (sel) => {
          const el = document.querySelector(sel);
          if (!el) throw new Error(`Element not found: ${sel}`);
          el.click();
          return { success: true };
        },
        args: [selector]
      });
      return clickResults[0].result;
    }

    case 'scroll_page': {
      const { x = 0, y = 0, selector } = payload ?? {};
      const scrollTab = await getWorkingTab();
      const scrollResults = await chrome.scripting.executeScript({
        target: { tabId: scrollTab.id },
        func: (dx, dy, sel) => {
          // If selector given, scroll that element
          let target = sel ? document.querySelector(sel) : null;
          // Otherwise find the first scrollable element (not html/body if window doesn't scroll)
          if (!target) {
            if (document.documentElement.scrollHeight > window.innerHeight) {
              target = document.documentElement;
            } else {
              const all = Array.from(document.querySelectorAll('*'));
              target = all.find(el => {
                const s = getComputedStyle(el);
                return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
              }) || document.documentElement;
            }
          }
          target.scrollBy(dx, dy);
          return { scrollX: target.scrollLeft, scrollY: target.scrollTop };
        },
        args: [x, y, selector ?? null]
      });
      return scrollResults[0].result;
    }

    case 'type_text': {
      const { selector, text } = payload;
      if (!selector) throw new Error('selector is required');
      if (!text) throw new Error('text is required');
      const typeTab = await getWorkingTab();
      const typeResults = await chrome.scripting.executeScript({
        target: { tabId: typeTab.id },
        func: (sel, txt) => {
          const el = document.querySelector(sel);
          if (!el) throw new Error(`Element not found: ${sel}`);
          el.focus();
          for (const char of txt) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              el.value += char;
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
          }
          return { success: true };
        },
        args: [selector, text]
      });
      return typeResults[0].result;
    }

    case 'get_dom': {
      const domTab = await getWorkingTab();
      const domResults = await chrome.scripting.executeScript({
        target: { tabId: domTab.id },
        func: () => document.documentElement.outerHTML
      });
      return { dom: domResults[0].result };
    }

    case 'get_console_logs': {
      const logTab = await getWorkingTab();
      const logResults = await chrome.scripting.executeScript({
        target: { tabId: logTab.id },
        world: 'MAIN',
        func: () => {
          if (!window.__mcpConsoleLogs) {
            window.__mcpConsoleLogs = [];
            ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
              const original = console[method].bind(console);
              console[method] = (...args) => {
                window.__mcpConsoleLogs.push({
                  type: method,
                  text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
                  timestamp: new Date().toISOString()
                });
                original(...args);
              };
            });
          }
          return window.__mcpConsoleLogs;
        }
      });
      return { logs: logResults[0].result };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Start connecting immediately
connect();
