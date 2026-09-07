import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const typeTool: ITool = {
  name: 'browser_type',
  options: {
    title: 'Browser Type',
    description: 'Type text into any input field, textarea, search bar, or contenteditable element by CSS selector. Use this to fill out forms, enter search queries, write messages, type login credentials, etc. Examples: browser_type({selector: "input[name=email]", text: "user@example.com"}), browser_type({selector: "#search", text: "search query"}). Combine with browser_click to submit forms after filling them. To type into an element inside an iframe, pass frameIndex from browser_frames. To reach into shadow DOM, prefix the selector with "pierce/" (e.g. "pierce/input#name") — no frameIndex needed for that.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the element to type into. Prefix with "pierce/" to reach into shadow DOM.'),
      text: z.string().describe('Text to type into the element.'),
      frameIndex: z.number().optional().describe('Target a specific iframe by index (from browser_frames) instead of the main page.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, text, frameIndex, sessionId, mode } = args as {
      selector?: string;
      text?: string;
      frameIndex?: number;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!selector) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_SELECTOR', message: 'selector is required' })
        }]
      };
    }

    if (!text) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_TEXT', message: 'text is required' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_type', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector });

      const session = getSession(modeResult.sessionId!);
      let target: typeof session.page = session.page;
      if (frameIndex !== undefined) {
        const frame = session.page.frames()[frameIndex];
        if (!frame) {
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ code: 'FRAME_NOT_FOUND', message: `No frame at index ${frameIndex}` }) }]
          };
        }
        target = frame as unknown as typeof session.page;
      }
      await target.waitForSelector(selector, { visible: true, timeout: 5000 });
      await target.type(selector, text);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_type failed', { error: String(error) });
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
