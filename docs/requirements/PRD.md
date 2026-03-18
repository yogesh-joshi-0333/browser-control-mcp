# Browser Control MCP — Product Requirements Document
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Problem Statement

Claude Code (Anthropic's AI coding assistant) cannot see or interact with a web browser. When a developer asks Claude to improve a UI, fix a layout bug, or test a web feature, Claude works blind — it cannot see what the page looks like, cannot verify its changes render correctly, and cannot interact with the running application.

Google's Antigravity IDE solves this with a browser subagent that can take screenshots, inspect the DOM, click elements, read console logs, and more — creating a visual feedback loop between the AI and the browser. Claude Code has no equivalent capability.

---

## Solution

Browser Control MCP provides Claude Code with full browser control through three integrated components:

1. **MCP Server (Node.js/TypeScript)** — exposes browser tools to Claude via the Model Context Protocol
2. **Chrome Extension (Manifest V3)** — bridges Claude to the user's real Chrome tabs via WebSocket
3. **Puppeteer integration** — provides isolated headless browser sessions for background/automated tasks

Every time Claude needs a browser, the user chooses: work in their real Chrome tab (Extension mode) or launch an isolated background browser (Headless mode). This gives full Antigravity parity with the added benefit of dual-mode flexibility.

---

## Architecture Summary

The MCP Server runs locally as a Node.js process registered with Claude Code. It exposes browser tools (screenshot, click, scroll, etc.) that Claude can call. When called, the server either routes the command to the Chrome Extension via a local WebSocket connection on `localhost:9999`, which executes it in the user's active tab, or directly controls a Puppeteer headless browser session identified by a session ID. Both modes return structured results back to Claude.

---

## Goals

1. Give Claude Code the ability to take screenshots of web pages and describe what it sees
2. Give Claude Code the ability to interact with web pages (click, scroll, type) in V2
3. Give Claude Code full Antigravity-level browser intelligence in V3
4. Work entirely locally — no cloud services, no data leaving the machine
5. Support both real Chrome tabs (user sees it) and headless background sessions
6. Be installable in under 10 minutes for a developer with Node.js already installed

---

## Non-Goals (V1 Scope Boundaries)

- No cloud/remote browser control — local machine only
- No mobile browser control
- No Firefox or Safari support — Chrome only
- No multi-tab management (switching tabs) — active tab only in V1
- No file upload/download automation
- No proxy or VPN routing through the browser
- No persistence of screenshots to disk (in-memory only)

---

## Users

| User Type | Goal | Technical Level | Notes |
|-----------|------|----------------|-------|
| AI-enabled Senior Developer | Give Claude visual feedback loop for UI/frontend work | Advanced (10+ years, AI-native workflow) | Primary user — single developer on local machine |
| Claude Agent | Use browser tools to inspect, interact with, and improve web pages | N/A (automated) | Secondary "user" — the AI calling the MCP tools |

---

## Key Features

| Feature | Version | Description |
|---------|---------|-------------|
| Screenshot capture | V1 | Capture current page as base64 image |
| URL retrieval | V1 | Get active tab URL |
| Extension status | V1 | Check connection state + list headless sessions |
| Dual-mode selection | V1 | User picks Extension or Headless per call |
| Headless session management | V1 | Create, reuse, destroy Puppeteer sessions by ID |
| Element click | V2 | Click by CSS selector or coordinates |
| Page scroll | V2 | Scroll by pixels or to element |
| Console log reading | V2 | Read JS console output |
| DOM inspection | V3 | Get full page HTML/DOM |
| Form input | V3 | Type text into fields |
| Navigation | V3 | Navigate to any URL |
| Session recording | V3 | Record browser session as video |
| Visual regression | V3 | Compare two screenshots |
| UI test runner | V3 | Execute automated UI tests |

---

## Success Metrics

- Claude can describe what is on any open Chrome tab after calling `browser_screenshot`
- Claude can confirm a UI change looks correct without the developer manually checking
- Setup time from zero to working MCP tool call: under 10 minutes
- Zero data leaves localhost at any point
- Extension connects to MCP Server within 2 seconds of browser launch

---

## Constraints

| Constraint | Detail |
|------------|--------|
| Platform | Ubuntu 24.04 Linux, local machine only |
| Browser | Google Chrome only (Manifest V3 extension) |
| Network | localhost only — WebSocket on 127.0.0.1:9999 |
| Node.js | Version 20.x LTS |
| Screenshot size | Return as base64 string — no disk writes |
| Security | Extension origin validation required — reject unknown origins |
| Puppeteer | Must use sandbox (no --no-sandbox flag) |
| Claude Code | Must be installed and running in VSCode |
