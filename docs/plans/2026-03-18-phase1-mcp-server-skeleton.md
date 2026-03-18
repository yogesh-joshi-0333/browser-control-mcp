# Phase 1: MCP Server Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a working Node.js/TypeScript MCP server registered with Claude Code that exposes a `browser_status` tool returning `{ extensionConnected: false, headlessSessions: [] }`.

**Architecture:** Flat project structure — all MCP server code lives directly in `/media/pc/External/Project/mcp/`. Tools are registered via a registry array in `index.ts` using the official `McpServer` + `StdioServerTransport` pattern from `@modelcontextprotocol/sdk`. Each tool exports an `ITool` object with `name`, `options` (Zod schemas), and `handler`.

**Tech Stack:** Node.js 20 LTS, TypeScript 5, `@modelcontextprotocol/sdk` (latest), Zod, Jest + ts-jest, ESLint + @typescript-eslint

---

### Task 1: Initialize npm project

**Files:**
- Create: `package.json`

**Step 1: Run npm init**

```bash
cd /media/pc/External/Project/mcp
npm init -y
```

Expected: `package.json` created with default fields.

**Step 2: Update package.json with correct scripts and metadata**

Replace the generated `package.json` with:

```json
{
  "name": "browser-control-mcp",
  "version": "1.0.0",
  "description": "MCP server giving Claude Code full browser control",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts"
  },
  "keywords": [],
  "author": "",
  "license": "MIT"
}
```

**Step 3: Commit**

```bash
git init
git add package.json
git commit -m "chore: initialize npm project"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `package.json` (auto-updated by npm)

**Step 1: Install production dependencies**

```bash
cd /media/pc/External/Project/mcp
npm install @modelcontextprotocol/sdk zod
```

Expected: `node_modules/` created, `package.json` updated with `dependencies`.

**Step 2: Install dev dependencies**

```bash
npm install --save-dev typescript ts-node @types/node jest ts-jest @types/jest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

Expected: Dev deps added to `package.json`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install dependencies"
```

---

### Task 3: Configure TypeScript

**Files:**
- Create: `tsconfig.json`

**Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

**Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: configure TypeScript with strict mode"
```

---

### Task 4: Configure ESLint

**Files:**
- Create: `eslint.config.js`

**Step 1: Create eslint.config.js**

```js
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-console': 'error'
    }
  }
];
```

**Step 2: Commit**

```bash
git add eslint.config.js
git commit -m "chore: configure ESLint with TypeScript rules"
```

---

### Task 5: Create runtime config

**Files:**
- Create: `config.json`
- Create: `src/config.ts`

**Step 1: Create config.json at project root**

```json
{
  "wsPort": 9999,
  "extensionOrigin": ""
}
```

**Step 2: Create src/config.ts**

```typescript
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface IConfig {
  wsPort: number;
  extensionOrigin: string;
}

function loadConfig(): IConfig {
  const configPath = join(__dirname, '..', 'config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as IConfig;
}

const config = loadConfig();

export const WS_PORT: number = config.wsPort;
export const EXTENSION_ORIGIN: string = config.extensionOrigin;
export default config;
```

**Step 3: Commit**

```bash
git add config.json src/config.ts
git commit -m "feat: add runtime config with WS_PORT constant"
```

---

### Task 6: Create structured logger

**Files:**
- Create: `src/logger.ts`
- Create: `src/__tests__/logger.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/logger.test.ts
import { logger } from '../logger.js';

describe('logger', () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('writes JSON line to stderr on info', () => {
    logger.info('test message', { key: 'value' });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.key).toBe('value');
  });

  it('writes JSON line to stderr on error', () => {
    logger.error('something failed', { code: 'TEST_ERROR' });
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('error');
    expect(output.message).toBe('something failed');
  });

  it('includes timestamp in every log line', () => {
    logger.info('check timestamp');
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.timestamp).toBeDefined();
    expect(typeof output.timestamp).toBe('string');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /media/pc/External/Project/mcp
npx jest src/__tests__/logger.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../logger.js'`

