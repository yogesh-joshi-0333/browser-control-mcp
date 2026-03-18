# Workflow: Claude Agent Browser Workflow
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Overview

This workflow describes how Claude (the AI agent) uses the Browser Control MCP tools to complete browser-related tasks. Claude is both an actor and the driver of this workflow — it decides which tool to call, interprets the results, and iterates until the task is complete.

---

## First-Time Setup Flow

```
Developer installs MCP Server
         |
         v
Developer loads Chrome Extension
         |
         v
Developer adds MCP entry to ~/.claude/settings.json
         |
         v
Claude Code restarts and loads browser-control MCP
         |
         v
Claude now has browser tools available
         |
         v
Claude calls browser_status → confirms extensionConnected: true
```

---

## Daily Use Flow — UI Improvement Task

```
Developer: "Improve the styling of my login page"
         |
         v
Claude: calls browser_screenshot
         |
         v
Mode prompt: "Extension or Headless?"
Developer selects: Extension
         |
         v
Claude receives base64 screenshot
Claude analyzes: "The page has no padding, font is too small, no mobile layout"
         |
         v
Claude edits the HTML/CSS file
         |
         v
Developer refreshes Chrome tab
         |
         v
Claude: calls browser_screenshot again
         |
         v
Claude receives new screenshot
Claude analyzes: "Padding added, but still not responsive"
         |
         v
Claude makes further CSS improvements
         |
         v
[Loop until Claude is satisfied]
         |
         v
Claude: "The login page is now mobile-first, visually clean, and responsive."
```

---

## Daily Use Flow — Bug Investigation Task

```
Developer: "There's a JS error on my dashboard, find it"
         |
         v
Claude: calls browser_console_logs
         |
         v
Mode prompt: "Extension or Headless?"
Developer selects: Extension
         |
         v
Claude receives console log buffer:
  [error] TypeError: Cannot read property 'data' of undefined at dashboard.js:142
         |
         v
Claude: reads dashboard.js line 142
         |
         v
Claude identifies root cause: missing null check
         |
         v
Claude fixes the code
         |
         v
Claude: calls browser_console_logs again (with clear: true)
         |
         v
Claude: "Console is now clean. The error is resolved."
```

---

## Daily Use Flow — Automated Background Test

```
Developer: "Test the checkout flow on http://localhost:3000"
         |
         v
Claude: calls browser_screenshot
Mode prompt: Developer selects Headless
         |
         v
Claude receives sessionId: "session-a1b2c3d4"
Claude: calls browser_navigate { url: "http://localhost:3000", sessionId }
         |
         v
Claude: calls browser_screenshot { sessionId }
Claude sees the homepage
         |
         v
Claude: calls browser_click { selector: ".add-to-cart", sessionId }
Claude: calls browser_screenshot { sessionId }
Claude confirms item added to cart
         |
         v
Claude: calls browser_click { selector: "#checkout-button", sessionId }
Claude: calls browser_screenshot { sessionId }
Claude verifies checkout form appeared
         |
         v
Claude: "Checkout flow works correctly. Cart → Checkout transition is functional."
```

---

## Troubleshooting Flow

```
Problem: browser_screenshot returns EXTENSION_NOT_CONNECTED

Step 1: Check Chrome is open
Step 2: Check chrome://extensions → extension is enabled (not disabled)
Step 3: Call browser_status → if still false, reload extension
Step 4: If still disconnected, check MCP Server is running (npm start)
Step 5: Check config.json extensionId matches the ID in chrome://extensions

Problem: TIMEOUT_ERROR on screenshot

Step 1: Extension may have been suspended by Chrome (service workers can be terminated)
Step 2: Open chrome://extensions → click "Service Worker" link → check if it restarted
Step 3: Navigate to any tab to wake the service worker
Step 4: Retry screenshot

Problem: Screenshot returns blank white image

Cause: Active tab is a chrome:// page (e.g. chrome://extensions, chrome://newtab)
Fix: Navigate to a regular web page and retry
```
