# Phase 1 Design — MCP Server Skeleton
**Date:** 2026-03-18 | **Status:** Approved

---

## Goal

Create a working Node.js/TypeScript MCP server registered with Claude Code that exposes a working `browser_status` tool returning `{ extensionConnected: false, headlessSessions: [] }`.

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Code location | `/media/pc/External/Project/mcp/` (flat, no `mcp-server/` subdir) | `mcp/` IS the project root |
| Dev runner | `npx ts-node src/index.ts` | Fast dev loop, no build step |
| MCP registration | `node dist/index.js` | Stable compiled output for Claude Code |
| Tool pattern | Registry array — each tool exports `ITool`, `index.ts` loops and registers | Scales cleanly across all 6 phases |
| SDK patterns | Official `McpServer` + `StdioServerTransport` + Zod schemas + `CallToolResult` | Follows official MCP TypeScript SDK docs |
| MCP entry | Auto-written to `~/.claude/settings.json` | Part of Phase 1 completion |

---

## Project Structure

```
/media/pc/External/Project/mcp/
├── docs/                      ← existing
├── config.json                ← runtime config (wsPort: 9999)
├── package.json
├── tsconfig.json
├── eslint.config.js
└── src/
    ├── index.ts               ← McpServer + StdioServerTransport, registers all tools
    ├── config.ts              ← loads config.json, exports WS_PORT constant
    ├── logger.ts              ← structured JSON logger (info/warn/error), no console.log
    ├── types.ts               ← ITool, IWsRequest, IWsResponse, IErrorResponse
    ├── tools/
    │   └── status.ts          ← browser_status tool
    └── __tests__/
        └── status.test.ts     ← unit tests for browser_status
```

---

## SDK Architecture

Based on official `@modelcontextprotocol/typescript-sdk` docs:

```typescript
// index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'browser-control', version: '1.0.0' });

for (const tool of tools) {
  server.registerTool(tool.name, tool.options, tool.handler);
}

await server.connect(new StdioServerTransport());
```

---

## Tool Registry Interface

```typescript
// types.ts
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';

interface ITool {
  name: string;
  options: {
    title?: string;
    description: string;
    inputSchema: ZodRawShape;
    outputSchema?: ZodRawShape;
  };
  handler: (...args: unknown[]) => Promise<CallToolResult>;
}
```

---

## browser_status Tool

```typescript
// tools/status.ts
export const statusTool: ITool = {
  name: 'browser_status',
  options: {
    title: 'Browser Status',
    description: 'Check Chrome Extension connection status and list active headless sessions',
    inputSchema: z.object({}),
    outputSchema: z.object({
      extensionConnected: z.boolean(),
      headlessSessions: z.array(z.string())
    })
  },
  handler: async () => ({
    content: [{ type: 'text', text: JSON.stringify({ extensionConnected: false, headlessSessions: [] }) }],
    structuredContent: { extensionConnected: false, headlessSessions: [] }
  })
};
```

Phase 2 will replace the hardcoded values with live state from the WebSocket layer.

---

## Error Handling

- All tool handlers wrapped in try/catch
- Errors return `CallToolResult` with `isError: true` and structured `{ code, message }` in text
- No stack traces exposed
- Logger records all errors at `error` level

---

## Tests

File: `src/__tests__/status.test.ts`

- Call `statusTool.handler()` directly
- Assert `content[0].type === 'text'`
- Assert parsed content contains `extensionConnected: false`
- Assert `headlessSessions` is an empty array
- No mocking required (Phase 1 handler is hardcoded)

---

## MCP Registration

Added to `~/.claude/settings.json`:

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

---

## Tech Stack (Phase 1)

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | latest | MCP server framework |
| `typescript` | 5.x | Language |
| `ts-node` | latest | Dev runner |
| `@types/node` | latest | Node type definitions |
| `zod` | latest | Input/output schema validation |
| `jest` | latest | Test framework |
| `ts-jest` | latest | TypeScript Jest transformer |
| `@types/jest` | latest | Jest type definitions |
| `eslint` | latest | Linter |
| `@typescript-eslint/eslint-plugin` | latest | TypeScript ESLint rules |

---

## Phase Completion Criteria

- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] `npm test` passes
- [ ] Claude Code lists `browser-control` in MCP servers
- [ ] `browser_status` returns `{ extensionConnected: false, headlessSessions: [] }`
