# Phase 2+4: WebSocket Bridge + Puppeteer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully working dual-mode browser control system — Chrome Extension via WebSocket on `localhost:9999` AND Puppeteer headless sessions — with a smart mode selector that falls back from Extension to Headless after 30s if Chrome is not open.

**Architecture:** `mode-selector.ts` prompts the user (or auto-selects if `sessionId` provided), `websocket.ts` manages the Chrome Extension connection as a module-level singleton, `puppeteer-manager.ts` manages Puppeteer session lifecycle. `index.ts` starts the WS server on startup and registers cleanup on process exit.

**Tech Stack:** Node.js 20 ESM, TypeScript 5, `ws` 8, `puppeteer` 21, `nanoid`, Jest 29 + ts-jest 29, Chrome Extension Manifest V3

---

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install production dependencies**

```bash
cd /media/pc/External/Project/mcp
npm install ws puppeteer nanoid
```

**Step 2: Install dev dependencies**

```bash
npm install --save-dev @types/ws
```

**Step 3: Verify installed versions**

```bash
node -e "const w=require('./node_modules/ws/package.json'); console.log('ws:', w.version)"
node -e "const p=require('./node_modules/puppeteer/package.json'); console.log('puppeteer:', p.version)"
node -e "const n=require('./node_modules/nanoid/package.json'); console.log('nanoid:', n.version)"
```

Expected: ws 8.x, puppeteer 21.x or later, nanoid 5.x

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install ws, puppeteer, nanoid dependencies"
```

---

### Task 2: Create WebSocket server

**Files:**
- Create: `src/websocket.ts`
- Test: `src/__tests__/websocket.test.ts`

**Step 1: Write the failing test first**

Create `src/__tests__/websocket.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocket as WsClient } from 'ws';
import { startWebSocketServer, stopWebSocketServer, getConnectionState, sendToExtension } from '../websocket.js';

const TEST_PORT = 9998;

describe('WebSocket server', () => {
  beforeEach(async () => {
    await startWebSocketServer(TEST_PORT);
  });

  afterEach(async () => {
    await stopWebSocketServer();
  });

  it('starts and reports disconnected state initially', () => {
    const state = getConnectionState();
    expect(state.connected).toBe(false);
    expect(state.socketId).toBeNull();
  });

  it('accepts connection from chrome-extension:// origin', (done) => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'chrome-extension://abcdefghijklmnop' }
    });
    client.on('open', () => {
      setTimeout(() => {
        const state = getConnectionState();
        expect(state.connected).toBe(true);
        client.close();
        done();
      }, 50);
    });
  });

  it('rejects connection from non-extension origin', (done) => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'http://localhost:3000' }
    });
    client.on('close', (code) => {
      expect(code).toBe(1008);
      done();
    });
    client.on('error', () => done());
  });

  it('reports disconnected after client closes', (done) => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'chrome-extension://abcdefghijklmnop' }
    });
    client.on('open', () => {
      client.close();
      setTimeout(() => {
        expect(getConnectionState().connected).toBe(false);
        done();
      }, 100);
    });
  });

  it('returns TIMEOUT_ERROR if no response within timeout', async () => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'chrome-extension://abcdefghijklmnop' }
    });
    await new Promise<void>(resolve => client.on('open', () => resolve()));

    await expect(
      sendToExtension({ action: 'take_screenshot', payload: {} }, 500)
    ).rejects.toMatchObject({ code: 'TIMEOUT_ERROR' });

    client.close();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /media/pc/External/Project/mcp
