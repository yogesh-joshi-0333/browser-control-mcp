# Browser Control MCP — Testing Guide
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Rules

- Every MCP tool MUST have at least one unit test
- Every WebSocket message type MUST have an integration test using a real `ws` server
- No mocking of the WebSocket layer in integration tests
- No mocking of Puppeteer — use a real headless browser in integration tests
- Tests MUST pass before any phase task checkbox is marked `[x]`

---

## Test Types

| Type | What It Covers | Files |
|------|---------------|-------|
| Unit | Individual tool functions, pure logic, error handling | `src/__tests__/*.test.ts` |
| Integration | Full round-trip via real WS server, real Puppeteer session | `src/__tests__/*.integration.test.ts` |
| Manual | Extension mode — requires real Chrome + loaded extension | Documented in verification steps |

---

## What to Test Per Type

**Unit tests:**
- Tool returns correct success response shape
- Tool returns correct error code for each failure case
- Mode selector prompts correctly
- Session manager creates/reuses/destroys sessions by ID
- Error codes match the standard table exactly

**Integration tests:**
- WebSocket server accepts connection from test client
- WebSocket server rejects unknown origin
- Heartbeat marks client as disconnected after 5s with no pong
- `browser_screenshot` full round-trip via real WS (server + test extension client)
- `browser_screenshot` via real Puppeteer session
- Session reuse: two calls with same sessionId use same Puppeteer page

---

## Unit Test Example

```typescript
// src/__tests__/status.test.ts
import { browserStatus } from '../tools/status';

describe('browser_status', () => {
  it('returns extensionConnected: false when no extension is connected', async () => {
    const result = await browserStatus();
    expect(result.extensionConnected).toBe(false);
    expect(result.headlessSessions).toEqual([]);
    expect(result.timestamp).toBeDefined();
  });
});
```

---

## Integration Test Example

```typescript
// src/__tests__/websocket.integration.test.ts
import { WebSocketServer } from '../websocket';
import WebSocket from 'ws';

describe('WebSocket bridge', () => {
  let server: WebSocketServer;

  beforeEach(async () => {
    server = new WebSocketServer(9998); // test port
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('accepts connection from authorized extension origin', (done) => {
    const ws = new WebSocket('ws://127.0.0.1:9998', {
      headers: { origin: 'chrome-extension://test-extension-id' }
    });
    ws.on('open', () => {
      expect(server.isConnected()).toBe(true);
      ws.close();
      done();
    });
  });

  it('rejects connection from unknown origin', (done) => {
    const ws = new WebSocket('ws://127.0.0.1:9998', {
      headers: { origin: 'http://malicious-site.com' }
    });
    ws.on('close', (code) => {
      expect(code).toBe(4001);
      done();
    });
  });
});
```

---

## How to Run Tests

```bash
# All tests
npm test

# Watch mode (during development)
npm run test:watch

# With coverage report
npm run test:coverage

# Single test file
npx jest src/__tests__/status.test.ts
```

---

## Test File Naming and Location

| Test Type | Location | Naming Pattern |
|-----------|----------|---------------|
| Unit | `mcp-server/src/__tests__/` | `<module>.test.ts` |
| Integration | `mcp-server/src/__tests__/` | `<module>.integration.test.ts` |

---

## Pre-Completion Checklist

Before marking any task `[x]`:

- [ ] All existing tests still pass: `npm test`
- [ ] New test written for the new feature
- [ ] New test covers at least one error case
- [ ] No test uses mocked WebSocket or mocked Puppeteer
- [ ] Test file follows naming convention
