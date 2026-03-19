# Browser Control MCP — API Design
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Transport

- **Protocol:** MCP (Model Context Protocol) over stdio
- **WebSocket bridge:** `ws://127.0.0.1:9999` (MCP Server ↔ Chrome Extension)
- **Authentication:** Extension origin validation via registered Chrome Extension ID

---

## MCP Tools (Claude ↔ MCP Server)

---

### browser_select_mode

**Description:** Explicitly choose between Chrome Extension mode and headless Puppeteer mode for the current session. If Chrome Extension is connected, returns both options for the user to choose. If not connected, returns only headless.

**Input Schema:**
```json
{}
```
*(No parameters required)*

**Example Input:**
```json
{}
```

**Success Response:**
```json
{
  "extensionConnected": true,
  "options": ["extension", "headless"],
  "currentMode": null,
  "message": "Chrome Extension is connected. Choose a browser mode: 'extension' (your real Chrome) or 'headless' (background Puppeteer)."
}
```

**Error Cases:** None — this tool always returns current state and available options.

---

### browser_status

**Description:** Check whether the Chrome Extension is connected and list all active headless Puppeteer sessions.

**Input Schema:**
```json
{}
```
*(No parameters required)*

**Example Input:**
```json
{}
```

**Success Response:**
```json
{
  "extensionConnected": true,
  "headlessSessions": [
    {
      "sessionId": "session-a1b2c3d4",
      "url": "https://example.com",
      "createdAt": "2026-03-18T08:00:00.000Z"
    }
  ],
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

**Error Cases:** None — this tool always returns current state.

---

### browser_screenshot

**Description:** Capture a screenshot of the active Chrome tab (Extension mode) or a Puppeteer headless session (Headless mode). Returns base64 PNG image.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["extension", "headless"],
      "description": "Which browser mode to use"
    },
    "sessionId": {
      "type": "string",
      "description": "Headless session ID to reuse (optional — omit to create new session)"
    }
  },
  "required": ["mode"]
}
```

**Example Input (Extension mode):**
```json
{
  "mode": "extension"
}
```

**Example Input (Headless mode, reuse session):**
```json
{
  "mode": "headless",
  "sessionId": "session-a1b2c3d4"
}
```

**Success Response:**
```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAA...",
  "url": "https://example.com/page",
  "mode": "extension",
  "sessionId": null,
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

**Error Cases:**

| Error Code | Trigger |
|------------|---------|
| `EXTENSION_NOT_CONNECTED` | mode is "extension" but extension is not connected |
| `SESSION_NOT_FOUND` | sessionId provided but session does not exist |
| `TAB_CAPTURE_FAILED` | Chrome tab capture API returned error |
| `TIMEOUT_ERROR` | Extension did not respond within 10 seconds |

---

### browser_get_url

**Description:** Get the current URL of the active Chrome tab or a headless session.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["extension", "headless"]
    },
    "sessionId": {
      "type": "string",
      "description": "Headless session ID (required if mode is headless)"
    }
  },
  "required": ["mode"]
}
```

**Example Input:**
```json
{
  "mode": "extension"
}
```

**Success Response:**
```json
{
  "url": "https://example.com/page",
  "mode": "extension",
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

**Error Cases:**

| Error Code | Trigger |
|------------|---------|
| `EXTENSION_NOT_CONNECTED` | mode is "extension" but extension is not connected |
| `SESSION_NOT_FOUND` | sessionId provided but session does not exist |

---

### browser_click (V2)

**Description:** Click an element in the browser by CSS selector or page coordinates.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "mode": { "type": "string", "enum": ["extension", "headless"] },
    "sessionId": { "type": "string" },
    "selector": {
      "type": "string",
      "description": "CSS selector of the element to click"
    },
    "coordinates": {
      "type": "object",
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" }
      },
      "description": "Page coordinates to click (alternative to selector)"
    }
  },
  "required": ["mode"],
  "oneOf": [
    { "required": ["selector"] },
    { "required": ["coordinates"] }
  ]
}
```

**Example Input:**
```json
{
  "mode": "extension",
  "selector": "#submit-button"
}
```

**Success Response:**
```json
{
  "clicked": true,
  "elementText": "Submit",
  "elementTag": "button",
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

**Error Cases:**

| Error Code | Trigger |
|------------|---------|
| `ELEMENT_NOT_FOUND` | CSS selector matches no element |
| `CLICK_FAILED` | Click could not be performed (element not visible or disabled) |

---

### browser_scroll (V2)

**Description:** Scroll the page by pixel offset or scroll to a specific element.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "mode": { "type": "string", "enum": ["extension", "headless"] },
    "sessionId": { "type": "string" },
    "pixels": {
      "type": "object",
      "properties": {
        "x": { "type": "number", "default": 0 },
        "y": { "type": "number" }
      },
      "description": "Scroll by this many pixels"
    },
    "selector": {
      "type": "string",
      "description": "CSS selector to scroll into view"
    }
  },
  "required": ["mode"]
}
```

