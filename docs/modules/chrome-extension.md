# Module: Chrome Extension
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Role

The Chrome Extension is the bridge between the MCP Server and the user's real Chrome browser tabs. It runs as a Manifest V3 extension with a persistent service worker (`background.js`) that maintains a WebSocket connection to the MCP Server. When the MCP Server sends a command (e.g. take screenshot, click element), the extension executes it on the active tab using Chrome's built-in APIs and returns the result.

---

## Technology

| Item | Technology |
|------|-----------|
| Platform | Chrome Extension Manifest V3 |
| Background | Service Worker (background.js) |
| Tab interaction | Content Script (content.js) |
| Language | JavaScript ES2022 |
| Chrome APIs used | `chrome.tabs`, `chrome.scripting`, `chrome.tabCapture` (V3) |

---

## File Structure

```
chrome-extension/
├── manifest.json    # Extension metadata, permissions, service worker declaration
├── background.js    # Service worker: WS client, message routing, Chrome API calls
└── content.js       # Injected into tabs: DOM manipulation, scroll, click, console capture
```

---

## Key Functions / Methods

| Function | File | Description |
|----------|------|-------------|
| `connectWebSocket()` | `background.js` | Opens WS connection to `ws://127.0.0.1:9999` |
| `reconnectWithBackoff()` | `background.js` | Retries connection with exponential backoff (1s → 30s max) |
| `handleMessage(msg)` | `background.js` | Routes incoming WS message to correct handler by `action` |
| `handleTakeScreenshot()` | `background.js` | `chrome.tabs.captureVisibleTab()` → returns base64 PNG |
| `handleGetUrl()` | `background.js` | `chrome.tabs.query({active:true})` → returns URL string |
| `handleClickElement(selector)` | `background.js` | Injects content script → `document.querySelector(selector).click()` |
| `handleScrollPage(params)` | `background.js` | Injects content script → `window.scrollBy()` or `element.scrollIntoView()` |
| `handleGetConsoleLogs()` | `background.js` | Returns captured console log buffer |
| `handleGetDom()` | `background.js` | Injects content script → returns `document.documentElement.outerHTML` |
| `handleTypeText(selector, text)` | `background.js` | Injects content script → sets `element.value`, dispatches `input` event |
| `handleNavigate(url)` | `background.js` | `chrome.tabs.update({url})` → waits for load event |
| `injectConsoleCapture()` | `content.js` | Overrides `console.log/warn/error/info` to buffer messages |

---

## Lifecycle

```
1. INSTALL / BROWSER STARTUP
   - Service worker (background.js) starts
   - connectWebSocket() called → ws://127.0.0.1:9999
   - If connection fails → reconnectWithBackoff()

2. NORMAL OPERATION
   - WS receives message: { id, action, payload }
   - handleMessage() routes to correct handler
   - Handler executes Chrome API or injects content.js
   - Result sent back: { id, success: true, data: {...} }

3. HEARTBEAT
   - Server sends WS ping every 30s
   - Extension responds with WS pong immediately
   - No response = server marks disconnected

4. RECONNECT
   - WS close event received
   - Wait 1s, retry
   - If fail: wait 2s, 4s, 8s, 16s, 30s (cap)
   - Continues retrying indefinitely

5. CHROME CLOSES
   - Service worker is terminated by Chrome
   - On next Chrome start → service worker restarts → reconnects
```

---

## Dependencies on Other Modules

| Module | Used For |
|--------|---------|
| [websocket-bridge](./websocket-bridge.md) | Receiving commands from MCP Server |
| [mcp-server](./mcp-server.md) | Command source and result destination |

---

## Error Handling

- If `chrome.tabs.captureVisibleTab` fails → send `{ success: false, error: { code: "TAB_CAPTURE_FAILED", message: "..." } }`
- If `document.querySelector` returns null → send `{ success: false, error: { code: "ELEMENT_NOT_FOUND", message: "..." } }`
- All Chrome API calls wrapped in try/catch
- Service worker cannot store state across restarts — WS connection always re-established fresh

---

## Manifest Permissions by Version

| Permission | V1 | V2 | V3 |
|------------|----|----|-----|
| `tabs` | ✅ | ✅ | ✅ |
| `activeTab` | ✅ | ✅ | ✅ |
| `scripting` | | ✅ | ✅ |
| `tabCapture` | | | ✅ |
