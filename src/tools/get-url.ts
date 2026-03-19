import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const getUrlTool: ITool = {
  name: 'browser_get_url',
  options: {
    title: 'Get Browser URL',
    description: 'Get the current URL of the browser page. Useful to verify navigation succeeded, check the current location after redirects, or confirm which page the browser is on.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'extension' | 'headless' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_get_url', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      let url: string;

      if (modeResult.mode === 'extension') {
        const response = await sendToExtension({ action: 'get_url', payload: {} });
        url = response.url as string;
      } else {
        const session = getSession(modeResult.sessionId!);
        url = session.page.url();
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ url }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_get_url failed', { error: String(error) });
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