node --experimental-vm-modules node_modules/.bin/jest src/__tests__/websocket.test.ts --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '../websocket.js'`

**Step 3: Create `src/websocket.ts`**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';
import type { IWsRequest, IWsResponse, IErrorResponse } from './types.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

interface IPendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: IErrorResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

let wss: WebSocketServer | null = null;
let extensionSocket: WebSocket | null = null;
let socketId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const pendingRequests = new Map<string, IPendingRequest>();

function isValidOrigin(origin: string | undefined): boolean {
  return typeof origin === 'string' && origin.startsWith('chrome-extension://');
}

export function getConnectionState(): { connected: boolean; socketId: string | null } {
  return { connected: extensionSocket !== null, socketId };
}

export async function sendToExtension(
  request: Omit<IWsRequest, 'id'>,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Record<string, unknown>> {
  if (!extensionSocket) {
    return Promise.reject({ code: 'EXTENSION_NOT_CONNECTED', message: 'Chrome Extension is not connected' } satisfies IErrorResponse);
  }

  const id = randomUUID();
  const message: IWsRequest = { id, ...request };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject({ code: 'TIMEOUT_ERROR', message: `Request timed out after ${timeoutMs}ms` } satisfies IErrorResponse);
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });

    try {
      extensionSocket!.send(JSON.stringify(message));
    } catch {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject({ code: 'WS_SEND_FAILED', message: 'Failed to send message to extension' } satisfies IErrorResponse);
    }
  });
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!extensionSocket) return;
    let alive = false;
    extensionSocket.ping();
    const timeout = setTimeout(() => {
      if (!alive && extensionSocket) {
        logger.warn('Extension heartbeat timeout — disconnecting');
        extensionSocket.terminate();
        extensionSocket = null;
        socketId = null;
      }
    }, HEARTBEAT_TIMEOUT_MS);
    extensionSocket.once('pong', () => {
      alive = true;
      clearTimeout(timeout);
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export async function startWebSocketServer(port = 9999): Promise<void> {
  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({ host: '127.0.0.1', port });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const origin = req.headers.origin;

      if (!isValidOrigin(origin)) {
        logger.warn('Rejected WebSocket connection from invalid origin', { origin });
        ws.close(1008, 'Invalid origin');
        return;
      }

      if (extensionSocket) {
        logger.warn('New extension connected — replacing existing connection');
        extensionSocket.terminate();
      }

      extensionSocket = ws;
      socketId = randomUUID();
      logger.info('Chrome Extension connected', { socketId, origin });
      startHeartbeat();

      ws.on('message', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString()) as IWsResponse;
          const pending = pendingRequests.get(response.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          pendingRequests.delete(response.id);
          if (response.success && response.data) {
            pending.resolve(response.data);
          } else {
            pending.reject(response.error ?? { code: 'WS_SEND_FAILED', message: 'Unknown error' });
          }
        } catch (error) {
          logger.error('Failed to parse extension message', { error: String(error) });
        }
      });

      ws.on('close', () => {
        if (extensionSocket === ws) {
          extensionSocket = null;
          socketId = null;
          stopHeartbeat();
          logger.info('Chrome Extension disconnected');
        }
      });

      ws.on('error', (error: Error) => {
        logger.error('Extension WebSocket error', { error: error.message });
      });
    });

    wss.on('listening', () => {
      logger.info('WebSocket server started', { port });
      resolve();
    });

    wss.on('error', reject);
  });
}

export async function stopWebSocketServer(): Promise<void> {
  stopHeartbeat();
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject({ code: 'WS_SEND_FAILED', message: 'Server shutting down' });
    pendingRequests.delete(id);
  }
  if (extensionSocket) {
    extensionSocket.terminate();
    extensionSocket = null;
    socketId = null;
  }
  return new Promise((resolve) => {
    if (!wss) { resolve(); return; }
    wss.close(() => { wss = null; resolve(); });
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest src/__tests__/websocket.test.ts --no-coverage 2>&1 | tail -15
```

Expected: PASS — 5 tests pass

**Step 5: Commit**

```bash
git add src/websocket.ts src/__tests__/websocket.test.ts
git commit -m "feat: add WebSocket server with origin validation, heartbeat, request matching"
```

---

### Task 3: Create Puppeteer session manager

**Files:**
- Create: `src/puppeteer-manager.ts`
- Test: `src/__tests__/puppeteer-manager.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/puppeteer-manager.test.ts`:

