# Browser Control MCP — Agent Entry Prompt
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## General Session Start Prompt

Use this at the beginning of any new development session:

---

You are working on the **Browser Control MCP** project — a Node.js/TypeScript MCP server + Chrome Extension + WebSocket bridge that gives Claude Code full Antigravity-style browser control (screenshots, click, scroll, DOM inspection, console logs, recording, visual regression).

**Documentation is at:** `/media/pc/External/Project/mcp/docs/`
**Code will live at:** `/media/pc/External/Project/mcp/`

Before doing anything else, read these files IN ORDER:

1. `/media/pc/External/Project/mcp/docs/RULES.md`
2. `/media/pc/External/Project/mcp/docs/AGENT-LOG.md`
3. `/media/pc/External/Project/mcp/docs/knowledge/setup/current-project-state.md`
4. `/media/pc/External/Project/mcp/docs/requirements/PRD.md`
5. `/media/pc/External/Project/mcp/docs/requirements/functional-requirements.md`
6. `/media/pc/External/Project/mcp/docs/architecture/system-overview.md`
7. `/media/pc/External/Project/mcp/docs/architecture/api-design.md`
8. `/media/pc/External/Project/mcp/docs/implementation/phases.md`

After reading, report:
- Current phase (based on phases.md checkboxes)
- The next unchecked task in that phase
- Which files you will touch to complete that task

Then update AGENT-LOG.md with your task as "In Progress" BEFORE writing any code.

**Important:**
- Documentation location and code location are SEPARATE directories
- Only modify AGENT-LOG.md and phases.md checkboxes during development — never rewrite other docs
- Follow RULES.md strictly — especially Rule 1 (tech stack), Rule 4 (security), Rule 9 (errors)

---

## Phase-Specific Prompts

### Start Phase 1 — MCP Server Skeleton

Continue from the General Session Start Prompt above, then add:

"Begin Phase 1: MCP Server Skeleton. Your goal is to create a working Node.js/TypeScript project that registers with Claude Code as an MCP server and exposes a working `browser_status` tool. Refer to `/media/pc/External/Project/mcp/docs/modules/mcp-server.md` for the module spec."

---

### Start Phase 2 — WebSocket Bridge

Continue from the General Session Start Prompt above, then add:

"Begin Phase 2: WebSocket Bridge. Your goal is to add a WebSocket server to the MCP Server and build the Chrome Extension that connects to it. Refer to `/media/pc/External/Project/mcp/docs/modules/websocket-bridge.md` and `/media/pc/External/Project/mcp/docs/modules/chrome-extension.md`."

---

### Start Phase 3 — V1 Tools via Extension

Continue from the General Session Start Prompt above, then add:

"Begin Phase 3: V1 Tools via Extension. Implement `browser_screenshot` and `browser_get_url` tools that work via the Chrome Extension. Refer to `/media/pc/External/Project/mcp/docs/architecture/api-design.md` for exact tool schemas."

---

### Start Phase 4 — Headless Mode

Continue from the General Session Start Prompt above, then add:

"Begin Phase 4: Headless Mode (Puppeteer). Add Puppeteer-based headless browser sessions with session ID management. Implement dual-mode selection (Extension vs Headless) for all V1 tools. Refer to `/media/pc/External/Project/mcp/docs/modules/puppeteer-manager.md`."

---

### Start Phase 5 — V2 Tools

Continue from the General Session Start Prompt above, then add:

"Begin Phase 5: V2 Tools. Implement `browser_click`, `browser_scroll`, and `browser_console_logs` in both Extension and Headless modes. Refer to `/media/pc/External/Project/mcp/docs/architecture/api-design.md` for exact schemas."

---

### Start Phase 6 — V3 Tools

Continue from the General Session Start Prompt above, then add:

"Begin Phase 6: V3 Tools. Implement remaining tools: `browser_get_dom`, `browser_type`, `browser_navigate`, `browser_record_start`, `browser_record_stop`, `browser_visual_diff`, `browser_run_test`. Refer to `/media/pc/External/Project/mcp/docs/architecture/api-design.md` for exact schemas."

---

### Continue From Current Phase

"Read the files in order from the General Session Start Prompt. Identify the current phase and the next unchecked task. Resume from there. Do not re-do completed tasks."

---

### Review and Fix

"Read all files in order from the General Session Start Prompt. Review the current state of the codebase. Identify any: failing tests, rule violations (RULES.md), missing error handling, or incomplete tasks. Fix them one by one, updating AGENT-LOG.md for each fix."

---

## Important Notes

- **Code location** — the actual source code is at `/media/pc/External/Project/mcp/`. Docs are in the `docs/` subdirectory.
- **Never rewrite docs** — only update AGENT-LOG.md task statuses and phases.md checkboxes during development
- **Phase discipline** — complete all tasks in Phase N before touching Phase N+1
- **Test before marking done** — every task checkbox `[x]` requires passing tests
