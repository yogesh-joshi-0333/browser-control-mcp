import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const typeTool: ITool = {
  name: 'browser_type',
  options: {
    title: 'Browser Type',
    description: 'Type text into any input field, textarea, search bar, or contenteditable element by CSS selector. Use this to fill out forms, enter search queries, write messages, type login credentials, etc. Examples: browser_type({selector: "input[name=email]", text: "user@example.com"}), browser_type({selector: "#search", text: "search query"}). Combine with browser_click to submit forms after filling them.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the element to type into.'),
      text: z.string().describe('Text to type into the element.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, text, sessionId, mode } = args as {
      selector?: string;
      text?: string;
      sessionId?: string;
      mode?: 'extension' | 'headless';
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

      if (modeResult.mode === 'extension') {
        await sendToExtension({ action: 'type_text', payload: { selector, text } });
      } else {
        const session = getSession(modeResult.sessionId!);
        await session.page.type(selector, text);
      }

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