```typescript
import { describe, it, expect, afterEach } from '@jest/globals';
import {
  createSession,
  getSession,
  destroySession,
  listSessions,
  destroyAll
} from '../puppeteer-manager.js';

describe('PuppeteerManager', () => {
  afterEach(async () => {
    await destroyAll();
  });

  it('creates a session with valid ID format', async () => {
    const id = await createSession();
    expect(id).toMatch(/^session-[a-zA-Z0-9_-]{8}$/);
  }, 30000);

  it('returns the same session when called with existing ID', async () => {
    const id = await createSession();
    const session1 = getSession(id);
    const session2 = getSession(id);
    expect(session1).toBe(session2);
  }, 30000);

  it('lists active sessions', async () => {
    const id = await createSession();
    expect(listSessions()).toContain(id);
  }, 30000);

  it('throws SESSION_NOT_FOUND for unknown sessionId', () => {
    expect(() => getSession('session-notexist')).toThrow('SESSION_NOT_FOUND');
  });

  it('removes session after destroy', async () => {
    const id = await createSession();
    await destroySession(id);
    expect(listSessions()).not.toContain(id);
  }, 30000);

  it('destroyAll closes all sessions', async () => {
    await createSession();
    await createSession();
    await destroyAll();
    expect(listSessions()).toHaveLength(0);
  }, 30000);
});
```

**Step 2: Run test to verify it fails**

```bash
node --experimental-vm-modules node_modules/.bin/jest src/__tests__/puppeteer-manager.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../puppeteer-manager.js'`

**Step 3: Create `src/puppeteer-manager.ts`**

```typescript
import puppeteer, { Browser, Page } from 'puppeteer';
import { nanoid } from 'nanoid';
import { logger } from './logger.js';
import type { IErrorResponse } from './types.js';

interface ISession {
  id: string;
  browser: Browser;
  page: Page;
  createdAt: Date;
}

const sessions = new Map<string, ISession>();

export async function createSession(): Promise<string> {
  const id = `session-${nanoid(8)}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-dev-shm-usage']
  });
  const pages = await browser.pages();
  const page = pages[0] ?? await browser.newPage();
  sessions.set(id, { id, browser, page, createdAt: new Date() });
  logger.info('Puppeteer session created', { id });
  return id;
}

export function getSession(id: string): ISession {
  const session = sessions.get(id);
  if (!session) {
    const error: IErrorResponse = { code: 'SESSION_NOT_FOUND', message: `Session ${id} not found` };
    throw new Error(error.code);
  }
  return session;
}

export async function destroySession(id: string): Promise<void> {
  const session = sessions.get(id);
  if (!session) return;
  try {
    await session.browser.close();
  } catch (error) {
    logger.error('Error closing Puppeteer session', { id, error: String(error) });
  }
  sessions.delete(id);
  logger.info('Puppeteer session destroyed', { id });
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}

export async function destroyAll(): Promise<void> {
  const ids = listSessions();
  await Promise.all(ids.map(id => destroySession(id)));
  logger.info('All Puppeteer sessions destroyed');
}
```

**Step 4: Run tests to verify they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest src/__tests__/puppeteer-manager.test.ts --no-coverage --testTimeout=60000 2>&1 | tail -15
```

Expected: PASS — 6 tests pass (these are slow — Puppeteer launches real browsers)

**Step 5: Commit**

```bash
git add src/puppeteer-manager.ts src/__tests__/puppeteer-manager.test.ts
git commit -m "feat: add Puppeteer session manager with create/get/destroy/list/destroyAll"
```

---

### Task 4: Create mode selector

**Files:**
- Create: `src/mode-selector.ts`
- Test: `src/__tests__/mode-selector.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/mode-selector.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies before importing
jest.unstable_mockModule('../websocket.js', () => ({
  getConnectionState: jest.fn()
}));
jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  createSession: jest.fn()
}));

const { selectMode } = await import('../mode-selector.js');
const { getConnectionState } = await import('../websocket.js');
const { createSession } = await import('../puppeteer-manager.js');

const mockGetConnectionState = getConnectionState as jest.MockedFunction<typeof getConnectionState>;
const mockCreateSession = createSession as jest.MockedFunction<typeof createSession>;

describe('mode-selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-selects headless when sessionId provided', async () => {
    const result = await selectMode({ sessionId: 'session-abc12345' });
    expect(result.mode).toBe('headless');
    expect(result.sessionId).toBe('session-abc12345');
  });

  it('returns headless mode when user chooses headless', async () => {
    mockCreateSession.mockResolvedValue('session-new12345');
    const result = await selectMode({ forceMode: 'headless' });
    expect(result.mode).toBe('headless');
    expect(result.sessionId).toBe('session-new12345');
  });

  it('returns extension mode when connected and user chooses extension', async () => {
    mockGetConnectionState.mockReturnValue({ connected: true, socketId: 'abc' });
    const result = await selectMode({ forceMode: 'extension' });
    expect(result.mode).toBe('extension');
  });

  it('falls back to headless after timeout when extension not connected', async () => {
    mockGetConnectionState.mockReturnValue({ connected: false, socketId: null });
    mockCreateSession.mockResolvedValue('session-fallback1');
    const result = await selectMode({ forceMode: 'extension', waitTimeoutMs: 100, pollIntervalMs: 50 });
    expect(result.mode).toBe('headless');
    expect(result.sessionId).toBe('session-fallback1');
  }, 10000);
});
```