**Step 3: Create src/logger.ts**

```typescript
type LogLevel = 'info' | 'warn' | 'error';

interface ILogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const entry: ILogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  process.stderr.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta)
};
```

**Step 4: Configure Jest for TypeScript**

Add a `jest.config.js` at project root:

```js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }]
  },
  testMatch: ['**/src/__tests__/**/*.test.ts']
};
```

**Step 5: Run test to verify it passes**

```bash
npx jest src/__tests__/logger.test.ts --no-coverage
```

Expected: PASS — 3 tests pass

**Step 6: Commit**

```bash
git add src/logger.ts src/__tests__/logger.test.ts jest.config.js
git commit -m "feat: add structured JSON logger writing to stderr"
```

---

### Task 7: Create shared TypeScript interfaces

**Files:**
- Create: `src/types.ts`

**Step 1: Create src/types.ts**

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
import { z } from 'zod';

// MCP tool registry interface
export interface ITool {
  name: string;
  options: {
    title?: string;
    description: string;
    inputSchema: ReturnType<typeof z.object>;
    outputSchema?: ReturnType<typeof z.object>;
  };
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

// WebSocket message interfaces (used from Phase 2 onward)
export interface IWsRequest {
  id: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface IErrorResponse {
  code: string;
  message: string;
}

export interface IWsResponse {
  id: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: IErrorResponse;
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript interfaces for tools and WebSocket"
```

---

### Task 8: Implement browser_status tool (TDD)

**Files:**
- Create: `src/__tests__/status.test.ts`
- Create: `src/tools/status.ts`

**Step 1: Create tools directory and write failing test**

```bash
mkdir -p /media/pc/External/Project/mcp/src/tools
```

```typescript
// src/__tests__/status.test.ts
import { statusTool } from '../tools/status.js';

describe('browser_status tool', () => {
  it('has correct tool name', () => {
    expect(statusTool.name).toBe('browser_status');
  });

  it('returns extensionConnected: false', async () => {
    const result = await statusTool.handler({});
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    const data = JSON.parse(text);
    expect(data.extensionConnected).toBe(false);
  });

  it('returns empty headlessSessions array', async () => {
    const result = await statusTool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.headlessSessions).toEqual([]);
  });

  it('returns content with type text', async () => {
    const result = await statusTool.handler({});
    expect(result.content[0].type).toBe('text');
  });

  it('returns structuredContent with correct shape', async () => {
    const result = await statusTool.handler({});
    expect(result.structuredContent).toEqual({
      extensionConnected: false,
      headlessSessions: []
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/status.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../tools/status.js'`

**Step 3: Create src/tools/status.ts**

```typescript
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';

const outputSchema = z.object({
  extensionConnected: z.boolean().describe('Whether the Chrome Extension is connected'),
  headlessSessions: z.array(z.string()).describe('List of active headless session IDs')
});

export const statusTool: ITool = {
  name: 'browser_status',
  options: {
    title: 'Browser Status',
    description: 'Check Chrome Extension connection status and list active headless Puppeteer sessions',
    inputSchema: z.object({}),
    outputSchema
  },
  handler: async (_args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      const status = {
        extensionConnected: false,
        headlessSessions: [] as string[]
      };

      logger.info('browser_status called', status);

      return {
        content: [{ type: 'text', text: JSON.stringify(status) }],
        structuredContent: status
      };
    } catch (error) {
      logger.error('browser_status failed', { error: String(error) });
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'browser_status failed unexpectedly' })
        }]
      };
    }
  }
};
```

**Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/status.test.ts --no-coverage
```

Expected: PASS — 5 tests pass

**Step 5: Commit**

```bash
git add src/tools/status.ts src/__tests__/status.test.ts
git commit -m "feat: implement browser_status tool returning not-connected state"
```

---

### Task 9: Create MCP server entry point

**Files:**
- Create: `src/index.ts`

**Step 1: Create src/index.ts**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { statusTool } from './tools/status.js';
import type { ITool } from './types.js';

const tools: ITool[] = [
  statusTool
];

async function main(): Promise<void> {
  const server = new McpServer(
    { name: 'browser-control', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );

  for (const tool of tools) {
    server.registerTool(tool.name, tool.options, tool.handler);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('browser-control MCP server started', { tools: tools.map(t => t.name) });
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ level: 'error', message: 'Fatal startup error', error: String(error) }) + '\n');
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add MCP server entry point with tool registry"
```

---

### Task 10: Build TypeScript

**Files:**
- Creates: `dist/` directory

**Step 1: Run full build**

```bash
cd /media/pc/External/Project/mcp
npm run build
```

Expected: `dist/` created with zero TypeScript errors. You should see `dist/index.js`, `dist/config.js`, `dist/logger.js`, `dist/types.js`, `dist/tools/status.js`.

**Step 2: If errors occur, fix them before proceeding**

Common issues:
- Module resolution errors: ensure `"module": "Node16"` and all imports use `.js` extensions
- Type errors: check `types.ts` and Zod schema types match `ITool` interface

**Step 3: Add dist/ to .gitignore**

```bash
echo "node_modules/\ndist/\n" > .gitignore
git add .gitignore
git commit -m "chore: add .gitignore"
```

**Step 4: Run all tests to confirm nothing broken**

```bash
npm test
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "build: confirm TypeScript compilation succeeds"
```

---

### Task 11: Register MCP server with Claude Code

**Files:**
- Modify: `~/.claude/settings.json`

**Step 1: Check current settings.json**

```bash
cat ~/.claude/settings.json
```

**Step 2: Add MCP server entry**

If `mcpServers` key exists, add to it. If not, add the full block. The final result should include:

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

Merge carefully — do not overwrite other existing keys.

**Step 3: Verify Claude Code picks up the server**

Restart Claude Code (or reload the MCP servers via VSCode command palette: `MCP: Restart Servers`).

Run in Claude Code:
```
/mcp
```

Expected: `browser-control` appears in the server list with status `connected`.

**Step 4: Verify browser_status tool works**

Ask Claude Code:
```
Call the browser_status tool
```

Expected response: `{ "extensionConnected": false, "headlessSessions": [] }`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: register browser-control MCP server with Claude Code"
```

---

### Task 12: Update AGENT-LOG.md and phases.md

**Files:**
- Modify: `docs/AGENT-LOG.md`
- Modify: `docs/implementation/phases.md`

**Step 1: Add completed entry to AGENT-LOG.md**

Add a new row to the Task Log table:

```
| 2 | Phase 1 | MCP Server Skeleton | Claude Sonnet 4.6 | Completed | 2026-03-18 | 2026-03-18 | All tasks done, tests pass, browser_status verified in Claude Code |
```

**Step 2: Check all Phase 1 checkboxes in phases.md**

Mark all 16 Phase 1 tasks as `[x]`.

**Step 3: Update current-project-state.md**

In `docs/knowledge/setup/current-project-state.md`:
- Change Phase 1 status from "Not Started" to "Completed"
- Add entries under "What Exists" for all new files

**Step 4: Commit**

```bash
git add docs/AGENT-LOG.md docs/implementation/phases.md docs/knowledge/setup/current-project-state.md
git commit -m "docs: mark Phase 1 complete in AGENT-LOG and phases checklist"
```

---

## Phase 1 Completion Checklist

- [ ] `npm run build` exits with 0 errors
- [ ] `npm test` passes all tests
- [ ] Claude Code shows `browser-control` in MCP server list
- [ ] `browser_status` returns `{ extensionConnected: false, headlessSessions: [] }`
- [ ] AGENT-LOG.md updated
- [ ] phases.md Phase 1 all boxes checked
