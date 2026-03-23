import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const waitForTool: ITool = {
  name: 'browser_wait_for',
  options: {
    title: 'Wait For Condition',
    description: 'Wait for a condition before proceeding — an element to appear, text to become visible, or text to disappear. Use this to handle dynamic content, AJAX loading, animations, or any async page updates. Examples: wait for a success message after form submit, wait for a loading spinner to disappear, wait for a modal to open. Timeout defaults to 10 seconds.',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to wait for in the DOM'),
      text: z.string().optional().describe('Wait for this text to appear anywhere on the page'),
      textGone: z.string().optional().describe('Wait for this text to disappear from the page'),
      timeout: z.number().optional().default(10000).describe('Maximum wait time in milliseconds'),
      visible: z.boolean().optional().default(true).describe('If true, wait for element to be visible (not just in DOM)'),
      sessionId: z.string().optional().describe('Puppeteer session ID. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const {
      selector,
      text,
      textGone,
      timeout = 10000,
      visible = true,
      sessionId,
      mode
    } = args as {
      selector?: string;
      text?: string;
      textGone?: string;
      timeout?: number;
      visible?: boolean;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!selector && !text && !textGone) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_PARAMS', message: 'At least one of selector, text, or textGone must be provided.' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_wait_for', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector, text, textGone });

      let waited: 'selector' | 'text' | 'textGone';

      const session = getSession(modeResult.sessionId!);
      const page = session.page;

      if (selector) {
        await page.waitForSelector(selector, { visible, timeout });
        waited = 'selector';
      } else if (text) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        await page.waitForFunction(
          (t: string) => (globalThis as any).document.body.innerText.includes(t),
          { timeout },
          text
        );
        waited = 'text';
      } else {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        await page.waitForFunction(
          (t: string) => !(globalThis as any).document.body.innerText.includes(t),
          { timeout },
          textGone!
        );
        waited = 'textGone';
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, waited }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_wait_for failed', { error: String(error) });
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
