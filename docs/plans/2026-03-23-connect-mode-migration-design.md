# Design: Replace Chrome Extension with Connect Mode

**Date:** 2026-03-23
**Status:** Approved

## Summary

Remove the Chrome Extension + WebSocket bridge architecture entirely. Replace with a `connect` mode that uses `puppeteer.connect()` to attach to the user's real Chrome browser via Chrome DevTools Protocol (CDP) on a configurable debug port (default 9222).

## Decisions

1. **Remove extension completely** — no fallback, no 3rd mode
2. **Auto-launch Chrome** if no debug Chrome is running, otherwise connect to existing
3. **Agent picks tabs** — can list, switch, open, close tabs in user's real Chrome
4. **Default port 9222** — configurable via config.json

## Two Modes

| Mode | How it works |
|------|-------------|
| `headless` | `puppeteer.launch()` — invisible background browser |
| `connect` | `puppeteer.connect()` — user's real Chrome via CDP |

## Connect Mode Flow

1. Agent calls `browser_select_mode({ mode: "connect" })`
2. MCP server tries `puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' })`
3. If fails → auto-launch `google-chrome --remote-debugging-port=9222`
4. Once connected → create session with reference to real browser
5. Agent can list tabs, switch, open new ones — full control
6. All tools use `session.page` — same Puppeteer API as headless

## What Gets Removed

- `chrome-extension/` folder (manifest.json, background.js)
- `src/websocket.ts` (entire WebSocket bridge)
- All `sendToExtension()` calls from 18 tool files
- All `if (modeResult.mode === 'extension')` branches
- `ws` npm dependency
- `wsPort` from config

## What Changes

- `mode-selector.ts` — `BrowserMode = 'headless' | 'connect'`
- `puppeteer-manager.ts` — add `createConnectSession(debugPort)`
- `config.ts` — add `debugPort: 9222`, remove `wsPort`
- All 18 tool files — remove extension branch (one Puppeteer code path for both modes)
- `select-mode.ts` — check if Chrome debug port is reachable
- `status.ts` — report connect status instead of extension status
- `index.ts` — remove WS startup, update instructions

## Key Simplification

Before (two code paths per tool):
```typescript
if (mode === 'extension') {
  await sendToExtension({ action: '...', payload: {...} });
} else {
  await session.page.doSomething();
}
```

After (one code path):
```typescript
await session.page.doSomething();  // works for both headless and connect
```

## Testing

- Remove `websocket.test.ts`
- All tool tests simplify — no extension mocks
- Add connect session tests in `puppeteer-manager.test.ts`
