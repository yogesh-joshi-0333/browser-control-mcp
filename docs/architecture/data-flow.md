# Browser Control MCP — Data Flow
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## 1. Connection Lifecycle

### 1a. MCP Server Startup

```
Developer                MCP Server              Claude Code
    |                        |                        |
    | npm start              |                        |
    |----------------------->|                        |
    |                        | Start WebSocket server  |
    |                        | bind 127.0.0.1:9999    |
    |                        |                        |
    |                        | Register MCP tools     |
    |                        | via stdio              |
    |                        |----------------------->|
    |                        |                        | Tools available:
    |                        |                        | browser_status
    |                        |                        | browser_screenshot
    |                        |                        | browser_get_url
    |                        |                        |
```

### 1b. Chrome Extension Connection

```
Chrome Browser          Extension BG            MCP Server
    |                       |                       |
    | Browser starts        |                       |
    |---------------------->|                       |
    |                       | new WebSocket(        |
    |                       |  "ws://127.0.0.1:9999")|
    |                       |----------------------->|
    |                       |                       | Validate origin
    |                       |                       | (extension ID)
    |                       |                       |
    |                       |<-- WS Connected -------|
    |                       |                       |
    |                       | Send: { type: "hello",|
    |                       |  extensionId: "..." } |
    |                       |----------------------->|
    |                       |                       | Log: Extension connected
    |                       |                       |
```

### 1c. Heartbeat (every 30 seconds)

```
MCP Server              Extension BG
    |                       |
    | WS ping               |
    |----------------------->|
    |<-- WS pong ------------|
    |                       |
    | (if no pong in 5s:    |
    |  mark disconnected)   |
```

### 1d. Reconnect Flow

```
Extension BG            MCP Server
    |                       |
    | WS drops              |
    |<-- disconnect ---------|
    |                       |
    | Wait 1s               |
    | Retry connect         |
    |----------------------->|
    |                       | (if fails: wait 2s, 4s, 8s... max 30s)
    |<-- WS Connected -------|
```

---

## 2. browser_screenshot — Extension Mode

```
Claude            MCP Server         Extension BG        Content Script      Chrome Tab
  |                   |                   |                    |                  |
  | call               |                   |                   |                  |
  | browser_screenshot |                   |                   |                  |
  |------------------>|                   |                   |                  |
  |                   | Prompt mode?      |                   |                  |
  |<-- "Extension or  |                   |                   |                  |
  |     Headless?" ---|                   |                   |                  |
  | Select Extension  |                   |                   |                  |
  |------------------>|                   |                   |                  |
  |                   | Check: ext        |                   |                  |
  |                   | connected? Yes    |                   |                  |
  |                   |                   |                   |                  |
  |                   | WS send:          |                   |                  |
  |                   | { id, action:     |                   |                  |
  |                   |  "take_screenshot"}|                   |                  |
  |                   |------------------>|                   |                  |
  |                   |                   | chrome.tabs.      |                  |
  |                   |                   | captureVisibleTab()|                 |
  |                   |                   |------------------------------------->|
  |                   |                   |<---- base64 PNG ----------------------|
  |                   |                   |                   |                  |
  |                   |                   | chrome.tabs.query |                  |
  |                   |                   | (get URL)         |                  |
  |                   |                   |------------------------------------->|
  |                   |                   |<---- URL string ----------------------|
  |                   |                   |                   |                  |
  |                   | WS receive:       |                   |                  |
  |                   | { id, success:true|                   |                  |
  |                   |   data: {image,   |                   |                  |
  |                   |   url} }          |                   |                  |
  |                   |<------------------|                   |                  |
  |                   |                   |                   |                  |
  |<-- tool result ---|                   |                   |                  |
  | { image, url,     |                   |                   |                  |
  |   mode:"extension"}                   |                   |                  |
```

---

## 3. browser_screenshot — Headless Mode (New Session)

