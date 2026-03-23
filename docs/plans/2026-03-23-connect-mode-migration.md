# Connect Mode Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Chrome Extension + WebSocket bridge with `puppeteer.connect()` CDP mode, giving two clean modes: `headless` and `connect`.

**Architecture:** Remove all extension/WebSocket code. Add `createConnectSession()` to puppeteer-manager that connects to Chrome via CDP. All tools use a single Puppeteer code path for both modes.

**Tech Stack:** puppeteer-core, Chrome DevTools Protocol, Node.js child_process for auto-launch

---

### Task 1: Remove WebSocket and Chrome Extension

**Files:**
- Delete: `src/websocket.ts`
- Delete: `chrome-extension/manifest.json`
- Delete: `chrome-extension/background.js`
- Delete: `src/__tests__/websocket.test.ts`
- Modify: `package.json` — remove `ws` and `@types/ws` dependencies

**Step 1: Delete extension and websocket files**

```bash
rm -rf chrome-extension/
rm src/websocket.ts
rm src/__tests__/websocket.test.ts
```

**Step 2: Remove ws dependency**

```bash
npm uninstall ws @types/ws
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Chrome Extension and WebSocket bridge"
```

---

### Task 2: Update config.ts — replace wsPort with debugPort

**Files:**
- Modify: `src/config.ts`
- Modify: `config.json`

**Step 1: Update config.json**

```json
{
  "debugPort": 9222
}
```

**Step 2: Update src/config.ts**

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface IConfig {
  debugPort: number;
}

function loadConfig(): IConfig {
  const configPath = join(__dirname, '..', 'config.json');
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as IConfig;
  }
  return { debugPort: 9222 };
}

const config = loadConfig();

export const DEBUG_PORT: number = config.debugPort;
export default config;
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors from files still importing websocket.ts (expected at this stage)

**Step 4: Commit**

```bash
git add src/config.ts config.json
git commit -m "feat: replace wsPort with debugPort in config"
```

---

### Task 3: Update puppeteer-manager.ts — add connect session

**Files:**
- Modify: `src/puppeteer-manager.ts`

**Step 1: Add createConnectSession and isDebugChromeRunning functions**

Add these to puppeteer-manager.ts:

```typescript
import { DEBUG_PORT } from './config.js';

// Add to imports at top
import http from 'node:http';

export async function isDebugChromeRunning(port: number = DEBUG_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

export async function launchDebugChrome(port: number = DEBUG_PORT): Promise<void> {
  const chromePath = findChromePath();
  const child = (await import('node:child_process')).spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  // Wait for Chrome to be ready
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isDebugChromeRunning(port)) return;
  }
  throw new Error('Chrome did not start with debug port within 15 seconds');
}

export async function createConnectSession(port: number = DEBUG_PORT): Promise<string> {
  const id = `connect-${nanoid(8)}`;

  if (!(await isDebugChromeRunning(port))) {
    logger.info('Chrome debug port not found, launching Chrome...', { port });
    await launchDebugChrome(port);
  }

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${port}`,
  });

  const pages = await browser.pages();
  const page = pages[0] ?? await browser.newPage();

  // Spoof user agent and hide automation signals
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const sessionLogs: Array<{ type: string; text: string; timestamp: string }> = [];
  page.on('console', (msg) => {
    sessionLogs.push({ type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() });
  });

  sessions.set(id, { id, browser, page, createdAt: new Date(), logs: sessionLogs });
  logger.info('Connect session created', { id, port });
  return id;
}
```

**Step 2: Commit**

```bash
git add src/puppeteer-manager.ts
git commit -m "feat: add createConnectSession with auto-launch Chrome"
```

---

### Task 4: Update mode-selector.ts — replace extension with connect

**Files:**
- Modify: `src/mode-selector.ts`

**Step 1: Rewrite mode-selector.ts**

Replace `BrowserMode = 'extension' | 'headless'` with `'headless' | 'connect'`. Remove all extension/WebSocket references. The `selectMode` function should:
- If `sessionId` provided → look up session, return its mode
- If `forceMode` provided → use it
- If `defaultMode` set → use it
- Default to `headless`
- When mode is `connect` → call `createConnectSession()`
- When mode is `headless` → call `createSession()`

Remove: import of `getConnectionState` from websocket.ts
Add: import of `createConnectSession`, `isDebugChromeRunning` from puppeteer-manager.ts

**Step 2: Commit**

```bash
git add src/mode-selector.ts
git commit -m "feat: update mode-selector for headless/connect modes"
```

---

### Task 5: Simplify all 18 tool files — remove extension branches

**Files:**
- Modify: All 18 tool files in `src/tools/`

**Step 1: For each tool file, remove the extension branch**

Every tool currently has:
```typescript
import { sendToExtension } from '../websocket.js';
// ...
if (modeResult.mode === 'extension') {
  await sendToExtension({ action: '...', payload: {...} });
} else {
  const session = getSession(modeResult.sessionId!);
  // Puppeteer code
}
```

Change to:
```typescript
// Remove: import { sendToExtension } from '../websocket.js';
// ...
const session = getSession(modeResult.sessionId!);
// Puppeteer code (same as existing headless branch)
```

Do this for all 18 files:
- `screenshot.ts`, `navigate.ts`, `click.ts`, `type.ts`, `scroll.ts`
- `get-url.ts`, `get-dom.ts`, `console-logs.ts`, `execute.ts`
- `keyboard.ts`, `hover.ts`, `select-option.ts`, `wait-for.ts`
- `dialog.ts`, `file-upload.ts`, `drag-drop.ts`, `tabs.ts`, `navigate-back.ts`

**Step 2: Update select-mode.ts and status.ts**

- `select-mode.ts`: Check `isDebugChromeRunning()` to show connect as available
- `status.ts`: Remove `getConnectionState`, report connect availability via `isDebugChromeRunning()`

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/tools/
git commit -m "refactor: remove extension branches from all tools — single Puppeteer path"
```

