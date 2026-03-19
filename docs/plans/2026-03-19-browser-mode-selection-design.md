# Browser Mode Selection Design

**Date:** 2026-03-19
**Status:** Approved

## Problem

When a user installs the browser-control MCP plugin and wants to access/check a website, they should be able to choose between their real Chrome browser (via extension) or headless Puppeteer. Currently the mode-selector auto-detects and falls back silently — users have no say.

## Design

### Flow

1. User asks the AI to check/open a URL
2. AI calls `browser_select_mode()` before navigating
3. If Chrome Extension is connected → return both options (`extension`, `headless`) → AI asks the user to pick
4. If Chrome Extension is NOT connected → return only `headless` → AI uses headless automatically, no question asked
5. AI stores the chosen mode for the session
6. All subsequent tool calls use the stored mode
7. User can call `browser_select_mode()` again at any time to switch

### New Tool: `browser_select_mode`

- **Input:** none
- **Output:**
  - `extensionConnected: boolean`
  - `options: string[]` — `["extension", "headless"]` or `["headless"]`
  - `currentMode: string | null` — currently selected mode, null if not yet chosen
  - `message: string` — human-readable prompt for the AI to relay

### Changes

1. **New file: `src/tools/select-mode.ts`** — Implements the `browser_select_mode` tool
2. **Update `src/mode-selector.ts`** — Add module-level `defaultMode` state with getter/setter (`getDefaultMode()`, `setDefaultMode(mode)`)
3. **Update all 8 existing tools** — When `mode` param is not provided, read `defaultMode` from mode-selector. Per-tool `mode` param still works as override
4. **Update `src/index.ts`** — Register the new `browser_select_mode` tool (total: 10 tools)
5. **No changes to Chrome Extension or WebSocket layer**

### Mode Priority (per tool call)

1. Explicit `mode` param on the tool call → highest priority
2. `defaultMode` set via `browser_select_mode` → session default
3. No mode set + no extension → headless auto-fallback (existing behavior)
