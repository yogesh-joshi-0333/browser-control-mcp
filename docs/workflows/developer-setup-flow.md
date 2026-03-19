# Workflow: Developer Setup Flow
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Overview

This workflow describes the complete journey a developer takes to go from zero to a working Browser Control MCP installation — from cloning the project to making the first successful browser_screenshot call through Claude.

---

## First-Time Setup Flow

```
Step 1: Verify Prerequisites
   node --version  → must be 20.x
   npm --version   → must be 10.x
   Chrome          → must be installed
   Claude Code     → must be installed in VSCode
         |
         v
Step 2: Go to Project Directory
   cd /media/pc/External/Project/mcp
         |
         v
Step 3: Build MCP Server
   npm install
   npm run build
   → dist/ folder created with compiled JS
         |
         v
Step 4: Create config.json
   Copy config.template.json → config.json
   Leave extensionId blank for now
         |
         v
Step 5: Load Chrome Extension
   Open Chrome → chrome://extensions
   Enable Developer mode
   Click "Load unpacked" → select chrome-extension/ folder
   Copy the Extension ID (e.g. "abcdefghijklmnop...")
         |
         v
Step 6: Update config.json
   Set extensionId to the copied Extension ID
         |
         v
Step 7: Register with Claude Code
   Edit ~/.claude/settings.json
   Add mcpServers entry with path to dist/index.js
         |
         v
Step 8: Restart Claude Code
   Close and reopen VSCode
   OR: Command Palette → "Claude Code: Restart MCP Servers"
         |
         v
Step 9: Verify
   Ask Claude: "Call browser_status"
   Expected: extensionConnected: true
         |
         v
Step 10: First Screenshot
   Open any webpage in Chrome
   Ask Claude: "Take a screenshot of my current browser tab"
   Expected: Claude describes the page content
         |
         v
SETUP COMPLETE
```

---

## Normal Daily Development Flow

```
1. Open VSCode with Claude Code
2. Open Chrome (extension auto-connects on browser start)
3. Ask Claude about any browser-related task
4. Claude uses tools as needed — mode prompt appears per call
5. Select Extension (to work on real tab) or Headless (background automation)
6. Review Claude's analysis and accept/reject changes
```

---

## Updating the Extension

When new Chrome Extension code is released:

```
1. Open chrome://extensions
2. Click the refresh icon on the Browser Control extension
   OR: Remove and re-add with "Load unpacked"
3. Extension reconnects to MCP Server automatically within 5 seconds
4. No MCP Server restart needed
```

---

## Updating the MCP Server

When new MCP Server code is released:

```
1. Pull latest code
2. cd /media/pc/External/Project/mcp && npm install && npm run build
3. Restart Claude Code to reload the MCP Server
4. Verify with browser_status
```

---

## Troubleshooting Flow

```
Problem: "browser-control" not listed in Claude Code MCP servers

Check 1: ~/.claude/settings.json has correct path to dist/index.js
Check 2: Path uses absolute path (not relative)
Check 3: dist/index.js exists (run npm run build if not)
Check 4: Restart Claude Code after settings change
Check 5: Check Claude Code output panel for MCP errors

Problem: Extension keeps disconnecting

Check 1: Chrome service workers can be killed after 5 minutes of inactivity
Check 2: This is normal — extension reconnects automatically
Check 3: If repeated, check MCP Server is still running
Check 4: Check config.json extensionId is correct

Problem: Tests failing in development

Check 1: npm test from project root (/media/pc/External/Project/mcp)
Check 2: Check if a test is using a port already in use (default test port 9998)
Check 3: Ensure no other instance of the test is running
```