**Step 2: Run test to verify it fails**

```bash
node --experimental-vm-modules node_modules/.bin/jest src/__tests__/mode-selector.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../mode-selector.js'`

**Step 3: Create `src/mode-selector.ts`**

```typescript
import { getConnectionState } from './websocket.js';
import { createSession } from './puppeteer-manager.js';
import { logger } from './logger.js';

export type BrowserMode = 'extension' | 'headless';

export interface IModeResult {
  mode: BrowserMode;
  sessionId?: string;
}

interface ISelectModeOptions {
  sessionId?: string;
  forceMode?: BrowserMode;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

async function waitForExtension(timeoutMs: number, pollMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getConnectionState().connected) return true;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  return false;
}

export async function selectMode(options: ISelectModeOptions = {}): Promise<IModeResult> {
  const {
    sessionId,
    forceMode,
    waitTimeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
  } = options;

  // If sessionId provided, skip prompt and use headless directly
  if (sessionId) {
    return { mode: 'headless', sessionId };
  }

  const mode = forceMode ?? 'extension';

  if (mode === 'headless') {
    const newSessionId = await createSession();
    return { mode: 'headless', sessionId: newSessionId };
  }

  // Extension mode: check connection
  if (getConnectionState().connected) {
    return { mode: 'extension' };
  }

  // Not connected: wait
  logger.warn('Chrome Extension not connected. Open Chrome manually. Waiting...', {
    waitSeconds: waitTimeoutMs / 1000
  });

  const connected = await waitForExtension(waitTimeoutMs, pollIntervalMs);

  if (connected) {
    logger.info('Chrome Extension connected within timeout');
    return { mode: 'extension' };
  }

  // Fallback to headless
  logger.warn('Extension not available after timeout. Falling back to Headless mode.');
  const newSessionId = await createSession();
  return { mode: 'headless', sessionId: newSessionId };
}
```

**Step 4: Run tests to verify they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest src/__tests__/mode-selector.test.ts --no-coverage 2>&1 | tail -15
```

Expected: PASS — 4 tests pass

**Step 5: Commit**

```bash
git add src/mode-selector.ts src/__tests__/mode-selector.test.ts
git commit -m "feat: add mode selector with 30s extension wait and headless fallback"
```

---

### Task 5: Update browser_status tool for live state

**Files:**
- Modify: `src/tools/status.ts`
- Test: `src/__tests__/status.test.ts`

**Step 1: Update `src/tools/status.ts`**

Replace the hardcoded values with live state:

```typescript
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { getConnectionState } from '../websocket.js';
import { listSessions } from '../puppeteer-manager.js';

const outputSchema = z.object({
  extensionConnected: z.boolean().describe('Whether the Chrome Extension is connected'),
  headlessSessions: z.array(z.string()).describe('List of active headless session IDs')
});

export const statusTool: ITool = {
  name: 'browser_status',
  options: {
    title: 'Browser Status',
    description: 'Check Chrome Extension connection status and list active headless Puppeteer sessions',
    inputSchema: z.object({}),
    outputSchema
  },
  handler: async (_args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      const { connected } = getConnectionState();
      const sessions = listSessions();

      const status = {
        extensionConnected: connected,
        headlessSessions: sessions
      };

      logger.info('browser_status called', status);

      return {
        content: [{ type: 'text', text: JSON.stringify(status) }],
        structuredContent: status
      };
    } catch (error) {
      logger.error('browser_status failed', { error: String(error) });
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'browser_status failed unexpectedly' })
        }]
      };
    }
  }
};
```

**Step 2: Update `src/__tests__/status.test.ts`**

Add mocking for the new imports:

```typescript
import { describe, it, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../websocket.js', () => ({
  getConnectionState: jest.fn().mockReturnValue({ connected: false, socketId: null })
}));
jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  listSessions: jest.fn().mockReturnValue([])
}));

