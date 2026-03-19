import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';
import { waitForDomStable } from '../dom-utils.js';

export const clickTool: ITool = {
  name: 'browser_click',
  options: {
    title: 'Browser Click',
    description: 'Click any element on the page by CSS selector — buttons, links, menus, dropdowns, checkboxes, tabs, etc. Examples: "#submit-btn", "button[type=submit]", ".nav-link", "a.login". Waits for the element to be visible, clicks it, then waits for the page to stabilize (handles AJAX, animations, re-renders). Use browser_get_dom first if you need to find the right selector.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the element to click.'),
      humanClick: z.boolean().default(true).describe('If true (default), simulates full human-like mouse event chain: mouseover → mouseenter → mousemove → mousedown → focus → mouseup → click. Required for Select2/jQuery dropdowns, custom widgets, and JS-heavy UIs. Set false for simple links/buttons.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, humanClick = true, sessionId, mode } = args as {
      selector?: string;
      humanClick?: boolean;
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

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_click', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector, humanClick });

      if (modeResult.mode === 'extension') {
        await sendToExtension({ action: 'click_element', payload: { selector, humanClick } });
      } else {
        const session = getSession(modeResult.sessionId!);
        // Wait for element to be present and visible before clicking
        await session.page.waitForSelector(selector, { visible: true, timeout: 5000 });

        if (humanClick) {
          // Human-like click: move mouse to element center, dispatch full event chain
          // This is required for Select2, jQuery UI, custom dropdowns, and JS-heavy widgets
          const elementHandle = await session.page.$(selector);
          if (!elementHandle) throw new Error(`Element not found: ${selector}`);
          const box = await elementHandle.boundingBox();
          if (!box) throw new Error(`Element has no visible bounding box: ${selector}`);

          // Move mouse to element center (triggers mouseover/mouseenter/mousemove)
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          await session.page.mouse.move(centerX, centerY);

          // Small delay to mimic human behavior and let hover handlers fire
          await new Promise(r => setTimeout(r, 50));

          // Full click: mousedown → mouseup → click (Puppeteer dispatches all three)
          await session.page.mouse.click(centerX, centerY);
        } else {
          // Simple DOM click — fast but may not trigger custom JS widgets
          await session.page.evaluate((sel: string) => {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const win = globalThis as any;
            const el = win.document.querySelector(sel);
            if (!el) throw new Error(`Element not found: ${sel}`);
            el.click();
          }, selector);
        }

        // Wait for DOM to settle (handles API calls, animations, re-renders after click)
        await waitForDomStable(session.page);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_click failed', { error: String(error) });
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
