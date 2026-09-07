import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const reloadTool: ITool = {
  name: 'browser_reload',
  options: {
    title: 'Browser Reload',
    description:
      'Reload the current page. Equivalent to pressing the browser\'s refresh button. Use ignoreCache:true for a ' +
      'hard refresh that bypasses the browser cache (equivalent to Ctrl+Shift+R) — useful when testing a deployed ' +
      'change that the page might otherwise serve stale/cached.',
    inputSchema: z.object({
      ignoreCache: z.boolean().optional().describe('If true, bypass the cache (hard refresh). Default false (normal reload).'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { ignoreCache, sessionId, mode } = args as { ignoreCache?: boolean; sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_reload', { mode: modeResult.mode, sessionId: modeResult.sessionId, ignoreCache: Boolean(ignoreCache) });

      const session = getSession(modeResult.sessionId!);

      if (ignoreCache) {
        // page.reload() has no cache-bypass option — CDP's Page.reload does.
        const client = await session.page.createCDPSession();
        const navigated = session.page.waitForNavigation({ waitUntil: 'networkidle2' });
        await client.send('Page.reload', { ignoreCache: true });
        await navigated;
      } else {
        await session.page.reload({ waitUntil: 'networkidle2' });
      }

      return { content: [{ type: 'text', text: JSON.stringify({ success: true, url: session.page.url() }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_reload failed', { error: String(error) });
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
