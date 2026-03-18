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

- [ ] Install `ws` and `@types/ws` packages
- [ ] Create `src/websocket.ts` — WebSocket server on `127.0.0.1:9999`
- [ ] Implement origin validation in `websocket.ts` — reject unknown extension IDs
- [ ] Implement heartbeat in `websocket.ts` — ping every 30s, mark disconnected if no pong in 5s
- [ ] Connect `websocket.ts` to `src/index.ts` — start WS server on MCP Server startup
- [ ] Update `src/tools/status.ts` to read live extension connection state from `websocket.ts`
- [ ] Create `chrome-extension/manifest.json` with Manifest V3, permissions: `tabs`, `activeTab`, `scripting`
- [ ] Create `chrome-extension/background.js` — service worker that connects to `ws://127.0.0.1:9999`
- [ ] Implement reconnect logic in `background.js` — exponential backoff, max 30s
- [ ] Implement pong response in `background.js` — respond to server ping
- [ ] Write integration test: `src/__tests__/websocket.test.ts` — real WS server + test client, verify connect/disconnect/heartbeat
- [ ] Tests pass: `npm test`
- [ ] Load extension in Chrome: `chrome://extensions` → Developer mode → Load unpacked `chrome-extension/`
- [ ] Verify: `browser_status` from Claude returns `{ extensionConnected: true }`
- [ ] Verify: Closing Chrome changes `extensionConnected` to `false` within 5 seconds

---

## Phase 3 — V1 Tools via Extension

**Goal:** Implement `browser_screenshot` and `browser_get_url` in Extension mode with dual-mode selection prompt.

**Completion Criteria:** Claude can describe the contents of any open Chrome tab from a screenshot.

- [ ] Create `src/mode-selector.ts` — prompts user to select "extension" or "headless" per tool call
- [ ] Create `src/tools/screenshot.ts` — implements `browser_screenshot` for Extension mode
- [ ] Create `src/tools/get-url.ts` — implements `browser_get_url` for Extension mode
- [ ] Register new tools in `src/index.ts`
- [ ] Add WebSocket request/response matching in `websocket.ts` by request ID with 10s timeout
- [ ] Implement `take_screenshot` handler in `chrome-extension/background.js` using `chrome.tabs.captureVisibleTab`
- [ ] Implement `get_url` handler in `chrome-extension/background.js` using `chrome.tabs.query`
- [ ] Write unit tests for `screenshot.ts` and `get-url.ts`
- [ ] Write integration test: full round-trip screenshot via real WS connection
- [ ] Tests pass: `npm test`
- [ ] Rebuild and reload extension in Chrome
- [ ] Verify: Claude calls `browser_screenshot`, mode prompt appears, user selects Extension, Claude describes screenshot
- [ ] Verify: `browser_get_url` returns active tab URL correctly
- [ ] Verify: `EXTENSION_NOT_CONNECTED` error returned when extension disconnected

---

## Phase 4 — Headless Mode (Puppeteer)

**Goal:** Add Puppeteer headless sessions with session ID management. All V1 tools work in both modes.

**Completion Criteria:** Claude can open a background browser, navigate it, take screenshots, and reuse the session by ID — without disturbing the user's Chrome tabs.

- [ ] Install `puppeteer` package
- [ ] Create `src/puppeteer-manager.ts` — session lifecycle: create, get, destroy, list, destroyAll
- [ ] Implement session ID generation using `nanoid` in format `session-<8chars>`
- [ ] Implement `destroyAll()` called on process exit signal (`SIGTERM`, `SIGINT`)
- [ ] Update `src/tools/screenshot.ts` — add Headless mode branch using `puppeteer-manager.ts`
- [ ] Update `src/tools/get-url.ts` — add Headless mode branch
- [ ] Update `src/tools/status.ts` — list active sessions from `puppeteer-manager.ts`
- [ ] Update `src/mode-selector.ts` — if `sessionId` provided, skip prompt and use Headless automatically
- [ ] Write unit tests for `puppeteer-manager.ts` (create, reuse, destroy sessions)
- [ ] Write integration test: screenshot via new Puppeteer session, verify sessionId returned
- [ ] Write integration test: screenshot via reused sessionId, verify same session used
- [ ] Tests pass: `npm test`
- [ ] Verify: Claude calls `browser_screenshot` with Headless mode, new session created, screenshot returned
- [ ] Verify: Subsequent call with same sessionId reuses session without relaunching browser
- [ ] Verify: `SESSION_NOT_FOUND` returned for invalid sessionId
- [ ] Verify: All Puppeteer sessions close on MCP Server process exit

