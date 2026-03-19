# Browser Control MCP — RULES
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Rule 0: Read Before You Code

Every agent MUST read these files before writing a single line of code:

1. [RULES.md](./RULES.md) — this file
2. [AGENT-LOG.md](./AGENT-LOG.md)
3. [knowledge/setup/current-project-state.md](./knowledge/setup/current-project-state.md)
4. [requirements/PRD.md](./requirements/PRD.md)
5. [requirements/functional-requirements.md](./requirements/functional-requirements.md)
6. [architecture/system-overview.md](./architecture/system-overview.md)
7. [architecture/api-design.md](./architecture/api-design.md)
8. [implementation/phases.md](./implementation/phases.md)
9. Relevant module doc from [modules/](./modules/)

**Violation of Rule 0 = wasted work. No exceptions.**

---

## Rule 1: Tech Stack

These are fixed. No deviations without an ADR entry.

| Layer | Technology | Version |
|-------|-----------|---------|
| MCP Server runtime | Node.js | 20.x LTS |
| MCP Server language | TypeScript | 5.x |
| MCP SDK | @modelcontextprotocol/sdk | latest stable |
| WebSocket server | ws | 8.x |
| Headless browser | Puppeteer | 21.x |
| Chrome Extension | Manifest V3 | — |
| Extension language | JavaScript (ES2022) | — |
| Package manager | npm | 10.x |
| Test framework | Jest + ts-jest | latest |
| Linter | ESLint + @typescript-eslint | latest |

---

## Rule 2: Data and Message Format Standards

All WebSocket messages between MCP Server and Chrome Extension MUST follow this exact format:

**Request (MCP Server → Extension):**
```json
{
  "id": "string (uuid v4)",
  "action": "string (snake_case)",
  "payload": {}
}
```

**Response (Extension → MCP Server):**
```json
{
  "id": "string (matches request id)",
  "success": true,
  "data": {}
}
```

**Error Response:**
```json
{
  "id": "string (matches request id)",
  "success": false,
  "error": {
    "code": "ERROR_CODE_SCREAMING_SNAKE_CASE",
    "message": "Exact human-readable message"
  }
}
```

All action names are `snake_case`. All field names are `camelCase`. No exceptions.

---

## Rule 3: Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| MCP tool names | `snake_case` | `browser_screenshot` |
| TypeScript files | `kebab-case.ts` | `screenshot-tool.ts` |
| TypeScript classes | `PascalCase` | `SessionManager` |
| TypeScript functions | `camelCase` | `captureScreenshot` |
| TypeScript constants | `SCREAMING_SNAKE_CASE` | `WS_PORT` |
| TypeScript interfaces | `I` prefix + PascalCase | `IToolResult` |
| Error codes | `SCREAMING_SNAKE_CASE` | `EXTENSION_NOT_CONNECTED` |
| WebSocket actions | `snake_case` | `take_screenshot` |
| Extension JS files | `kebab-case.js` | `background.js` |
| Session IDs | `session-` + nanoid(8) | `session-a1b2c3d4` |

---

## Rule 4: Security Rules (Non-Negotiable)

- The WebSocket server MUST bind to `127.0.0.1` only — never `0.0.0.0`
- The WebSocket server MUST reject connections from any origin other than the registered extension ID
- No tool may execute arbitrary JavaScript in the user's browser without explicit user confirmation per call
- No screenshot data may be written to disk — always return in-memory as base64
- No credentials, tokens, or personal data may appear in logs
- Puppeteer sessions MUST launch with `--no-sandbox` disabled (use sandbox)
- Extension manifest permissions must be minimal — only what V1 needs

---

## Rule 5: Agent Log Updates (Mandatory)

- Before starting ANY task: add a row to AGENT-LOG.md with status "In Progress"
- After completing ANY task: update that row to "Completed" with timestamp
- If blocked: update status to "Blocked" and add a note explaining what is blocking
- Never leave a task as "In Progress" at end of session without a blocking note

---

## Rule 6: Testing Rules

- Every MCP tool MUST have a unit test
- Every WebSocket message type MUST have an integration test
- No mocking of the WebSocket layer in integration tests — use a real ws server
- No mocking of Puppeteer — use a real headless browser in tests
- Test file location: `src/__tests__/`
- Every test file named: `<module>.test.ts`
- Tests MUST pass before marking any phase task as complete

---

## Rule 7: Documentation Sync

| Code change | Update this doc |
|-------------|----------------|
| New MCP tool added | api-design.md + functional-requirements.md + modules/mcp-server.md |
| New WebSocket action | api-design.md + architecture/data-flow.md |
| New Puppeteer session feature | modules/puppeteer-manager.md |
| New Chrome Extension feature | modules/chrome-extension.md |
| Phase task completed | implementation/phases.md (check the box) + knowledge/setup/current-project-state.md |
| New dependency added | knowledge/setup/install-guide.md |
| New architectural decision | decisions/ADR.md |

---

## Rule 8: File and Structure Rules

- All MCP Server source code lives in: `src/`
- All Chrome Extension code lives in: `chrome-extension/`
- All documentation lives in: `docs/`
- Never put code inside the documentation folder
- Tools are one file per tool: `src/tools/<tool-name>.ts`
- Tests mirror source: `src/__tests__/<module>.test.ts`

---

## Rule 9: Error Handling Rules

- No tool may throw an unhandled exception — always catch and return structured error
- No silent error swallowing — every caught error must be logged at `error` level
- Every error response MUST include: `code`, `message`
- Never expose stack traces in tool responses
- Timeout errors use code: `TIMEOUT_ERROR`
- Extension not connected uses code: `EXTENSION_NOT_CONNECTED`
- Headless session not found uses code: `SESSION_NOT_FOUND`
- WebSocket send failure uses code: `WS_SEND_FAILED`

---

## Rule 10: Phase Discipline

- Work on ONE phase at a time — do not start Phase N+1 until all Phase N tasks are `[x]`
- Each task checkbox `[ ]` must be individually verifiable before checking it `[x]`
- If a task is blocked, mark it `[~]` and add a note — do not skip it
- Phase completion requires: all tasks `[x]` + tests passing + AGENT-LOG updated

---

## Rule 11: What NOT To Do

- Do NOT use `console.log` in production code — use the structured logger
- Do NOT hardcode port numbers in tool code — use `WS_PORT` constant from config
- Do NOT hardcode extension IDs — read from environment or config file
- Do NOT add V2/V3 features during V1 phases — scope discipline is mandatory
- Do NOT modify any docs except AGENT-LOG.md and phases.md (checkboxes only) during development
- Do NOT create new files outside the defined structure without updating RULES.md
- Do NOT use `any` type in TypeScript — use proper types or `unknown`
- Do NOT leave TODO comments in committed code — create a task in AGENT-LOG instead
