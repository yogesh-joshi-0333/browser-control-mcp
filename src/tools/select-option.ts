import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const selectOptionTool: ITool = {
  name: 'browser_select_option',
  options: {
    title: 'Browser Select Option',
    description: 'Select an option from a native HTML <select> dropdown by value or visible label text. Also works with Select2/jQuery dropdowns — automatically detects and triggers the correct change events. Examples: browser_select_option({selector: "#country", value: "US"}) or browser_select_option({selector: "#country", label: "United States"}). For complex custom dropdowns that don\'t use <select>, use browser_execute with jQuery instead.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the <select> element.'),
      value: z.string().optional().describe('Option value attribute to select.'),
      label: z.string().optional().describe('Visible text of the option to select.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, value, label, sessionId, mode } = args as {
      selector?: string;
      value?: string;
      label?: string;
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

    if (!value && !label) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_OPTION', message: 'At least one of value or label must be provided' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_select_option', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector });

      let selectedValue: string | undefined;

      if (modeResult.mode === 'extension') {
        await sendToExtension({ action: 'select_option', payload: { selector, value, label } });
        selectedValue = value ?? label;
      } else {
        const session = getSession(modeResult.sessionId!);
        const page = session.page;

        if (value) {
          await page.select(selector, value);
          selectedValue = value;
        } else if (label) {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          selectedValue = await page.evaluate((sel: string, lbl: string) => {
            const win = globalThis as any;
            const select = win.document.querySelector(sel);
            if (!select) throw new Error('Element not found');
            const options = Array.from(select.options) as any[];
            const opt = options.find((o: any) => o.textContent?.trim() === lbl);
            if (opt) {
              select.value = opt.value;
              return opt.value as string;
            }
            return undefined;
          }, selector, label) as string | undefined;
        }

        // Dispatch change and input events, trigger jQuery if available
        /* eslint-disable @typescript-eslint/no-explicit-any */
        await page.evaluate((sel: string) => {
          const win = globalThis as any;
          const el = win.document.querySelector(sel);
          if (el) {
            el.dispatchEvent(new (win.Event)('change', { bubbles: true }));
            el.dispatchEvent(new (win.Event)('input', { bubbles: true }));
            if (win.jQuery) {
              win.jQuery(sel).trigger('change');
            }
          }
        }, selector);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, selectedValue }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_select_option failed', { error: String(error) });
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
