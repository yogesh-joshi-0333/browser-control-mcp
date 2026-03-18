# Phase 2+4 Design — WebSocket Bridge + Puppeteer (Combined)
**Date:** 2026-03-18 | **Status:** Approved

---

## Goal

Build a fully working dual-mode browser control system:
- **Extension mode:** MCP Server ↔ Chrome Extension via WebSocket on `localhost:9999`
- **Headless mode:** MCP Server → Puppeteer sessions identified by session ID
- **Smart fallback:** If Extension not connected, wait 30s, then auto-fallback to Headless

---

## Scope

This phase combines original Phase 2 (WebSocket Bridge) and Phase 4 (Puppeteer) into one cohesive delivery. Both modes must work before this phase is considered complete.

---

## Architecture

```
Tool called (e.g. browser_screenshot)
        ↓
  mode-selector.ts
        ↓
  Ask user: "Extension or Headless?"
  (skip prompt if sessionId already provided → auto Headless)
        ↓
┌─────────────────────┐         ┌──────────────────────────┐
│  Extension Mode     │         │  Headless Mode (Puppeteer)│
│                     │         │                          │
│ getConnectionState()│── NO ──→│ "Open Chrome. 30s..."    │
│  connected?         │         │  Still no? → fallback    │
│                     │         │                          │
│  websocket.ts       │         │  puppeteer-manager.ts    │
│  background.js      │         │  session-XXXXXXXX        │
└─────────────────────┘         └──────────────────────────┘
        ↓                                   ↓
    result ←───────────────────────────────┘
```

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Origin validation | `chrome-extension://` prefix only (dev) | Extension ID unknown until loaded |
| Heartbeat timing | 30s ping, 5s pong timeout (hardcoded) | YAGNI — no config needed |
| Reconnect strategy | Exponential backoff, indefinite retries | Chrome stays open, server restarts |
| Connection state | Module-level `getConnectionState()` singleton | No circular deps, live state per call |
| Fallback wait | 30s polling every 2s | Enough time to open Chrome manually |
| Session IDs | `session-` + nanoid(8) | Human-readable, unique |
| Puppeteer sandbox | Enabled (no `--no-sandbox`) | Security rule |

---

## New Files

| File | Purpose |
|------|---------|
| `src/websocket.ts` | WS server, origin validation, heartbeat, request/response matching |
| `src/mode-selector.ts` | User prompt + 30s wait + auto-fallback logic |
| `src/puppeteer-manager.ts` | Puppeteer session lifecycle: create, get, destroy, list, destroyAll |
| `chrome-extension/manifest.json` | Manifest V3, permissions: tabs, activeTab, scripting |
| `chrome-extension/background.js` | Service worker: WS connect, reconnect loop, ping/pong |

## Modified Files

| File | Change |
|------|--------|
| `src/index.ts` | Start WS server on startup, register SIGTERM/SIGINT for cleanup |
| `src/tools/status.ts` | Read live state from `getConnectionState()` + list Puppeteer sessions |
| `src/config.ts` | Already has `WS_PORT` — no changes needed |

---

## WebSocket Server Design (`src/websocket.ts`)

```typescript
// Constants (hardcoded)
const HEARTBEAT_INTERVAL_MS = 30_000;  // 30s
const HEARTBEAT_TIMEOUT_MS = 5_000;    // 5s
const REQUEST_TIMEOUT_MS = 10_000;     // 10s per request

// Origin validation
function isValidOrigin(origin: string): boolean {
  return origin.startsWith('chrome-extension://');
}

// State (module-level singleton)
let extensionSocket: WebSocket | null = null;

export function getConnectionState(): { connected: boolean; socketId: string | null } {
  return { connected: extensionSocket !== null, socketId: /* id */ };
}

// Request/response matching
// Each outgoing message has a UUID id
// Responses matched by id with 10s timeout → TIMEOUT_ERROR
```

---

## Chrome Extension Design

**`manifest.json`:**
```json
{
  "manifest_version": 3,
  "name": "Browser Control MCP",
  "version": "1.0.0",
  "permissions": ["tabs", "activeTab", "scripting"],
  "background": { "service_worker": "background.js" }
}
```

**`background.js` reconnect logic:**
```javascript
// Exponential backoff: 1s → 2s → 4s → ... → 30s max
// Retries indefinitely
// Responds to server ping with pong
// On connect: sends { type: 'register', origin: chrome.runtime.id }
```

---

## Puppeteer Manager Design (`src/puppeteer-manager.ts`)

```typescript
// Session format: session-a1b2c3d4 (nanoid 8 chars)
interface ISession {
  id: string;
  browser: Browser;
  page: Page;
  createdAt: Date;
}

export async function createSession(): Promise<string>    // returns session ID
export function getSession(id: string): ISession          // throws SESSION_NOT_FOUND
export async function destroySession(id: string): Promise<void>
export function listSessions(): string[]
export async function destroyAll(): Promise<void>         // called on SIGTERM/SIGINT
```

---

## Mode Selector Flow (`src/mode-selector.ts`)

```
selectMode(sessionId?: string) → 'extension' | { type: 'headless', sessionId: string }

if sessionId provided:
  → return headless with that sessionId (skip prompt)

prompt: "Browser mode? [extension/headless]"

if headless:
  → createSession() → return sessionId

if extension:
  → check getConnectionState()
  → if connected: return 'extension'
  → if not connected:
      log: "Chrome Extension not connected. Open Chrome manually. Waiting 30s..."
      poll every 2s for 30s
      if connected: return 'extension'
      if timeout:
        log: "Extension not available. Falling back to Headless mode."
        createSession() → return headless sessionId
```

---

## Error Codes (Phase 2+4)

| Code | Trigger |
|------|---------|
| `EXTENSION_NOT_CONNECTED` | Extension mode selected, not connected, no fallback |
| `WS_SEND_FAILED` | WebSocket send throws |
| `TIMEOUT_ERROR` | WS request exceeds 10s |
| `SESSION_NOT_FOUND` | Invalid sessionId passed to Puppeteer manager |

---

## Tests

| Test file | What it covers |
|-----------|---------------|
| `src/__tests__/websocket.test.ts` | Real WS server + test client: connect, disconnect, heartbeat, origin rejection |
| `src/__tests__/puppeteer-manager.test.ts` | Create session, reuse session, destroy, SESSION_NOT_FOUND error |
| `src/__tests__/mode-selector.test.ts` | Mocked: extension path, headless path, 30s fallback path |

---

## Completion Criteria

- [ ] `browser_status` returns `extensionConnected: true` when Chrome Extension loaded
- [ ] `browser_status` returns `extensionConnected: false` within 5s of Chrome closing
- [ ] `browser_status` lists active Puppeteer session IDs
- [ ] Mode selector prompts user, respects choice
- [ ] Extension not connected → 30s wait → auto-fallback to Headless
- [ ] All tests pass
- [ ] No orphan Puppeteer processes on server exit
