# Browser Control MCP — Security Standards
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Core Security Principle

The MCP Server controls a browser on the user's machine. Every attack surface must be minimized. No data leaves localhost. No external connections are made.

---

## Network Binding Rules

- The WebSocket server MUST bind to `127.0.0.1` ONLY — never `0.0.0.0`
- Port `9999` must not be exposed to any firewall rule or network interface
- The MCP Server communicates with Claude Code via stdio — no network port for MCP
- No outbound network connections are made by the MCP Server

---

## Extension Origin Validation

- The WebSocket server MUST read the allowed extension ID from `config.json`
- On every new WebSocket connection, validate the `Origin` header matches `chrome-extension://<allowed-id>`
- Connections from any other origin MUST be immediately terminated with code 4001
- Log all rejected connections at `warn` level with the rejected origin

```typescript
// Correct pattern
const origin = request.headers['origin'] as string;
if (!origin.startsWith(`chrome-extension://${config.extensionId}`)) {
  socket.terminate();
  logger.warn('websocket', 'Rejected unauthorized connection', { origin });
  return;
}
```

---

## Input Validation

| Input Type | Validation Required |
|------------|-------------------|
| CSS selector | Must be a non-empty string; length ≤ 500 chars |
| URL for navigate | Must start with `http://` or `https://`; no `javascript:` |
| Scroll pixels | Must be a number; abs value ≤ 100,000 |
| Type text | Must be a string; length ≤ 10,000 chars |
| Session ID | Must match pattern `session-[a-zA-Z0-9]{8}` |
| Mode | Must be exactly `"extension"` or `"headless"` |

---

## Data Handling Rules

| Data Type | Rule |
|-----------|------|
| Screenshot base64 | Never written to disk — stay in memory, return in response |
| DOM HTML | Never written to disk — return in response only |
| Console logs | Never persisted — buffer cleared per session or on request |
| Session IDs | Safe to log — not sensitive |
| Page URLs | Safe to log |
| Page content | MUST NOT be logged |
| User input text | MUST NOT be logged |

---

## Chrome Extension Permissions

Minimum required permissions only. Never request more than needed for the current version.

| Permission | Required In | Why |
|------------|------------|-----|
| `tabs` | V1 | Query active tab URL and ID |
| `activeTab` | V1 | Capture screenshot of active tab |
| `scripting` | V2 | Inject content scripts for click/scroll |
| `tabCapture` | V3 | Session recording |

Do NOT add `<all_urls>` host permission — use `activeTab` instead.

---

## Puppeteer Security

- Launch Puppeteer with default sandbox enabled (no `--no-sandbox` flag)
- Do NOT launch with `--disable-web-security`
- Do NOT launch with `--allow-running-insecure-content`
- Headless sessions MUST NOT have access to the user's Chrome profile or cookies
- Always launch with `headless: true` for background sessions

---

## Rate Limiting

- No rate limiting needed in V1 (single local developer user)
- If future versions add multi-user support, implement per-origin rate limiting at the WebSocket level
