import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';
import { stripTags } from '../dom-utils.js';

export const getDomTool: ITool = {
  name: 'browser_get_dom',
  options: {
    title: 'Get Browser DOM',
    description: 'Get the HTML source code of the current page (or a scoped subtree). Returns the rendered DOM including dynamically loaded content. Use this to: find CSS selectors for browser_click/browser_type, understand page structure, check element attributes and classes, inspect form fields, or analyze the page content as HTML or plain text. For large pages, prefer browser_snapshot (accessibility-tree view) or scope with `selector` — a full-page dump can be tens of thousands of characters.',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to scope the result to a single subtree instead of the whole page.'),
      format: z.enum(['html', 'text']).optional().describe('"html" (default) returns markup. "text" strips tags and returns visible text only — much smaller for reading content.'),
      maxLength: z.number().optional().describe('Truncate the returned dom string to this many characters. Omit for no limit (default).'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, format, maxLength, sessionId, mode } = args as {
      selector?: string;
      format?: 'html' | 'text';
      maxLength?: number;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_get_dom', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector, format });

      const session = getSession(modeResult.sessionId!);

      let dom: string;
      if (selector) {
        const scoped = await session.page.evaluate((sel: string, fmt: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const win = globalThis as any;
          const el = win.document.querySelector(sel);
          if (!el) return null;
          return fmt === 'text' ? (el.innerText ?? el.textContent ?? '') : el.outerHTML;
        }, selector, format ?? 'html');

        if (scoped === null) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: JSON.stringify({ code: 'SELECTOR_NOT_FOUND', message: `No element matches selector: ${selector}` })
            }]
          };
        }
        dom = scoped;
      } else {
        const html = await session.page.content();
        dom = format === 'text' ? stripTags(html) : html;
      }

      const totalLength = dom.length;
      const truncated = typeof maxLength === 'number' && dom.length > maxLength;
      if (truncated) {
        dom = dom.slice(0, maxLength);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(truncated ? { dom, truncated: true, totalLength } : { dom })
        }]
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
