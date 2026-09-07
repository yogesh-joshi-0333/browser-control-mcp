import type { ITool } from './types.js';

/**
 * Shared registry of all tools this server exposes, populated by index.ts
 * alongside server.registerTool(). Lets browser_macro look up and invoke
 * another tool's handler by name without a circular import back to index.ts.
 */
const registry = new Map<string, ITool>();

export function registerTool(tool: ITool): void {
  registry.set(tool.name, tool);
}

export function getRegisteredTool(name: string): ITool | undefined {
  return registry.get(name);
}
