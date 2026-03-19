# Browser Control MCP — Functional Requirements
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## MCP Server (FR-MCP)

| ID | Requirement |
|----|-------------|
| FR-MCP-01 | The MCP Server MUST start as a Node.js process and register itself with Claude Code via the MCP protocol using stdio transport |
| FR-MCP-02 | The MCP Server MUST expose all V1 tools to Claude Code on startup: `browser_select_mode`, `browser_status`, `browser_screenshot`, `browser_get_url` |
| FR-MCP-03 | The MCP Server MUST expose all V2 tools in Phase 5: `browser_click`, `browser_scroll`, `browser_console_logs` |
| FR-MCP-04 | The MCP Server MUST expose all V3 tools in Phase 6: `browser_get_dom`, `browser_type`, `browser_navigate`, `browser_record_start`, `browser_record_stop`, `browser_visual_diff`, `browser_run_test` |
| FR-MCP-05 | Every tool call MUST prompt the user to select mode: Extension or Headless, before executing |
| FR-MCP-06 | The MCP Server MUST return a structured error response (not throw) when any tool fails |
| FR-MCP-07 | The MCP Server MUST log all tool calls at `info` level with tool name, mode, and timestamp |
| FR-MCP-08 | The MCP Server MUST be configurable via a `config.json` file for port and extension ID |

---

## WebSocket Bridge (FR-WS)

| ID | Requirement |
|----|-------------|
| FR-WS-01 | The WebSocket server MUST bind exclusively to `127.0.0.1:9999` |
| FR-WS-02 | The WebSocket server MUST reject any connection whose origin does not match the registered Chrome Extension ID |
| FR-WS-03 | The WebSocket server MUST accept exactly one Chrome Extension connection at a time |
| FR-WS-04 | The WebSocket server MUST detect disconnection within 5 seconds using a heartbeat ping/pong |
| FR-WS-05 | All WebSocket messages MUST follow the `{ id, action, payload }` request schema and `{ id, success, data/error }` response schema |
| FR-WS-06 | The MCP Server MUST time out and return `TIMEOUT_ERROR` if the Extension does not respond within 10 seconds |
| FR-WS-07 | The WebSocket server MUST log connect and disconnect events at `info` level |

---

## Chrome Extension (FR-EXT)

| ID | Requirement |
|----|-------------|
| FR-EXT-01 | The Chrome Extension MUST use Manifest V3 |
| FR-EXT-02 | The Extension background service worker MUST connect to `ws://127.0.0.1:9999` on install and on browser startup |
| FR-EXT-03 | The Extension MUST reconnect automatically if the WebSocket connection drops, with exponential backoff (max 30 seconds) |
| FR-EXT-04 | The Extension content script MUST be injected into the active tab when a command requiring tab access is received |
| FR-EXT-05 | The Extension MUST capture screenshots using `chrome.tabs.captureVisibleTab` and return the result as base64 PNG |
| FR-EXT-06 | The Extension MUST return the active tab URL using `chrome.tabs.query` |
| FR-EXT-07 | The Extension MUST execute click actions using `document.querySelector` with the provided CSS selector |
| FR-EXT-08 | The Extension MUST execute scroll actions using `window.scrollBy` or `element.scrollIntoView` |
| FR-EXT-09 | The Extension MUST capture console logs by injecting a console interceptor into the page context |
| FR-EXT-10 | The Extension MUST return the full page DOM as `document.documentElement.outerHTML` |
| FR-EXT-11 | The Extension MUST type into inputs using `element.value` assignment + `input` event dispatch |
| FR-EXT-12 | The Extension permissions in manifest.json MUST be minimal: only `tabs`, `activeTab`, `scripting` for V1 |

---

## Puppeteer / Headless Mode (FR-PUP)

| ID | Requirement |
|----|-------------|
| FR-PUP-01 | The MCP Server MUST launch a Puppeteer browser instance when Headless mode is selected and no session ID is provided |
| FR-PUP-02 | Each headless session MUST be assigned a unique ID in format `session-<nanoid(8)>` |
| FR-PUP-03 | The MCP Server MUST reuse an existing session when a valid session ID is provided in the tool call |
| FR-PUP-04 | The MCP Server MUST return `SESSION_NOT_FOUND` error if a provided session ID does not exist |
| FR-PUP-05 | The session ID MUST be returned to Claude in every headless tool response so Claude can reuse it |
| FR-PUP-06 | Puppeteer MUST launch with a visible viewport of 1280x800 by default |
| FR-PUP-07 | The MCP Server MUST close all Puppeteer sessions on process exit |
| FR-PUP-08 | `browser_status` MUST list all active headless sessions with their IDs and current URLs |

---

## Tool: browser_status (FR-TOOL-STATUS)

| ID | Requirement |
|----|-------------|
| FR-TOOL-STATUS-01 | `browser_status` MUST return whether the Chrome Extension is currently connected |
| FR-TOOL-STATUS-02 | `browser_status` MUST return a list of all active headless session IDs and their current page URLs |
| FR-TOOL-STATUS-03 | `browser_status` MUST NOT require a mode selection prompt — it reports state only |

