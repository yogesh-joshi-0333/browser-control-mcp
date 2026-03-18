# Module: WebSocket Bridge
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Role

The WebSocket Bridge is the communication channel between the MCP Server and the Chrome Extension. It runs inside the MCP Server as a WebSocket server on `127.0.0.1:9999`. It accepts exactly one connection from the Chrome Extension, validates its origin, maintains the connection with heartbeat, and provides a request/response mechanism with unique IDs and 10-second timeouts.

---

## Technology

| Item | Technology |
|------|-----------|
| Library | ws 8.x |
| Transport | WebSocket (RFC 6455) |
| Binding | `127.0.0.1:9999` only |
| Message format | JSON with `{ id, action, payload }` / `{ id, success, data/error }` |

---

## File Structure

```
mcp-server/src/websocket.ts    # WebSocket server class
```

---

## Key Functions / Methods

| Function | Description |
|----------|-------------|
| `WebSocketServer.start()` | Binds WS server, sets up connection handler |
| `WebSocketServer.stop()` | Closes server and all connections |
| `WebSocketServer.send(request)` | Sends command to extension, returns Promise that resolves with response |
| `WebSocketServer.isConnected()` | Returns true if extension is currently connected |
| `WebSocketServer.validateOrigin(req)` | Validates `Origin` header against configured extension ID |
| `WebSocketServer.startHeartbeat()` | Sends ping every 30s, marks disconnected if no pong in 5s |
| `WebSocketServer.waitForResponse(id, ms)` | Stores pending callback for request ID, resolves on matching response, times out after ms |

---

## Lifecycle

```
STARTUP:
  ws.Server created, bound to 127.0.0.1:9999

EXTENSION CONNECTS:
  validateOrigin() → reject if unknown
  Store as this.client
  Start heartbeat timer
  Log: "Extension connected"

COMMAND SENT (MCP Server → Extension):
  Generate uuid v4 request ID
  Store resolve callback in this.pending Map
  ws.send(JSON.stringify(request))
  Set 10s timeout → resolve with TIMEOUT_ERROR if no response

RESPONSE RECEIVED (Extension → MCP Server):
  Parse JSON
  Look up pending callback by response.id
  Clear timeout
  Call callback with response data

EXTENSION DISCONNECTS:
  Clear client reference
  Clear heartbeat timer
  Log: "Extension disconnected"

HEARTBEAT:
  Every 30s: ws.ping()
  Expect ws.pong() within 5s
  If no pong: set connected = false, terminate socket
```

---

## Dependencies on Other Modules

| Module | Used For |
|--------|---------|
| [mcp-server](./mcp-server.md) | Parent — creates and owns WebSocket server |
| [chrome-extension](./chrome-extension.md) | Remote client that connects to this server |

---

## Error Handling

| Scenario | Response |
|----------|---------|
| Unknown origin | Terminate connection, return nothing |
| Second extension tries to connect | Terminate second connection — only one allowed |
| `ws.send()` throws | Return `WS_SEND_FAILED` error |
| No response within 10s | Return `TIMEOUT_ERROR` error |
| Extension disconnects mid-request | Pending callbacks resolve with `EXTENSION_NOT_CONNECTED` |