const { statusTool } = await import('../tools/status.js');

describe('browser_status tool', () => {
  it('has correct tool name', () => {
    expect(statusTool.name).toBe('browser_status');
  });

  it('returns extensionConnected: false when not connected', async () => {
    const result = await statusTool.handler({});
    const content = result.content[0];
    if (content.type !== 'text') throw new Error('Expected text content');
    const data = JSON.parse(content.text);
    expect(data.extensionConnected).toBe(false);
  });

  it('returns empty headlessSessions array', async () => {
    const result = await statusTool.handler({});
    const content = result.content[0];
    if (content.type !== 'text') throw new Error('Expected text content');
    const data = JSON.parse(content.text);
    expect(data.headlessSessions).toEqual([]);
  });

  it('returns content with type text', async () => {
    const result = await statusTool.handler({});
    expect(result.content[0].type).toBe('text');
  });

  it('returns structuredContent with correct shape', async () => {
    const result = await statusTool.handler({});
    expect(result.structuredContent).toEqual({
      extensionConnected: false,
      headlessSessions: []
    });
  });
});
```

**Step 3: Run all tests**

```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass (logger + status + websocket + puppeteer-manager + mode-selector)

**Step 4: Commit**

```bash
git add src/tools/status.ts src/__tests__/status.test.ts
git commit -m "feat: update browser_status to return live extension and session state"
```

---

### Task 6: Update index.ts to start WS server and register cleanup

**Files:**
- Modify: `src/index.ts`

**Step 1: Update `src/index.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { statusTool } from './tools/status.js';
import { startWebSocketServer, stopWebSocketServer } from './websocket.js';
import { destroyAll } from './puppeteer-manager.js';
import { WS_PORT } from './config.js';
import type { ITool } from './types.js';

const tools: ITool[] = [
  statusTool
];

async function shutdown(): Promise<void> {
  logger.info('Shutting down browser-control MCP server...');
  await stopWebSocketServer();
  await destroyAll();
  process.exit(0);
}

async function main(): Promise<void> {
  // Start WebSocket server for Chrome Extension
  await startWebSocketServer(WS_PORT);

  // Register cleanup on process exit
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  const server = new McpServer(
    { name: 'browser-control', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );

  for (const tool of tools) {
    server.registerTool(tool.name, tool.options, tool.handler);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('browser-control MCP server started', { tools: tools.map(t => t.name) });
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({
    level: 'error',
    message: 'Fatal startup error',
    error: String(error)
  }) + '\n');
  process.exit(1);
});
```

**Step 2: Build to verify no TypeScript errors**

```bash
cd /media/pc/External/Project/mcp
npm run build 2>&1 | tail -10
```

Expected: Zero errors, `dist/` updated

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: start WS server on startup, register SIGTERM/SIGINT cleanup"
```

---

### Task 7: Create Chrome Extension

**Files:**
- Create: `chrome-extension/manifest.json`
- Create: `chrome-extension/background.js`

**Step 1: Create the directory**

```bash
mkdir -p /media/pc/External/Project/mcp/chrome-extension
```

**Step 2: Create `chrome-extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Browser Control MCP",
  "version": "1.0.0",
  "description": "Connects Claude Code to your Chrome browser for browser control",
  "permissions": ["tabs", "activeTab", "scripting"],
  "background": {
    "service_worker": "background.js"
  }
}
```

**Step 3: Create `chrome-extension/background.js`**

```javascript
// Browser Control MCP — Chrome Extension Background Service Worker
// Connects to the MCP WebSocket server on localhost:9999

const WS_URL = 'ws://127.0.0.1:9999';
const MAX_BACKOFF_MS = 30_000;