---

## Phase 5 — V2 Tools

**Goal:** Implement `browser_click`, `browser_scroll`, and `browser_console_logs` in both Extension and Headless modes.

**Completion Criteria:** Claude can click buttons, scroll pages, and read JS console errors — in both Extension and Headless mode.

- [ ] Create `src/tools/click.ts` — implements `browser_click` for both modes
- [ ] Create `src/tools/scroll.ts` — implements `browser_scroll` for both modes
- [ ] Create `src/tools/console-logs.ts` — implements `browser_console_logs` for both modes
- [ ] Register new tools in `src/index.ts`
- [ ] Implement `click_element` handler in `chrome-extension/background.js` + `content.js`
- [ ] Implement `scroll_page` handler in `chrome-extension/content.js`
- [ ] Implement console log interceptor injection in `chrome-extension/content.js`
- [ ] Implement `get_console_logs` handler in `chrome-extension/background.js`
- [ ] Add Puppeteer equivalents in `puppeteer-manager.ts`: click, scroll, console capture
- [ ] Write unit tests for all three new tools
- [ ] Write integration tests for click, scroll, console in both modes
- [ ] Tests pass: `npm test`
- [ ] Rebuild and reload extension in Chrome
- [ ] Verify: Claude clicks a button on a real page using CSS selector
- [ ] Verify: Claude scrolls a page and reports new scroll position
- [ ] Verify: Claude reads console errors from a page with JS errors

---

## Phase 6 — V3 Tools

**Goal:** Implement all remaining Antigravity-parity tools: DOM inspection, typing, navigation, recording, visual diff, UI testing.

**Completion Criteria:** Full Antigravity parity achieved. Claude can automate complete UI workflows.

- [ ] Create `src/tools/get-dom.ts` — implements `browser_get_dom`
- [ ] Create `src/tools/type.ts` — implements `browser_type`
- [ ] Create `src/tools/navigate.ts` — implements `browser_navigate`
- [ ] Create `src/tools/record-start.ts` and `src/tools/record-stop.ts` — session recording
- [ ] Create `src/tools/visual-diff.ts` — implements `browser_visual_diff` (pixel comparison)
- [ ] Create `src/tools/run-test.ts` — implements `browser_run_test`
- [ ] Register all new tools in `src/index.ts`
- [ ] Implement Extension handlers for: `get_dom`, `type_text`, `navigate` in `background.js` + `content.js`
- [ ] Implement Puppeteer equivalents for all V3 tools in `puppeteer-manager.ts`
- [ ] Implement recording using Chrome Tab Capture API (Extension) and Puppeteer screencast (Headless)
- [ ] Implement visual diff using pixel-by-pixel comparison (pure TypeScript, no external lib)
- [ ] Update Extension `manifest.json` with new permissions required for V3 (e.g. `tabCapture` for recording)
- [ ] Write unit tests for all V3 tools
- [ ] Write integration tests for each V3 tool in both modes
- [ ] Tests pass: `npm test`
- [ ] Rebuild and reload extension in Chrome
- [ ] Verify: Claude reads full DOM of a page and identifies element structure
- [ ] Verify: Claude fills out a form field and submits it
- [ ] Verify: Claude navigates to a URL and confirms new page loaded
- [ ] Verify: Claude records a session, stops recording, receives video data
- [ ] Verify: Claude takes two screenshots before/after a CSS change and reports diff percentage
- [ ] Update `knowledge/setup/install-guide.md` with any new V3 setup steps
