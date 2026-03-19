# Module: MCP Server
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Role

The MCP Server is the central brain of the system. It runs as a Node.js/TypeScript process on the developer's machine, registers with Claude Code via the Model Context Protocol over stdio, and exposes browser control tools that Claude can call. It orchestrates all communication — routing tool calls to either the Chrome Extension (via WebSocket) or Puppeteer headless sessions (direct API), and returning structured results to Claude.

---

## Technology

| Item | Technology |
|------|-----------|
| Runtime | Node.js 20.x LTS |
| Language | TypeScript 5.x (strict mode) |
| MCP SDK | @modelcontextprotocol/sdk |
| WebSocket library | ws 8.x |
| Headless browser | Puppeteer 21.x |
| ID generation | nanoid 4.x |
| Testing | Jest + ts-jest |

---

## File Structure

```
src/
├── index.ts              # Entry: MCP server setup, tool registration, process signals
├── config.ts             # Load config.json, export typed config object
├── logger.ts             # Structured logger (info/warn/error)
├── types.ts              # Shared interfaces: IToolResult, IWsRequest, IWsResponse, etc.
├── websocket.ts          # WebSocket server: accept/reject connections, send/receive, heartbeat
├── mode-selector.ts      # Mode selection with defaultMode state management
├── puppeteer-manager.ts  # Session lifecycle: create, get, destroy, destroyAll, list
└── tools/
    ├── select-mode.ts    # browser_select_mode
    ├── status.ts         # browser_status
    ├── screenshot.ts     # browser_screenshot
    ├── get-url.ts        # browser_get_url
    ├── navigate.ts       # browser_navigate
    ├── click.ts          # browser_click
    ├── scroll.ts         # browser_scroll
    ├── type.ts           # browser_type
    ├── get-dom.ts        # browser_get_dom
    └── console-logs.ts   # browser_console_logs
```

---

## Key Functions / Methods

| Function | File | Description |
|----------|------|-------------|
| `main()` | `index.ts` | Entry point — creates MCP server, registers tools, starts WS server |
| `loadConfig()` | `config.ts` | Reads and validates `config.json` |
| `logger.info/warn/error()` | `logger.ts` | Structured logging |
| `WebSocketServer.start()` | `websocket.ts` | Binds WS server to 127.0.0.1:port |
| `WebSocketServer.send()` | `websocket.ts` | Sends command to extension, returns Promise with response |
| `WebSocketServer.isConnected()` | `websocket.ts` | Returns boolean connection state |
| `selectMode()` | `mode-selector.ts` | Returns `"extension"` or `"headless"` based on default mode or availability |
| `setDefaultMode()` | `mode-selector.ts` | Sets session-level default mode (extension or headless) |
| `getDefaultMode()` | `mode-selector.ts` | Returns current default mode or null |
| `clearDefaultMode()` | `mode-selector.ts` | Clears the session default mode |
| `SessionManager.create()` | `puppeteer-manager.ts` | Launches new Puppeteer browser, returns session ID |
| `SessionManager.get()` | `puppeteer-manager.ts` | Returns existing session by ID or throws SESSION_NOT_FOUND |
| `SessionManager.list()` | `puppeteer-manager.ts` | Returns all active sessions with ID and current URL |
| `SessionManager.destroyAll()` | `puppeteer-manager.ts` | Closes all Puppeteer browsers — called on process exit |

---

## Lifecycle

```
1. STARTUP
   - Load config.json
   - Start WebSocket server on 127.0.0.1:9999
   - Register MCP tools with Claude Code via stdio
   - Log: "MCP Server started"

2. NORMAL OPERATION
   - Claude calls a tool
   - Tool function runs
   - If mode = extension → send WS message → wait for response (10s timeout)
   - If mode = headless → create/reuse Puppeteer session → execute directly
   - Return structured result to Claude

3. SHUTDOWN
   - Receive SIGTERM or SIGINT
   - Call SessionManager.destroyAll() — close all Puppeteer browsers
   - Close WebSocket server
   - Process exits cleanly
```

---

## Dependencies on Other Modules

| Module | Used For |
|--------|---------|
| [websocket-bridge](./websocket-bridge.md) | Extension mode tool execution |
| [puppeteer-manager](./puppeteer-manager.md) | Headless mode tool execution |
| [chrome-extension](./chrome-extension.md) | Remote execution target (Extension mode) |

---

## Error Handling

- All tool functions catch exceptions and return structured `{ error: { code, message } }` — never throw
- `websocket.ts` returns `EXTENSION_NOT_CONNECTED` if no connection, `TIMEOUT_ERROR` if no response in 10s
- `puppeteer-manager.ts` returns `SESSION_NOT_FOUND` for unknown session IDs
- Process-level handlers prevent crashes from uncaught exceptions

---

## Configuration Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `wsPort` | number | 9999 | WebSocket server port |
| `extensionId` | string | (required) | Allowed Chrome Extension ID |
| `wsTimeoutMs` | number | 10000 | Max wait for extension response |
| `heartbeatIntervalMs` | number | 30000 | Ping frequency |
| `heartbeatTimeoutMs` | number | 5000 | Max wait for pong |
