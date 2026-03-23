import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const scrollTool: ITool = {
  name: 'browser_scroll',
  options: {
    title: 'Scroll Browser Page',
    description: 'Scroll the page by pixel amount. Use positive y to scroll down, negative y to scroll up. Examples: scroll down 500px → {y: 500}, scroll up → {y: -500}, scroll to bottom → {y: 99999}, scroll right → {x: 500}. Returns the final scroll position. Useful for viewing content below the fold, triggering lazy-loaded images, or reaching elements further down the page.',
    inputSchema: z.object({
      x: z.number().default(0).describe('Horizontal scroll amount in pixels.'),
      y: z.number().default(0).describe('Vertical scroll amount in pixels.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { x = 0, y = 0, sessionId, mode } = args as { x?: number; y?: number; sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_scroll', { mode: modeResult.mode, sessionId: modeResult.sessionId, x, y });

      const session = getSession(modeResult.sessionId!);
      const pos = await session.page.evaluate((dx: number, dy: number) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const win = globalThis as any;
        // Find the first scrollable element, same as Chrome extension logic
        let target: any = null;
        if (win.document.documentElement.scrollHeight > win.innerHeight) {
          target = win.document.documentElement;
        } else {
          const all = Array.from(win.document.querySelectorAll('*')) as any[];
          target = all.find((el: any) => {
            const s = win.getComputedStyle(el);
            return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
          }) || win.document.documentElement;
        }
        target.scrollBy(dx, dy);
        return { scrollX: target.scrollLeft ?? 0, scrollY: target.scrollTop ?? 0 };
      }, x, y);
      const scrollX = pos.scrollX;
      const scrollY = pos.scrollY;

      return {
        content: [{ type: 'text', text: JSON.stringify({ scrollX, scrollY }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_scroll failed', { error: String(error) });
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
