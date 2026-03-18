import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const screenshotTool: ITool = {
  name: 'browser_screenshot',
  options: {
    title: 'Browser Screenshot',
    description: 'Take a screenshot of the active browser tab. Uses the Chrome Extension by default (extension must be connected). Pass sessionId to use a specific Puppeteer headless session, or mode="headless" to create a new one.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'extension' | 'headless' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_screenshot', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      let base64Data: string;

      if (modeResult.mode === 'extension') {
        const response = await sendToExtension({ action: 'take_screenshot', payload: {} });
        const dataUrl = response.dataUrl as string;
        base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      } else {
        const session = getSession(modeResult.sessionId!);
        const buffer = await session.page.screenshot({ type: 'png' });
        base64Data = Buffer.from(buffer).toString('base64');
      }

      return {
        content: [{ type: 'image', data: base64Data, mimeType: 'image/png' }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_screenshot failed', { error: String(error) });
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
