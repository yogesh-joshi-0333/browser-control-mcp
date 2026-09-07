import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function readStorage() {
  const win = globalThis as any;
  const toObject = (storage: any) => {
    const out: Record<string, string> = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null) out[key] = storage.getItem(key);
    }
    return out;
  };
  return { localStorage: toObject(win.localStorage), sessionStorage: toObject(win.sessionStorage) };
}

function writeStorageEntry(area: string, key: string, value: string) {
  const win = globalThis as any;
  win[area].setItem(key, value);
}

function clearStorage(area?: string) {
  const win = globalThis as any;
  if (!area || area === 'localStorage') win.localStorage.clear();
  if (!area || area === 'sessionStorage') win.sessionStorage.clear();
}

export const storageTool: ITool = {
  name: 'browser_storage',
  options: {
    title: 'Browser Storage',
    description:
      'Get, set, or clear localStorage/sessionStorage on the current page. Use this alongside browser_cookies ' +
      'to save and restore full session state (auth tokens, app state) and skip repeated login flows across calls.',
    inputSchema: z.object({
      action: z.enum(['get', 'set', 'clear']).describe('Action to perform'),
      area: z.enum(['localStorage', 'sessionStorage']).optional().describe('Which storage area. Required for "set". Omit for "clear" to clear both.'),
      key: z.string().optional().describe('Storage key (required for "set")'),
      value: z.string().optional().describe('Storage value (required for "set")'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, area, key, value, sessionId, mode } = args as {
      action?: string;
      area?: 'localStorage' | 'sessionStorage';
      key?: string;
      value?: string;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_storage', { mode: modeResult.mode, sessionId: modeResult.sessionId, action, area });

      const session = getSession(modeResult.sessionId!);

      switch (action) {
        case 'get': {
          const result = await session.page.evaluate(readStorage);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }

        case 'set': {
          if (!area || !key || value === undefined) {
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_STORAGE_ENTRY', message: 'area, key, and value are required to set a storage entry' }) }]
            };
          }
          await session.page.evaluate(writeStorageEntry, area, key, value);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        case 'clear': {
          await session.page.evaluate(clearStorage, area);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` }) }]
          };
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_storage failed', { error: String(error) });
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: err.code ?? 'UNKNOWN_ERROR', message: err.message ?? String(error) })
        }]
      };
    }
  }
};
