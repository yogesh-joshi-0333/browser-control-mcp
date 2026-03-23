import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const screenshotTool: ITool = {
  name: 'browser_screenshot',
  options: {
    title: 'Browser Screenshot',
    description: 'Capture a screenshot of the current page as a PNG image. Returns the actual rendered visual — you can see and describe layout, design, text, images, errors, and any visual content. Use this after browser_navigate to see a page, after browser_click to verify what happened, or anytime you need to visually inspect the browser. Pass sessionId to screenshot a specific headless session.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_screenshot', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      const session = getSession(modeResult.sessionId!);
      const buffer = await session.page.screenshot({ type: 'png' });
      const base64Data = Buffer.from(buffer).toString('base64');

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
