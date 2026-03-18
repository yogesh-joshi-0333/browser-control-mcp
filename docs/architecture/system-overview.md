# Browser Control MCP — System Overview
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Full Architecture Diagram

```
+------------------------------------------------------------------+
|                        DEVELOPER MACHINE                         |
|                                                                  |
|  +----------------------+         +---------------------------+  |
|  |   VSCode + Claude    |         |   Google Chrome Browser   |  |
|  |   Code Extension     |         |                           |  |
|  |                      |         |  +---------------------+  |  |
|  |  Claude Agent calls  |         |  | Chrome Extension    |  |  |
|  |  MCP tools           |         |  | (Manifest V3)       |  |  |
|  +----------|-----------+         |  |                     |  |  |
|             |                     |  | background.js       |  |  |
|             | MCP Protocol        |  | (service worker)    |  |  |
|             | (stdio)             |  |                     |  |  |
|             v                     |  | content.js          |  |  |
|  +----------------------+         |  | (tab injection)     |  |  |
|  |     MCP Server       |         |  +--------^------------+  |  |
|  |  (Node.js/TypeScript)|         |           |               |  |
|  |                      |  WS     |  User's Real Tabs         |  |
|  |  - Tool Registry     |<------->|  (active tab)             |  |
|  |  - Mode Selector     | :9999   |                           |  |
|  |  - Session Manager   |         +---------------------------+  |
|  |  - WS Server         |                                        |
|  |  - Error Handler     |         +---------------------------+  |
|  |                      |         | Puppeteer Headless        |  |
|  |                      |-------->| Browser Sessions          |  |
|  +----------------------+ Direct  |                           |  |
|                           API     | session-a1b2c3d4 (tab 1) |  |
|                                   | session-e5f6g7h8 (tab 2) |  |
|                                   +---------------------------+  |
+------------------------------------------------------------------+

All communication stays on localhost. Nothing leaves the machine.
```

---

## Component Responsibilities

| Component | Technology | Role |
|-----------|-----------|------|
| MCP Server | Node.js 20.x + TypeScript 5.x | Receives tool calls from Claude, routes to Extension or Puppeteer, returns results |
| WebSocket Server | ws 8.x (inside MCP Server) | Maintains persistent connection to Chrome Extension on localhost:9999 |
| Chrome Extension | Manifest V3 + JavaScript ES2022 | Executes commands inside user's real Chrome tabs, returns results over WebSocket |
| Extension Background | Chrome Service Worker | Manages WebSocket connection to MCP Server, relays messages |
| Extension Content Script | Injected JavaScript | Runs inside tab context: captures screenshots, reads DOM, clicks, scrolls |
| Puppeteer Manager | Puppeteer 21.x | Creates and manages isolated headless Chrome sessions identified by session ID |
| Mode Selector | TypeScript (inside MCP Server) | Prompts user per tool call to choose Extension or Headless mode |
| Session Manager | TypeScript (inside MCP Server) | Tracks all active Puppeteer sessions, creates/reuses/destroys by ID |

---

## Request / Response Flow (Normal Operation)

Step-by-step walkthrough of `browser_screenshot` in Extension mode:

```
Step 1:  Developer asks Claude: "Take a screenshot of my current tab"
Step 2:  Claude calls MCP tool: browser_screenshot
Step 3:  MCP Server receives tool call via stdio
Step 4:  MCP Server checks: is mode provided? No → prompt user
Step 5:  User selects: "Extension" mode
Step 6:  MCP Server checks: is Extension connected? Yes → proceed
Step 7:  MCP Server generates request ID (uuid v4)
Step 8:  MCP Server sends WebSocket message:
         { "id": "req-abc123", "action": "take_screenshot", "payload": {} }
Step 9:  Chrome Extension background.js receives message
Step 10: background.js calls chrome.tabs.captureVisibleTab()
Step 11: background.js sends response:
         { "id": "req-abc123", "success": true, "data": { "image": "<base64>", "url": "https://..." } }
Step 12: MCP Server matches response to pending request by ID
Step 13: MCP Server returns tool result to Claude:
         { "image": "<base64>", "url": "https://...", "mode": "extension" }
Step 14: Claude receives image, describes what it sees
```

---

## Security Boundary Diagram

```
+-- TRUSTED BOUNDARY (localhost only) --+
|                                       |
|  MCP Server (127.0.0.1:9999)         |
|       |                               |
|       | WebSocket (localhost only)    |
|       |                               |
|  Chrome Extension (registered ID)    |
|                                       |
+---------------------------------------+
         |
         | chrome.tabs API (browser internal)
         v
  User's Chrome Tabs (sandboxed)

OUTSIDE TRUSTED BOUNDARY:
- Internet (no connections made)
- Other processes on machine (WebSocket rejects non-extension origins)
- Disk (no screenshot writes)
```

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20.x LTS | MCP Server runtime |
| Language | TypeScript | 5.x | Type-safe MCP Server code |
| MCP Protocol | @modelcontextprotocol/sdk | latest | Claude ↔ MCP Server communication |
| WebSocket | ws | 8.x | MCP Server ↔ Extension bridge |
| Headless browser | Puppeteer | 21.x | Isolated browser sessions |
| Extension platform | Chrome Manifest V3 | — | Real Chrome tab access |
| Extension language | JavaScript | ES2022 | Extension background + content scripts |
| ID generation | nanoid | 4.x | Session IDs and request IDs |
| Testing | Jest + ts-jest | latest | Unit and integration tests |
| Linting | ESLint + @typescript-eslint | latest | Code quality |
| Package manager | npm | 10.x | Dependency management |
