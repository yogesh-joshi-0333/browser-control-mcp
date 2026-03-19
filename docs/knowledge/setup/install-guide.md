# Browser Control MCP — Install Guide
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Prerequisites

| Tool | Version | How to Check |
|------|---------|-------------|
| Node.js | 20.x LTS | `node --version` |
| npm | 10.x | `npm --version` |
| Google Chrome | Latest stable | Open Chrome → `chrome://settings/help` |
| Claude Code | Latest | VSCode Extensions panel |
| Git | Any | `git --version` |

---

## Step-by-Step Installation

### 1. Clone or create the project directory

```bash
mkdir -p /media/pc/External/Project/mcp
cd /media/pc/External/Project/mcp
```

### 2. Initialize the MCP Server

```bash
cd /media/pc/External/Project/mcp
npm install
npm run build
```

### 3. Create the config file

Create `/media/pc/External/Project/mcp/config.json`:

```json
{
  "wsPort": 9999,
  "extensionId": "YOUR_CHROME_EXTENSION_ID_HERE",
  "wsTimeoutMs": 10000,
  "heartbeatIntervalMs": 30000,
  "heartbeatTimeoutMs": 5000
}
```

*You will fill in `extensionId` after loading the Chrome Extension in Step 5.*

### 4. Register with Claude Code

Add to `~/.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "node",
      "args": ["/media/pc/External/Project/mcp/dist/index.js"]
    }
  }
}
```

### 5. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the folder: `/media/pc/External/Project/mcp/chrome-extension/`
5. Copy the **Extension ID** shown (format: `abcdefghijklmnopqrstuvwxyz123456`)
6. Paste the Extension ID into `config.json` as `extensionId`

### 6. Restart Claude Code

Close and reopen VSCode, or run: **Claude Code: Restart MCP Servers** from the command palette.

---

## Verification Steps

**Step 1 — MCP Server registered:**
Open Claude Code and ask: "What browser tools do you have?"
Expected: Claude lists `browser_select_mode`, `browser_status`, `browser_screenshot`, `browser_get_url`, `browser_navigate`, `browser_click`, `browser_scroll`, `browser_type`, `browser_get_dom`, `browser_console_logs`

**Step 2 — Extension connected:**
Ask Claude: "Call browser_status"
Expected response includes: `"extensionConnected": true`

**Step 3 — Screenshot working:**
Open any webpage in Chrome. Ask Claude: "Take a screenshot of my current browser tab"
Expected: Claude describes the page content

---

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `wsPort` | `9999` | WebSocket server port |
| `extensionId` | (required) | Chrome Extension ID from chrome://extensions |
| `wsTimeoutMs` | `10000` | Milliseconds to wait for extension response |
| `heartbeatIntervalMs` | `30000` | Ping interval in milliseconds |
| `heartbeatTimeoutMs` | `5000` | Time to wait for pong before marking disconnected |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `browser_status` returns `extensionConnected: false` | Ensure Chrome is open, extension is loaded and enabled in `chrome://extensions` |
| Claude Code does not show `browser-control` server | Check `~/.claude/settings.json` path is correct; restart Claude Code |
| `TIMEOUT_ERROR` on screenshot | Check extension is not suspended; reload extension in `chrome://extensions` |
| WebSocket connection refused | Ensure MCP Server is running (`npm start` in `/media/pc/External/Project/mcp/`) |
| Extension fails to connect after Chrome restart | Chrome service workers restart automatically — wait 5 seconds and try again |
| Screenshot returns blank image | Active tab must be a regular web page — not `chrome://` pages |