```
Claude            MCP Server              Puppeteer
  |                   |                       |
  | call               |                       |
  | browser_screenshot |                       |
  |------------------>|                       |
  |                   | Prompt mode?          |
  |<-- "Extension or  |                       |
  |     Headless?" ---|                       |
  | Select Headless   |                       |
  |------------------>|                       |
  |                   | No sessionId given    |
  |                   | → launch new browser  |
  |                   |----------------------->|
  |                   |                       | puppeteer.launch()
  |                   |                       | sessionId = "session-a1b2c3d4"
  |                   |                       |
  |                   | page.screenshot()     |
  |                   |----------------------->|
  |                   |<-- base64 PNG ---------|
  |                   |                       |
  |                   | page.url()            |
  |                   |----------------------->|
  |                   |<-- URL string ---------|
  |                   |                       |
  |<-- tool result ---|                       |
  | { image, url,     |                       |
  |   mode:"headless",|                       |
  |   sessionId:      |                       |
  |   "session-a1b2c3d4" }                    |
```

---

## 4. browser_screenshot — Headless Mode (Reuse Session)

```
Claude            MCP Server              Puppeteer
  |                   |                       |
  | call               |                       |
  | browser_screenshot |                       |
  | sessionId:         |                       |
  | "session-a1b2c3d4"|                       |
  |------------------>|                       |
  |                   | Mode already known:   |
  |                   | Headless (sessionId   |
  |                   | provided → skip prompt)|
  |                   |                       |
  |                   | Look up session       |
  |                   | "session-a1b2c3d4"   |
  |                   | → found, reuse page  |
  |                   |                       |
  |                   | page.screenshot()     |
  |                   |----------------------->|
  |                   |<-- base64 PNG ---------|
  |                   |                       |
  |<-- tool result ---|                       |
  | { image, url,     |                       |
  |   sessionId:      |                       |
  |   "session-a1b2c3d4" }                    |
```

---

## 5. Error Flow — Extension Not Connected

```
Claude            MCP Server
  |                   |
  | call               |
  | browser_screenshot |
  |------------------>|
  |                   | Prompt mode?
  |<-- "Extension or  |
  |     Headless?" ---|
  | Select Extension  |
  |------------------>|
  |                   | Check: ext connected?
  |                   | → NO
  |                   |
  |<-- tool error ----|
  | { code: "EXTENSION_NOT_CONNECTED",
  |   message: "Chrome Extension is not connected. Open Chrome and ensure the extension is installed and enabled." }
```

---

## 6. Error Flow — WebSocket Timeout

```
Claude            MCP Server         Extension BG
  |                   |                   |
  | call               |                   |
  | browser_screenshot |                   |
  |------------------>|                   |
  |                   | WS send:          |
  |                   | { id: "req-123",  |
  |                   |   action: "take_screenshot" }
  |                   |------------------>|
  |                   |                   | (extension hangs / crashes)
  |                   |                   |
  |                   | Wait 10 seconds   |
  |                   | No response for   |
  |                   | "req-123"         |
  |                   |                   |
  |<-- tool error ----|                   |
  | { code: "TIMEOUT_ERROR",
  |   message: "Extension did not respond within 10 seconds." }
```

---

## 7. Data Format at Each Step

### MCP Server → Extension (WebSocket Request)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "take_screenshot",
  "payload": {}
}
```

### Extension → MCP Server (WebSocket Success Response)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "success": true,
  "data": {
    "image": "iVBORw0KGgoAAAANSUhEUgAA...",
    "url": "https://example.com/page"
  }
}
```

### Extension → MCP Server (WebSocket Error Response)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "success": false,
  "error": {
    "code": "TAB_CAPTURE_FAILED",
    "message": "Failed to capture visible tab: permission denied."
  }
}
```

### MCP Server → Claude (Tool Result)
```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAA...",
  "url": "https://example.com/page",
  "mode": "extension",
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```
