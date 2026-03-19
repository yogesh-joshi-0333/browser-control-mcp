# Browser Control MCP — Implementation Phases
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## How to Use This File

1. Find the first phase with unchecked tasks `[ ]` — that is your current phase
2. Complete tasks in order — earlier tasks enable later tasks
3. Mark tasks `[x]` only after tests pass and AGENT-LOG.md is updated

---

## Phase 1 — MCP Server Skeleton

**Goal:** Create a working Node.js/TypeScript project registered with Claude Code as an MCP server exposing a working `browser_status` tool.

**Completion Criteria:** Claude Code lists `browser-control` in its MCP servers, and calling `browser_status` returns a valid JSON response.

- [x] Initialize Node.js project: `npm init` in `mcp-server/`
- [x] Install dependencies: `@modelcontextprotocol/sdk`, `typescript`, `ts-node`, `@types/node`
- [x] Install dev dependencies: `jest`, `ts-jest`, `@types/jest`, `eslint`, `@typescript-eslint/eslint-plugin`
- [x] Create `tsconfig.json` with strict mode enabled
- [x] Create `eslint.config.js` with TypeScript rules
- [x] Create `src/config.ts` with `WS_PORT = 9999` and config loading from `config.json`
- [x] Create `src/logger.ts` with structured logger (info/warn/error levels, no console.log)
- [x] Create `src/types.ts` with `IToolResult`, `IErrorResponse`, `IWsRequest`, `IWsResponse` interfaces
- [x] Create `src/tools/status.ts` implementing `browser_status` tool (returns hardcoded "not connected" + empty sessions)
- [x] Create `src/index.ts` registering MCP server with stdio transport and registering `browser_status` tool
- [x] Build TypeScript: `npm run build` succeeds with zero errors
- [x] Write unit test: `src/__tests__/status.test.ts` verifying `browser_status` returns correct shape
- [x] Tests pass: `npm test`
- [x] Add MCP server entry to `~/.claude/settings.json`
- [x] Verify: Claude Code shows `browser-control` in MCP servers list
- [x] Verify: Calling `browser_status` from Claude returns `{ extensionConnected: false, headlessSessions: [] }`

---

## Phase 2 — WebSocket Bridge

**Goal:** Add a WebSocket server to the MCP Server and build a Chrome Extension that connects to it. `browser_status` must report the extension as connected after the extension loads.

**Completion Criteria:** Chrome Extension connects to MCP Server, `browser_status` returns `extensionConnected: true`, heartbeat keeps connection alive.

- [x] Install `ws` and `@types/ws` packages
- [x] Create `src/websocket.ts` — WebSocket server on `127.0.0.1:9999`
- [x] Implement origin validation in `websocket.ts` — reject unknown extension IDs
- [x] Implement heartbeat in `websocket.ts` — ping every 30s, mark disconnected if no pong in 5s
- [x] Connect `websocket.ts` to `src/index.ts` — start WS server on MCP Server startup
- [x] Update `src/tools/status.ts` to read live extension connection state from `websocket.ts`
- [x] Create `chrome-extension/manifest.json` with Manifest V3, permissions: `tabs`, `activeTab`, `scripting`
- [x] Create `chrome-extension/background.js` — service worker that connects to `ws://127.0.0.1:9999`
- [x] Implement reconnect logic in `background.js` — exponential backoff, max 30s
- [x] Implement keepalive in `background.js` — send keepalive message every 20s to prevent service worker suspension
- [x] Write integration test: `src/__tests__/websocket.test.ts` — real WS server + test client, verify connect/disconnect/heartbeat
- [x] Tests pass: `npm test`
- [x] Load extension in Chrome: `chrome://extensions` → Developer mode → Load unpacked `chrome-extension/`
- [x] Verify: `browser_status` from Claude returns `{ extensionConnected: true }`
- [x] Verify: Closing Chrome changes `extensionConnected` to `false` within 5 seconds

---

## Phase 3 — V1 Tools via Extension

**Goal:** Implement `browser_screenshot` and `browser_get_url` in Extension mode with dual-mode selection prompt.

**Completion Criteria:** Claude can describe the contents of any open Chrome tab from a screenshot.

- [x] Create `src/mode-selector.ts` — prompts user to select "extension" or "headless" per tool call
- [x] Create `src/tools/screenshot.ts` — implements `browser_screenshot` for Extension mode
- [x] Create `src/tools/get-url.ts` — implements `browser_get_url` for Extension mode
- [x] Register new tools in `src/index.ts`
- [x] Add WebSocket request/response matching in `websocket.ts` by request ID with 10s timeout
- [x] Implement `take_screenshot` handler in `chrome-extension/background.js` using `chrome.tabs.captureVisibleTab`
- [x] Implement `get_url` handler in `chrome-extension/background.js` using `chrome.tabs.query`
- [x] Write unit tests for `screenshot.ts` and `get-url.ts`
- [x] Write integration test: full round-trip screenshot via real WS connection
- [x] Tests pass: `npm test`
- [x] Rebuild and reload extension in Chrome
- [x] Verify: Claude calls `browser_screenshot`, mode prompt appears, user selects Extension, Claude describes screenshot
- [x] Verify: `browser_get_url` returns active tab URL correctly
- [x] Verify: `EXTENSION_NOT_CONNECTED` error returned when extension disconnected