**Success Response:**
```json
{
  "scrollX": 0,
  "scrollY": 500,
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

---

### browser_console_logs (V2)

**Description:** Read JavaScript console output from the current page.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "mode": { "type": "string", "enum": ["extension", "headless"] },
    "sessionId": { "type": "string" },
    "clear": {
      "type": "boolean",
      "default": false,
      "description": "Clear the buffer after returning logs"
    }
  },
  "required": ["mode"]
}
```

**Success Response:**
```json
{
  "logs": [
    {
      "level": "error",
      "message": "TypeError: Cannot read property 'foo' of undefined",
      "timestamp": "2026-03-18T08:29:55.000Z"
    },
    {
      "level": "log",
      "message": "Component mounted",
      "timestamp": "2026-03-18T08:29:56.000Z"
    }
  ],
  "count": 2,
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

---

### browser_get_dom (V3)

**Success Response:**
```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "length": 45231,
  "url": "https://example.com",
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

---

### browser_type (V3)

**Input Schema includes:** `selector` (CSS), `text` (string to type), `clear` (boolean, clear field first)

**Success Response:**
```json
{
  "typed": true,
  "selector": "#search-input",
  "value": "hello world",
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

---

### browser_navigate (V3)

**Input Schema includes:** `url` (string), `waitFor` ("load" | "networkidle" | "domcontentloaded"), optional `sessionId`

**Success Response:**
```json
{
  "navigated": true,
  "url": "https://example.com/new-page",
  "title": "New Page Title",
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

---

### browser_record_start / browser_record_stop (V3)

**browser_record_start Success Response:**
```json
{
  "recording": true,
  "recordingId": "rec-a1b2c3d4",
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

**browser_record_stop Success Response:**
```json
{
  "recording": false,
  "recordingId": "rec-a1b2c3d4",
  "duration": 15.3,
  "frames": 459,
  "videoBase64": "AAAAIGZ0eXBNNFYg...",
  "timestamp": "2026-03-18T08:30:15.000Z"
}
```

---

### browser_visual_diff (V3)

**Input Schema includes:** `image1` (base64), `image2` (base64), `threshold` (0.0–1.0)

**Success Response:**
```json
{
  "identical": false,
  "diffPercentage": 3.2,
  "diffImage": "iVBORw0KGgoAAAANSUhEUgAA...",
  "changedRegions": [
    { "x": 100, "y": 200, "width": 300, "height": 50 }
  ],
  "timestamp": "2026-03-18T08:30:00.000Z"
}
```

---

## Standard Error Codes

| Code | Message | When |
|------|---------|------|
| `EXTENSION_NOT_CONNECTED` | "Chrome Extension is not connected. Open Chrome and ensure the extension is installed and enabled." | Extension mode selected but no WS connection |
| `SESSION_NOT_FOUND` | "Headless session '{sessionId}' does not exist. Call browser_screenshot with mode=headless to create a new session." | Invalid sessionId |
| `TIMEOUT_ERROR` | "Extension did not respond within 10 seconds." | WS timeout |
| `TAB_CAPTURE_FAILED` | "Failed to capture visible tab. Ensure the active tab is a regular web page." | chrome.tabs.captureVisibleTab error |
| `ELEMENT_NOT_FOUND` | "No element found matching selector '{selector}'." | querySelector returns null |
| `CLICK_FAILED` | "Could not click element '{selector}'. Element may be hidden or disabled." | Click action error |
| `WS_SEND_FAILED` | "Failed to send command to extension. Connection may have dropped." | ws.send() error |
| `MODE_REQUIRED` | "Tool requires 'mode' parameter: 'extension' or 'headless'." | Tool called without mode |
| `INVALID_MODE` | "Invalid mode '{mode}'. Must be 'extension' or 'headless'." | Unknown mode value |

---

## WebSocket Message Protocol (MCP Server ↔ Chrome Extension)

### Action Names

| Action | V | Direction | Description |
|--------|---|-----------|-------------|
| `take_screenshot` | 1 | Server→Ext | Capture active tab screenshot |
| `get_url` | 1 | Server→Ext | Get active tab URL |
| `click_element` | 2 | Server→Ext | Click by selector or coords |
| `scroll_page` | 2 | Server→Ext | Scroll by pixels or to element |
| `get_console_logs` | 2 | Server→Ext | Get captured console logs |
| `get_dom` | 3 | Server→Ext | Get full page HTML |
| `type_text` | 3 | Server→Ext | Type into input field |
| `navigate` | 3 | Server→Ext | Navigate to URL |
