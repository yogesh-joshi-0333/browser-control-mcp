# Auto-Setup MCP Client Configuration — Design Spec

**Date:** 2026-04-07
**Author:** Yogesh Joshi
**Status:** Approved

## Goal

When a user runs `npm install -g browser-control-mcp-server`, the package automatically detects installed AI clients and adds the `browser-control` MCP server entry to each one's config file — no manual steps required.

---

## Architecture

Two scripts in `scripts/`:

- **`postinstall.js`** — entry point, runs on install. Calls Chrome detection (existing), then calls `setup.js`.
- **`setup.js`** — new file. Handles all client detection, config merging, and result reporting.

Both are plain `.js` ES module files (no TypeScript, no build step needed — they run directly via Node).

---

## Clients Supported

| Client | Platform | Config File Path |
|--------|----------|-----------------|
| Claude Desktop | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop | Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop | Linux | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code | all | `.mcp.json` in current working directory |
| Cursor | macOS/Linux | `~/.cursor/mcp.json` |
| Cursor | Windows | `%APPDATA%\Cursor\mcp.json` |
| Windsurf | macOS/Linux | `~/.codeium/windsurf/mcp_config.json` |
| Windsurf | Windows | `%APPDATA%\Codeium\windsurf\mcp_config.json` |
| VS Code (Copilot/Cline) | macOS | `~/Library/Application Support/Code/User/settings.json` |
| VS Code (Copilot/Cline) | Windows | `%APPDATA%\Code\User\settings.json` |
| VS Code (Copilot/Cline) | Linux | `~/.config/Code/User/settings.json` |
| Zed | macOS/Linux | `~/.config/zed/settings.json` |
| Zed | Windows | `%APPDATA%\Zed\settings.json` |
| Continue | all | `~/.continue/config.json` |
| OpenCode | all | `~/.config/opencode/config.json` |
| Cody (Sourcegraph) | macOS | `~/Library/Application Support/Cody/cody_desktop_config.json` |
| Cody (Sourcegraph) | Windows | `%APPDATA%\Cody\cody_desktop_config.json` |
| Cody (Sourcegraph) | Linux | `~/.config/Cody/cody_desktop_config.json` |

---

## MCP Entry Written

```json
"browser-control": {
  "command": "npx",
  "args": ["browser-control-mcp-server"]
}
```

---

## Logic Per Client

1. Resolve config file path for current OS
2. If path does not exist → status: **skipped** (client not installed)
3. If path exists → parse JSON
4. If `mcpServers.browser-control` already present → status: **already configured** (no-op)
5. Otherwise → merge entry into `mcpServers` → write back with 2-space indent
6. Status: **configured**

Config structure varies by client — handled per client:

- **Standard** (`mcpServers` at root): Claude Desktop, Cursor, Windsurf, OpenCode, Continue, Cody
- **VS Code settings.json**: entry goes under `"mcp.servers"` key
- **Zed settings.json**: entry goes under `"context_servers"` key
- **Claude Code `.mcp.json`**: `mcpServers` at root, written to cwd

---

## Output on Install

```
[browser-control-mcp] Configuring AI clients...
  ✓ Claude Desktop configured
  ✓ Cursor configured
  ✓ VS Code (Copilot/Cline) configured
  — Windsurf not found (skipped)
  — Zed not found (skipped)
  ~ Continue already configured
[browser-control-mcp] Done. Restart your AI client to activate browser-control.
```

---

## Error Handling

- If a config file exists but has invalid JSON → print warning, skip that client (never corrupt user config)
- If write fails (permissions) → print warning with manual instructions
- Errors in setup never fail the overall `npm install` (process exits 0)

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/setup.js` | New file — all client detection + config merging |
| `scripts/postinstall.js` | Add call to `setup.js` after Chrome detection |
| `package.json` | Bump version to `1.1.0` |
| `README.md` | Add "Auto-Setup" section at top |
