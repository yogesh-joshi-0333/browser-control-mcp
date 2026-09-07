import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const framesTool: ITool = {
  name: 'browser_frames',
  options: {
    title: 'Browser Frames',
    description:
      'List all frames (iframes) on the current page, each with an index, url, and name. Pass that index as ' +
      'frameIndex to browser_click, browser_type, or browser_get_dom to target content inside that iframe — ' +
      'the main document is not part of this list navigation-wise, but IS included as index 0 if it has children. ' +
      'Note: shadow DOM (unlike iframes) needs no special tool — prefix any selector with "pierce/" ' +
      '(e.g. "pierce/.my-shadow-element") in browser_click/type/get_dom/hover/select_option to reach into shadow roots.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_frames', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      const session = getSession(modeResult.sessionId!);
      const frames = session.page.frames().map((frame, index) => ({
        index,
        url: frame.url(),
        name: frame.name()
      }));

      return { content: [{ type: 'text', text: JSON.stringify({ frames }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_frames failed', { error: String(error) });
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
