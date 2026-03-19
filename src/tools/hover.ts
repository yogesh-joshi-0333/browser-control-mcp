import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const hoverTool: ITool = {
  name: 'browser_hover',
  options: {
    title: 'Browser Hover',
    description: 'Hover over an element to trigger dropdown menus, tooltips, hover effects, or any mouseover-activated content. The mouse moves to the element center and stays there. Use this before browser_click when a menu only appears on hover, or to reveal hidden UI elements.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the element to hover over.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, sessionId, mode } = args as {
      selector?: string;
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
      logger.info('browser_hover', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector });

      if (modeResult.mode === 'extension') {
        await sendToExtension({ action: 'hover_element', payload: { selector } });
      } else {
        const session = getSession(modeResult.sessionId!);
        // Wait for element to be present and visible before hovering
        await session.page.waitForSelector(selector, { visible: true, timeout: 5000 });

        const elementHandle = await session.page.$(selector);
        if (!elementHandle) throw new Error(`Element not found: ${selector}`);
        const box = await elementHandle.boundingBox();
        if (!box) throw new Error(`Element has no visible bounding box: ${selector}`);

        // Move mouse to element center (triggers mouseover/mouseenter/mousemove)
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        await session.page.mouse.move(centerX, centerY);

        // Small delay to let hover effects trigger
        await new Promise(r => setTimeout(r, 100));

        // Wait for DOM to settle (handles hover-triggered content, animations, re-renders)
        await waitForDomStable(session.page);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_hover failed', { error: String(error) });
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
