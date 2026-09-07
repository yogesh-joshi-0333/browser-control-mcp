import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';
import { waitForDomStable } from '../dom-utils.js';

export const navigateForwardTool: ITool = {
  name: 'browser_navigate_forward',
  options: {
    title: 'Navigate Forward',
    description: 'Navigate forward to the next page in browser history — equivalent to clicking the browser forward button. Only works after browser_navigate_back (or a real back navigation) has happened; if there is no forward history, the page simply stays put.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_navigate_forward', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      const session = getSession(modeResult.sessionId!);
      await session.page.goForward({ waitUntil: 'networkidle2' });
      await waitForDomStable(session.page);
      const url = session.page.url();

      return {
        content: [{ type: 'text', text: JSON.stringify({ url, sessionId: modeResult.sessionId }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_navigate_forward failed', { error: String(error) });
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