---

### Task 6: Update index.ts — remove WebSocket, update instructions

**Files:**
- Modify: `src/index.ts`

**Step 1: Remove WebSocket imports and startup**

Remove:
- `import { startWebSocketServer, stopWebSocketServer } from './websocket.js'`
- `await startWebSocketServer(WS_PORT)` from `main()`
- `await stopWebSocketServer()` from `shutdown()`
- `import { WS_PORT } from './config.js'`

**Step 2: Update instructions text**

Replace all references to "extension" mode with "connect" mode. Update the capabilities section, mode descriptions, and examples. Key changes:
- `EXTENSION MODE` → `CONNECT MODE`
- Describe it as "connects to your real Chrome browser"
- Remove mention of Chrome Extension installation
- Add note about `--remote-debugging-port=9222`

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: update server — remove WS, update instructions for connect mode"
```

---

### Task 7: Update all test files

**Files:**
- Modify: All test files in `src/__tests__/`

**Step 1: Remove extension mocks from all tool tests**

Every test currently mocks:
```typescript
jest.unstable_mockModule('../websocket.js', () => ({
  sendToExtension: jest.fn(),
  getConnectionState: jest.fn().mockReturnValue({ connected: false, socketId: null })
}));
```

Remove this mock block entirely from all test files. Remove any tests that specifically test extension mode behavior. Keep all headless mode tests (they still work for both modes).

**Step 2: Add connect mock to puppeteer-manager mock**

Add `createConnectSession` and `isDebugChromeRunning` to the puppeteer-manager mock:
```typescript
jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn(),
  createSession: jest.fn(),
  createConnectSession: jest.fn(),
  isDebugChromeRunning: jest.fn(),
  setSessionPage: jest.fn(),
  listSessions: jest.fn().mockReturnValue([]),
  destroySession: jest.fn(),
  destroyAll: jest.fn()
}));
```

**Step 3: Update mode-selector.test.ts**

Rewrite tests to use `'headless' | 'connect'` instead of `'extension' | 'headless'`.

**Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/__tests__/
git commit -m "test: update all tests for connect mode — remove extension mocks"
```

---

### Task 8: Update package.json and cleanup

**Files:**
- Modify: `package.json` — remove `chrome-extension` from `files` list
- Modify: `README.md` — update setup instructions
- Modify: `CHANGELOG.md` — add v2.0.0 entry

**Step 1: Update package.json files list**

Remove `"chrome-extension"` from the `files` array.

**Step 2: Update README**

Replace Chrome Extension setup section with connect mode instructions.

**Step 3: Final build + test**

Run: `npm run build && npm test`
Expected: Build clean, all tests pass

**Step 4: Commit**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: cleanup package for connect mode — remove extension references"
```

---

### Task 9: Full verification

**Step 1: Clean build**

```bash
rm -rf dist/ && npm run build
```

**Step 2: Run all tests**

```bash
npm test
```

**Step 3: Manual test — headless mode**

Start server, call `browser_navigate({ url: "https://example.com", mode: "headless" })`, take screenshot.

**Step 4: Manual test — connect mode**

Start Chrome with `google-chrome --remote-debugging-port=9222`, call `browser_navigate({ url: "https://example.com", mode: "connect" })`, take screenshot of real browser.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete connect mode migration — Chrome Extension removed"
```