let ws = null;
let reconnectDelay = 1000;
let reconnectTimer = null;

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log('[BrowserControlMCP] Connecting to', WS_URL);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[BrowserControlMCP] Connected to MCP server');
    reconnectDelay = 1000; // reset backoff on successful connect
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
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) throw new Error('No active tab found');
      const dataUrl = await chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' });
      return { dataUrl };
    }

    case 'get_url': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab found');
      return { url: tabs[0].url ?? '' };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Start connecting immediately
connect();
```

**Step 4: Commit**

```bash
git add chrome-extension/manifest.json chrome-extension/background.js
git commit -m "feat: add Chrome Extension Manifest V3 with WebSocket bridge and screenshot/url handlers"
```

---

### Task 8: Build, run all tests, verify

**Step 1: Run full test suite**

```bash
cd /media/pc/External/Project/mcp
node --experimental-vm-modules node_modules/.bin/jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass across all suites.

**Step 2: Build TypeScript**

```bash
npm run build 2>&1 | tail -10
```

Expected: Zero TypeScript errors.

**Step 3: Smoke test — start the server**

```bash
timeout 3 node /media/pc/External/Project/mcp/dist/index.js 2>&1 || true
```

Expected output includes:
```json
{"level":"info","message":"WebSocket server started","port":9999,...}
{"level":"info","message":"browser-control MCP server started",...}
```

If you see `EADDRINUSE` on port 9999, another process is using it. Kill it:
```bash
fuser -k 9999/tcp
```

**Step 4: Commit**

```bash
git add -A
git commit -m "build: all tests pass, build clean for Phase 2+4"
```

---

### Task 9: Load extension in Chrome and verify end-to-end

**Step 1: Open Chrome and load the extension**

1. Open Google Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select `/media/pc/External/Project/mcp/chrome-extension/`
6. Note the Extension ID shown (format: `abcdefghijklmnopqrstuvwxyzabcdef`)

**Step 2: Start the MCP server**

In a terminal (keep it running):
```bash
node /media/pc/External/Project/mcp/dist/index.js 2>&1
```

Watch for: `{"level":"info","message":"Chrome Extension connected",...}`

**Step 3: Verify browser_status via Claude Code**

Ask Claude Code: `Call the browser_status tool`

Expected: `{ "extensionConnected": true, "headlessSessions": [] }`

**Step 4: Verify disconnection detection**

Close Chrome (or disable the extension). Within 5 seconds, call `browser_status` again.

Expected: `{ "extensionConnected": false, "headlessSessions": [] }`

---

### Task 10: Update AGENT-LOG.md and docs

**Files:**
- Modify: `docs/AGENT-LOG.md`
- Modify: `docs/implementation/phases.md`
- Modify: `docs/knowledge/setup/current-project-state.md`

**Step 1: Add entry to AGENT-LOG.md**

Add row to Task Log:
```
| 3 | Phase 2+4 | WebSocket Bridge + Puppeteer + Mode Selector | Claude Sonnet 4.6 | Completed | 2026-03-18 | 2026-03-18 | All tasks done. Tests pass. browser_status shows live state. |
```

**Step 2: Check all Phase 2 and Phase 4 boxes in phases.md**

Mark all Phase 2 tasks `[x]` and all Phase 4 tasks `[x]`.

**Step 3: Update current-project-state.md**

- Change overall status to: `Phase 2+4 Complete — Phase 3 Not Started`
- Update Phase Progress table for Phase 2 and Phase 4

**Step 4: Commit**

```bash
git add docs/AGENT-LOG.md docs/implementation/phases.md docs/knowledge/setup/current-project-state.md
git commit -m "docs: mark Phase 2+4 complete"
```

---

## Phase 2+4 Completion Checklist

- [ ] `npm run build` exits with 0 errors
- [ ] `npm test` — all tests pass
- [ ] Server starts and logs WebSocket server started on port 9999
- [ ] `browser_status` returns `extensionConnected: true` when extension loaded
- [ ] `browser_status` returns `extensionConnected: false` within 5s of Chrome closing
- [ ] `browser_status` lists active Puppeteer session IDs
- [ ] Mode selector falls back to Headless after 30s wait
- [ ] All Puppeteer sessions close on server SIGTERM
- [ ] AGENT-LOG.md updated, phases.md Phase 2+4 all boxes checked
