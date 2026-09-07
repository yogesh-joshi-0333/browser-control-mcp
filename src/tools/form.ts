import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function describeElement(selector: string) {
  const win = globalThis as any;
  const el = win.document.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return { tagName: el.tagName, type: (el.getAttribute('type') || '').toLowerCase(), checked: !!el.checked };
}

export const formFillTool: ITool = {
  name: 'browser_form_fill',
  options: {
    title: 'Browser Form Fill',
    description:
      'Fill multiple form fields in one call: { "#email": "user@example.com", "#country": "IN" }. Automatically uses ' +
      'the right interaction per element — types into text inputs/textareas, uses native <select> selection, and ' +
      'clicks checkboxes/radios (interpreting a truthy value as "check it"). Optionally click a submit button afterward.',
    inputSchema: z.object({
      fields: z.record(z.string(), z.string()).describe('Map of CSS selector -> value to fill. Non-empty.'),
      submitSelector: z.string().optional().describe('CSS selector of a submit button to click after all fields are filled.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { fields, submitSelector, sessionId, mode } = args as {
      fields?: Record<string, string>;
      submitSelector?: string;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!fields || Object.keys(fields).length === 0) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_FIELDS', message: 'fields must be a non-empty object of selector -> value' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_form_fill', { mode: modeResult.mode, sessionId: modeResult.sessionId, fieldCount: Object.keys(fields).length });

      const session = getSession(modeResult.sessionId!);
      const filled: string[] = [];

      for (const [selector, value] of Object.entries(fields)) {
        await session.page.waitForSelector(selector, { visible: true, timeout: 5000 });
        const info = await session.page.evaluate(describeElement, selector) as { tagName: string; type: string; checked: boolean };

        if (info.tagName === 'SELECT') {
          await session.page.select(selector, value);
        } else if (info.type === 'checkbox' || info.type === 'radio') {
          const shouldCheck = value === 'true' || value === '1';
          if (shouldCheck !== info.checked) {
            await session.page.click(selector);
          }
        } else {
          await session.page.type(selector, value);
        }
        filled.push(selector);
      }

      if (submitSelector) {
        await session.page.click(submitSelector);
      }

      return { content: [{ type: 'text', text: JSON.stringify({ success: true, filled }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_form_fill failed', { error: String(error) });
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