---

## Phase 4 — Headless Mode (Puppeteer)

**Goal:** Add Puppeteer headless sessions with session ID management. All V1 tools work in both modes.

**Completion Criteria:** Claude can open a background browser, navigate it, take screenshots, and reuse the session by ID — without disturbing the user's Chrome tabs.

- [x] Install `puppeteer` package
- [x] Create `src/puppeteer-manager.ts` — session lifecycle: create, get, destroy, list, destroyAll
- [x] Implement session ID generation using `nanoid` in format `session-<8chars>`
- [x] Implement `destroyAll()` called on process exit signal (`SIGTERM`, `SIGINT`)
- [x] Update `src/tools/status.ts` — list active sessions from `puppeteer-manager.ts`
- [x] Create `src/mode-selector.ts` — if `sessionId` provided, skip prompt and use Headless automatically; 30s wait + fallback
- [x] Write unit tests for `puppeteer-manager.ts` (create, reuse, destroy sessions)
- [x] Tests pass: `npm test`
- [x] Verify: Claude calls `browser_screenshot` with Headless mode, new session created, screenshot returned
- [x] Verify: Subsequent call with same sessionId reuses session without relaunching browser
- [x] Verify: `SESSION_NOT_FOUND` returned for invalid sessionId
- [x] Verify: All Puppeteer sessions close on MCP Server process exit

---

## Phase 5 — V2 Tools

**Goal:** Implement `browser_click`, `browser_scroll`, and `browser_console_logs` in both Extension and Headless modes.

**Completion Criteria:** Claude can click buttons, scroll pages, and read JS console errors — in both Extension and Headless mode.

- [x] Create `src/tools/click.ts` — implements `browser_click` for both modes
- [x] Create `src/tools/scroll.ts` — implements `browser_scroll` for both modes
- [x] Create `src/tools/console-logs.ts` — implements `browser_console_logs` for both modes
- [x] Register new tools in `src/index.ts`
- [x] Implement `click_element` handler in `chrome-extension/background.js` + `content.js`
- [x] Implement `scroll_page` handler in `chrome-extension/content.js`
- [x] Implement console log interceptor injection in `chrome-extension/content.js`
- [x] Implement `get_console_logs` handler in `chrome-extension/background.js`
- [x] Add Puppeteer equivalents in `puppeteer-manager.ts`: click, scroll, console capture
- [x] Write unit tests for all three new tools
- [x] Write integration tests for click, scroll, console in both modes
- [x] Tests pass: `npm test`
- [x] Rebuild and reload extension in Chrome
- [x] Verify: Claude clicks a button on a real page using CSS selector
- [x] Verify: Claude scrolls a page and reports new scroll position
- [x] Verify: Claude reads console errors from a page with JS errors

---

## Phase 6 — V3 Tools

**Goal:** Implement all remaining Antigravity-parity tools: DOM inspection, typing, navigation, recording, visual diff, UI testing.

**Completion Criteria:** Full Antigravity parity achieved. Claude can automate complete UI workflows.

- [x] Create `src/tools/get-dom.ts` — implements `browser_get_dom`
- [x] Create `src/tools/type.ts` — implements `browser_type`
- [x] Create `src/tools/navigate.ts` — implements `browser_navigate`
- [ ] Create `src/tools/record-start.ts` and `src/tools/record-stop.ts` — session recording
- [ ] Create `src/tools/visual-diff.ts` — implements `browser_visual_diff` (pixel comparison)
- [ ] Create `src/tools/run-test.ts` — implements `browser_run_test`
- [x] Register all new tools in `src/index.ts`
- [x] Implement Extension handlers for: `get_dom`, `type_text`, `navigate` in `background.js` + `content.js`
- [x] Implement Puppeteer equivalents for all V3 tools in `puppeteer-manager.ts`
- [ ] Implement recording using Chrome Tab Capture API (Extension) and Puppeteer screencast (Headless)
- [ ] Implement visual diff using pixel-by-pixel comparison (pure TypeScript, no external lib)
- [ ] Update Extension `manifest.json` with new permissions required for V3 (e.g. `tabCapture` for recording)
- [x] Write unit tests for all V3 tools
- [x] Write integration tests for each V3 tool in both modes
- [x] Tests pass: `npm test`
- [x] Rebuild and reload extension in Chrome
- [x] Verify: Claude reads full DOM of a page and identifies element structure
- [x] Verify: Claude fills out a form field and submits it
- [x] Verify: Claude navigates to a URL and confirms new page loaded
- [ ] Verify: Claude records a session, stops recording, receives video data
- [ ] Verify: Claude takes two screenshots before/after a CSS change and reports diff percentage
- [ ] Update `knowledge/setup/install-guide.md` with any new V3 setup steps
