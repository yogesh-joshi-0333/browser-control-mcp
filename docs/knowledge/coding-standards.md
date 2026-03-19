# Browser Control MCP — Coding Standards
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## File and Folder Structure

```
/media/pc/External/Project/mcp/
├── src/
│   ├── index.ts              # Entry point — MCP server setup + tool registration
│   ├── config.ts             # Config loading (port, extension ID, timeouts)
│   ├── logger.ts             # Structured logger
│   ├── types.ts              # All shared TypeScript interfaces
│   ├── websocket.ts          # WebSocket server + connection manager
│   ├── mode-selector.ts      # Mode selection with defaultMode state
│   ├── puppeteer-manager.ts  # Headless session lifecycle
│   ├── tools/
│   │   ├── select-mode.ts    # browser_select_mode
│   │   ├── status.ts         # browser_status
│   │   ├── screenshot.ts     # browser_screenshot
│   │   ├── get-url.ts        # browser_get_url
│   │   ├── navigate.ts       # browser_navigate
│   │   ├── click.ts          # browser_click
│   │   ├── scroll.ts         # browser_scroll
│   │   ├── type.ts           # browser_type
│   │   ├── get-dom.ts        # browser_get_dom
│   │   └── console-logs.ts   # browser_console_logs
│   └── __tests__/
│       ├── select-mode.test.ts
│       ├── status.test.ts
│       ├── screenshot.test.ts
│       ├── navigate.test.ts
│       ├── get-url.test.ts
│       ├── click.test.ts
│       ├── scroll.test.ts
│       ├── type.test.ts
│       ├── get-dom.test.ts
│       ├── console-logs.test.ts
│       ├── mode-selector.test.ts
│       ├── websocket.test.ts
│       ├── puppeteer-manager.test.ts
│       └── logger.test.ts
├── chrome-extension/
│   ├── manifest.json
│   └── background.js
├── docs/                     # Project documentation
├── dist/                     # Compiled output (gitignored)
├── package.json
├── tsconfig.json
├── jest.config.js
├── eslint.config.js
├── config.json
└── .mcp.json
```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| TypeScript source files | `kebab-case.ts` | `puppeteer-manager.ts` |
| TypeScript classes | `PascalCase` | `SessionManager` |
| TypeScript interfaces | `I` prefix + PascalCase | `IToolResult`, `IWsRequest` |
| TypeScript functions | `camelCase` | `captureScreenshot()` |
| TypeScript constants | `SCREAMING_SNAKE_CASE` | `WS_PORT`, `WS_TIMEOUT_MS` |
| TypeScript enums | `PascalCase` | `BrowserMode` |
| MCP tool names | `snake_case` | `browser_screenshot` |
| WebSocket action names | `snake_case` | `take_screenshot` |
| Error codes | `SCREAMING_SNAKE_CASE` | `EXTENSION_NOT_CONNECTED` |
| Session IDs | `session-` + nanoid(8) | `session-a1b2c3d4` |
| Test files | `<module>.test.ts` | `screenshot.test.ts` |
| Chrome Extension files | `kebab-case.js` | `background.js` |

---

## TypeScript Rules

- `strict: true` in tsconfig.json — mandatory
- No `any` type — use `unknown` and type guards when necessary
- No implicit returns — all function paths must return a value
- All exported functions must have explicit return types
- Use `interface` for object shapes, `type` for unions/aliases
- Use `readonly` on properties that should not be mutated
- All async functions must be `async` (no raw Promise constructors unless wrapping a callback)
- Use `const` by default — `let` only when reassignment is needed

---

## Logging Rules

Use the structured logger from `src/logger.ts` — never `console.log`.

| Level | When to use |
|-------|------------|
| `info` | Tool calls, WS connect/disconnect, session create/destroy |
| `warn` | Unexpected but recoverable state (e.g. extension reconnect) |
| `error` | All caught exceptions — include error code and message |

**What NOT to log:**
- Screenshot base64 data
- DOM HTML content
- User credentials or tokens
- Stack traces in production responses

**Log format:** `[timestamp] [level] [component] message { contextObject }`

---

## Git Commit Message Format

```
<type>(<scope>): <short description>

[optional body]
```

**Types:** `feat`, `fix`, `test`, `docs`, `refactor`, `chore`
**Scopes:** `mcp-server`, `extension`, `websocket`, `puppeteer`, `tools`

**Examples:**
```
feat(tools): add browser_screenshot for Extension mode
fix(websocket): handle reconnect when extension restarts
test(puppeteer): add session reuse integration test
```

---

## Pre-Completion Checklist

Run this before marking any phase task `[x]`:

- [ ] TypeScript compiles with zero errors: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] No ESLint errors: `npm run lint`
- [ ] No `console.log` in committed code
- [ ] No hardcoded port numbers (use `WS_PORT` constant)
- [ ] No `any` types introduced
- [ ] AGENT-LOG.md updated with task completion
- [ ] phases.md checkbox marked `[x]`
- [ ] Relevant module doc updated if new feature added
