import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const clickTool: ITool = {
  name: 'browser_click',
  options: {
    title: 'Browser Click',
    description: 'Click an element on the page by CSS selector. Uses Chrome Extension by default, or a Puppeteer session in headless mode.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the element to click.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, sessionId, mode } = args as { selector?: string; sessionId?: string; mode?: 'extension' | 'headless' };

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
      logger.info('browser_click', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector });

      if (modeResult.mode === 'extension') {
        await sendToExtension({ action: 'click_element', payload: { selector } });
      } else {
        const session = getSession(modeResult.sessionId!);
        // Wait for element to be present and visible before clicking
        await session.page.waitForSelector(selector, { visible: true, timeout: 5000 });
        // Dispatch click from within page context so all JS event listeners fire correctly
        await session.page.evaluate((sel: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const win = globalThis as any;
          const el = win.document.querySelector(sel);
          if (!el) throw new Error(`Element not found: ${sel}`);
          el.click();
        }, selector);
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

/**
 * Waits until the DOM stops mutating for 300ms, or 3s max.
 * Handles API responses updating DOM, animations completing, re-renders.
 */
async function waitForDomStable(page: { waitForFunction: (fn: string, opts: Record<string, unknown>) => Promise<unknown> }): Promise<void> {
  await page.waitForFunction(`
    new Promise(resolve => {
      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => { observer.disconnect(); resolve(true); }, 300);
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      setTimeout(() => { observer.disconnect(); resolve(true); }, 3000);
    })
  `, { timeout: 5000 });
}
