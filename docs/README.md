# Browser Control MCP
**Version:** 1.0.0 | **Status:** Documentation Complete — Development Not Started | **Date:** 2026-03-18

## Description

A Model Context Protocol (MCP) server + Chrome Extension + WebSocket bridge that gives Claude Code full Antigravity-style browser control: screenshots, DOM inspection, click, scroll, type, console logs, navigation, recording, and visual regression — in both real Chrome tabs and headless Puppeteer sessions.

---

## Architecture Diagram

```
Claude Code (VSCode Extension)
          |
          | MCP Protocol (stdio)
          v
+-------------------------+
|    MCP Server           |
|  (Node.js/TypeScript)   |
|                         |
|  - Tool registry        |
|  - Mode selector        |
|  - Session manager      |
+-------------------------+
        |           |
        |           | WebSocket (localhost:9999)
        |           v
        |   +--------------------+
        |   | Chrome Extension   |
        |   | (Manifest V3)      |
        |   |                    |
        |   | background.js      |
        |   | content.js         |
        |   +--------------------+
        |           |
        |           | chrome.tabs API
        |           v
        |   [User's Real Chrome Tabs]
        |
        | Puppeteer API
        v
[Headless Browser Sessions]
(isolated, identified by session ID)
```

---

## Tools / Features Exposed to Claude

| Tool | V1 | V2 | V3 | Description |
|------|----|----|-----|-------------|
| `browser_status` | ✅ | | | Check extension connection + list headless sessions |
| `browser_screenshot` | ✅ | | | Capture screenshot, returns base64 image |
| `browser_get_url` | ✅ | | | Get current page URL |
| `browser_click` | | ✅ | | Click element by CSS selector or coordinates |
| `browser_scroll` | | ✅ | | Scroll page by pixels or to element |
| `browser_console_logs` | | ✅ | | Read JS console output |
| `browser_get_dom` | | | ✅ | Get full DOM/HTML of page |
| `browser_type` | | | ✅ | Type text into input field |
| `browser_navigate` | | | ✅ | Navigate to URL |
| `browser_record_start` | | | ✅ | Start session recording |
| `browser_record_stop` | | | ✅ | Stop recording and return video |
| `browser_visual_diff` | | | ✅ | Compare two screenshots visually |
| `browser_run_test` | | | ✅ | Execute automated UI test |

---

## MANDATORY Agent Reading Checklist

**Before writing any code, every agent MUST read these files in order:**

1. Read [RULES.md](./RULES.md)
2. Read [AGENT-LOG.md](./AGENT-LOG.md)
3. Read [knowledge/setup/current-project-state.md](./knowledge/setup/current-project-state.md)
4. Read [requirements/PRD.md](./requirements/PRD.md)
5. Read [requirements/functional-requirements.md](./requirements/functional-requirements.md)
6. Read [architecture/system-overview.md](./architecture/system-overview.md) + [architecture/api-design.md](./architecture/api-design.md)
7. Read [implementation/phases.md](./implementation/phases.md)
8. Read relevant module doc in [modules/](./modules/)

**Then:** Update [AGENT-LOG.md](./AGENT-LOG.md) as "In Progress" BEFORE writing any code.

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [RULES.md](./RULES.md) | Mandatory development rules — read first |
| [AGENT-LOG.md](./AGENT-LOG.md) | Task progress log — update before/after every task |
| [PROMPT.md](./PROMPT.md) | Agent entry point — use this to start any session |
| [requirements/PRD.md](./requirements/PRD.md) | Product requirements and goals |
| [requirements/functional-requirements.md](./requirements/functional-requirements.md) | All testable requirements |
| [architecture/system-overview.md](./architecture/system-overview.md) | Components and architecture |
| [architecture/data-flow.md](./architecture/data-flow.md) | Sequence diagrams for all operations |
| [architecture/api-design.md](./architecture/api-design.md) | All tool schemas and message formats |
| [implementation/phases.md](./implementation/phases.md) | Phase-by-phase task checklist |
| [implementation/estimation.md](./implementation/estimation.md) | Effort estimates and milestones |
| [knowledge/coding-standards.md](./knowledge/coding-standards.md) | Code style and structure rules |
| [knowledge/error-handling.md](./knowledge/error-handling.md) | Error format and handling patterns |
| [knowledge/security-standards.md](./knowledge/security-standards.md) | Security rules |
| [knowledge/testing-guide.md](./knowledge/testing-guide.md) | How to write and run tests |
| [knowledge/setup/install-guide.md](./knowledge/setup/install-guide.md) | Installation instructions |
| [knowledge/setup/current-project-state.md](./knowledge/setup/current-project-state.md) | What exists right now |
| [modules/mcp-server.md](./modules/mcp-server.md) | MCP Server component |
| [modules/chrome-extension.md](./modules/chrome-extension.md) | Chrome Extension component |
| [modules/websocket-bridge.md](./modules/websocket-bridge.md) | WebSocket bridge component |
| [modules/puppeteer-manager.md](./modules/puppeteer-manager.md) | Headless session manager |
| [workflows/claude-agent-flow.md](./workflows/claude-agent-flow.md) | Claude agent browser workflow |
| [workflows/developer-setup-flow.md](./workflows/developer-setup-flow.md) | Developer install and setup flow |
| [decisions/ADR.md](./decisions/ADR.md) | Architectural decision records |
