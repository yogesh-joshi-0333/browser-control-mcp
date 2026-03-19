import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';
import { waitForDomStable } from '../dom-utils.js';

export const navigateBackTool: ITool = {
  name: 'browser_navigate_back',
  options: {
    title: 'Navigate Back',
    description: 'Navigate back to the previous page in browser history — equivalent to clicking the browser back button. Use after navigating to a page and wanting to return to the previous one.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'extension' | 'headless' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_navigate_back', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      let url: string;

      if (modeResult.mode === 'extension') {
        const response = await sendToExtension({ action: 'navigate_back', payload: {} });
        url = response.url as string;
      } else {
        const session = getSession(modeResult.sessionId!);
        await session.page.goBack({ waitUntil: 'networkidle2' });
        await waitForDomStable(session.page);
        url = session.page.url();
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ url, sessionId: modeResult.sessionId }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_navigate_back failed', { error: String(error) });
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
