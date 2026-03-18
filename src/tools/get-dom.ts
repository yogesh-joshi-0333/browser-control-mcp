import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const getDomTool: ITool = {
  name: 'browser_get_dom',
  options: {
    title: 'Get Browser DOM',
    description: 'Get the full HTML DOM of the current page. Uses Chrome Extension by default, or a Puppeteer session in headless mode.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'extension' | 'headless' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_get_dom', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      let dom: string;

      if (modeResult.mode === 'extension') {
        const response = await sendToExtension({ action: 'get_dom', payload: {} });
        dom = response.dom as string;
      } else {
        const session = getSession(modeResult.sessionId!);
        dom = await session.page.content();
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ dom }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_get_dom failed', { error: String(error) });
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
