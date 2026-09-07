import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractPageText(): string {
  const win = globalThis as any;
  return (win.document.body.innerText || '').trim();
}

function extractFromSelector(selector: string, attribute: string | undefined, multiple: boolean): unknown {
  const win = globalThis as any;
  const doc = win.document;
  const read = (el: any) => (attribute ? el.getAttribute(attribute) : (el.innerText ?? el.textContent ?? '').trim());

  if (multiple) {
    return Array.from(doc.querySelectorAll(selector)).map(read);
  }
  const el = doc.querySelector(selector);
  return el ? read(el) : null;
}

export const extractTool: ITool = {
  name: 'browser_extract',
  options: {
    title: 'Browser Extract',
    description:
      'Extract structured text or attributes from the page without dumping raw HTML. ' +
      'With no selector, returns the page\'s visible text content (like a reader view). ' +
      'With a selector, returns the text (or a given attribute) of the matching element(s). ' +
      'Much smaller and more directly useful than browser_get_dom when you just need the content, not the markup.',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to scope extraction to. Omit to extract the whole page\'s visible text.'),
      attribute: z.string().optional().describe('Attribute to extract instead of text, e.g. "href", "src", "value". Requires selector.'),
      multiple: z.boolean().optional().describe('If true, return an array of results for every match instead of just the first (default false).'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, attribute, multiple, sessionId, mode } = args as {
      selector?: string;
      attribute?: string;
      multiple?: boolean;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_extract', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector, attribute, multiple });

      const session = getSession(modeResult.sessionId!);

      const result = selector
        ? await session.page.evaluate(extractFromSelector, selector, attribute, multiple ?? false)
        : await session.page.evaluate(extractPageText);

      return { content: [{ type: 'text', text: JSON.stringify({ result }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_extract failed', { error: String(error) });
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
