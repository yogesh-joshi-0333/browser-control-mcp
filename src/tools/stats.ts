import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function collectStats() {
  const win = globalThis as any;
  const doc = win.document;
  return {
    url: win.location.href,
    title: doc.title,
    domNodeCount: doc.getElementsByTagName('*').length,
    approxHtmlLength: doc.documentElement.outerHTML.length,
    approxTextLength: (doc.body.innerText || '').length
  };
}

export const statsTool: ITool = {
  name: 'browser_stats',
  options: {
    title: 'Browser Page Stats',
    description:
      'Cheap pre-check for page size and complexity: DOM node count, approximate HTML length, and approximate visible-text length. ' +
      'Call this BEFORE browser_get_dom on an unfamiliar page to decide whether a full dump is safe, or whether you should scope it ' +
      '(selector/maxLength) or use browser_snapshot/browser_extract instead.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_stats', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      const session = getSession(modeResult.sessionId!);
      const stats = await session.page.evaluate(collectStats);

      return { content: [{ type: 'text', text: JSON.stringify(stats) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_stats failed', { error: String(error) });
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