---

## Tool: browser_screenshot (FR-TOOL-SS)

| ID | Requirement |
|----|-------------|
| FR-TOOL-SS-01 | `browser_screenshot` MUST prompt for mode selection before executing |
| FR-TOOL-SS-02 | In Extension mode, `browser_screenshot` MUST capture the currently active Chrome tab |
| FR-TOOL-SS-03 | In Headless mode, `browser_screenshot` MUST capture the Puppeteer page for the provided or newly created session |
| FR-TOOL-SS-04 | `browser_screenshot` MUST return the image as a base64-encoded PNG string |
| FR-TOOL-SS-05 | `browser_screenshot` MUST return the current page URL alongside the image |
| FR-TOOL-SS-06 | `browser_screenshot` MUST return `EXTENSION_NOT_CONNECTED` if Extension mode is selected but extension is not connected |

---

## Tool: browser_get_url (FR-TOOL-URL)

| ID | Requirement |
|----|-------------|
| FR-TOOL-URL-01 | `browser_get_url` MUST prompt for mode selection before executing |
| FR-TOOL-URL-02 | In Extension mode, `browser_get_url` MUST return the URL of the active Chrome tab |
| FR-TOOL-URL-03 | In Headless mode, `browser_get_url` MUST return the current URL of the specified session |

---

## Tool: browser_click (FR-TOOL-CLICK)

| ID | Requirement |
|----|-------------|
| FR-TOOL-CLICK-01 | `browser_click` MUST accept either a CSS selector or `{x, y}` coordinates as target |
| FR-TOOL-CLICK-02 | `browser_click` MUST return `ELEMENT_NOT_FOUND` if the CSS selector matches no element |
| FR-TOOL-CLICK-03 | `browser_click` MUST confirm click success and return the element's text content |

---

## Tool: browser_scroll (FR-TOOL-SCROLL)

| ID | Requirement |
|----|-------------|
| FR-TOOL-SCROLL-01 | `browser_scroll` MUST accept scroll by pixels `{x, y}` or scroll-to-element by CSS selector |
| FR-TOOL-SCROLL-02 | `browser_scroll` MUST return the new scroll position after executing |

---

## Tool: browser_console_logs (FR-TOOL-CONSOLE)

| ID | Requirement |
|----|-------------|
| FR-TOOL-CONSOLE-01 | `browser_console_logs` MUST return all console messages captured since the last call or page load |
| FR-TOOL-CONSOLE-02 | Each log entry MUST include: level (`log`, `warn`, `error`, `info`), message, timestamp |
| FR-TOOL-CONSOLE-03 | `browser_console_logs` MUST support a `clear` parameter that clears the buffer after returning |

---

## Tool: browser_select_mode (FR-TOOL-MODE)

| ID | Requirement |
|----|-------------|
| FR-TOOL-MODE-01 | `browser_select_mode` MUST return whether the Chrome Extension is currently connected |
| FR-TOOL-MODE-02 | `browser_select_mode` MUST return the list of available mode options based on extension connectivity |
| FR-TOOL-MODE-03 | `browser_select_mode` MUST return the currently selected default mode if one has been set |
| FR-TOOL-MODE-04 | When the AI calls `browser_select_mode` with a chosen mode, it MUST persist as the session default for subsequent tool calls |
| FR-TOOL-MODE-05 | `browser_select_mode` MUST NOT require a mode selection prompt — it is the mode selection mechanism itself |

---

## Security Requirements (FR-SEC)

| ID | Requirement |
|----|-------------|
| FR-SEC-01 | The WebSocket server MUST NOT bind to any interface other than `127.0.0.1` |
| FR-SEC-02 | The WebSocket server MUST validate the connecting extension's origin against a configured allowlist |
| FR-SEC-03 | No tool response MUST contain stack traces, file paths, or system information |
| FR-SEC-04 | No screenshot data MUST be written to disk — all image data stays in memory |
| FR-SEC-05 | The Extension MUST NOT request `<all_urls>` permission — only `activeTab` |
| FR-SEC-06 | Puppeteer MUST launch with the default sandbox enabled |

---

## Error Handling Requirements (FR-ERR)

| ID | Requirement |
|----|-------------|
| FR-ERR-01 | Every tool MUST catch all exceptions and return a structured error — never crash the MCP Server process |
| FR-ERR-02 | Every error response MUST include a `code` field with a value from the standard error code table |
| FR-ERR-03 | Every error response MUST include a `message` field with an exact human-readable string |
| FR-ERR-04 | The MCP Server MUST return `EXTENSION_NOT_CONNECTED` within 100ms when the extension is not connected |
| FR-ERR-05 | The MCP Server MUST return `TIMEOUT_ERROR` if no response is received from the extension within 10 seconds |
| FR-ERR-06 | The MCP Server MUST return `SESSION_NOT_FOUND` when a non-existent headless session ID is provided |
| FR-ERR-07 | The MCP Server MUST return `ELEMENT_NOT_FOUND` when a CSS selector matches no element |
| FR-ERR-08 | The MCP Server MUST return `MODE_REQUIRED` if a tool is called without mode selection |
