# Module: Puppeteer Manager
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Role

The Puppeteer Manager creates and manages isolated headless Chrome browser sessions for the Headless mode. Each session has a unique ID, runs its own Puppeteer browser instance, and can be reused across multiple tool calls by passing the session ID. Sessions persist until explicitly destroyed or the MCP Server process exits.

---

## Technology

| Item | Technology |
|------|-----------|
| Library | Puppeteer 21.x |
| ID generation | nanoid 4.x |
| Session format | `session-<nanoid(8)>` |
| Default viewport | 1280×800 |
| Mode | Headless (background, no visible window) |

---

## File Structure

```
mcp-server/src/puppeteer-manager.ts
```

---

## Key Functions / Methods

| Function | Description |
|----------|-------------|
| `SessionManager.create()` | Launches new Puppeteer browser + page, assigns session ID, stores in map, returns session ID |
| `SessionManager.get(sessionId)` | Returns `{ browser, page }` for sessionId, throws SESSION_NOT_FOUND if not found |
| `SessionManager.list()` | Returns array of `{ sessionId, url, createdAt }` for all active sessions |
| `SessionManager.destroy(sessionId)` | Closes browser for sessionId, removes from map |
| `SessionManager.destroyAll()` | Closes all browsers — called on SIGTERM/SIGINT |
| `SessionManager.getOrCreate(sessionId?)` | If sessionId provided → get existing; if not → create new; returns `{ sessionId, page }` |

---

## Session Object Structure

```typescript
interface ISession {
  sessionId: string;       // "session-a1b2c3d4"
  browser: Browser;        // Puppeteer Browser instance
  page: Page;              // Puppeteer Page instance
  createdAt: Date;
}
```

---

## Lifecycle

```
CREATE SESSION:
  puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 800 } })
  browser.newPage()
  sessionId = "session-" + nanoid(8)
  sessions.set(sessionId, { browser, page, createdAt: new Date() })
  return sessionId

GET SESSION:
  const session = sessions.get(sessionId)
  if (!session) throw SESSION_NOT_FOUND
  return session

REUSE SESSION:
  Same page is reused — maintains all state (cookies, navigation history, console buffer)

DESTROY SESSION:
  await browser.close()
  sessions.delete(sessionId)

DESTROY ALL (on process exit):
  for each session: await browser.close()
  sessions.clear()
```

---

## Dependencies on Other Modules

| Module | Used For |
|--------|---------|
| [mcp-server](./mcp-server.md) | Parent — creates and owns SessionManager |

---

## Error Handling

| Scenario | Error Code |
|----------|-----------|
| `get()` called with unknown ID | `SESSION_NOT_FOUND` |
| `puppeteer.launch()` fails | `PUPPETEER_LAUNCH_FAILED` |
| `page.screenshot()` fails | `TAB_CAPTURE_FAILED` |
| `page.goto()` fails | `NAVIGATE_FAILED` |
| `page.$()` returns null | `ELEMENT_NOT_FOUND` |

---

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `headless` | `true` | Always headless for background sessions |
| `defaultViewport.width` | `1280` | Browser window width |
| `defaultViewport.height` | `800` | Browser window height |
| Sandbox | enabled | Never disable sandbox (`--no-sandbox` is forbidden) |
