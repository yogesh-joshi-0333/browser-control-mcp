import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const navigateTool: ITool = {
  name: 'browser_navigate',
  options: {
    title: 'Navigate Browser',
    description: 'Navigate the browser to a URL. Uses the Chrome Extension by default, or a Puppeteer session in headless mode.',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to.'),
      width: z.number().optional().describe('Viewport width in pixels (headless only). Default 1024.'),
      height: z.number().optional().describe('Viewport height in pixels (headless only). Default 768.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { url, sessionId, mode, width, height } = args as { url?: string; sessionId?: string; mode?: 'extension' | 'headless'; width?: number; height?: number };

    if (!url) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_URL', message: 'url is required' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_navigate', { mode: modeResult.mode, sessionId: modeResult.sessionId, url });

      let finalUrl: string;

      if (modeResult.mode === 'extension') {
        const response = await sendToExtension({ action: 'navigate', payload: { url } });
        finalUrl = response.url as string;
      } else {
        const session = getSession(modeResult.sessionId!);
        if (width || height) {
          await session.page.setViewport({ width: width ?? 1024, height: height ?? 768 });
        }
        await session.page.goto(url, { waitUntil: 'networkidle2' });
        // Wait for DOM to stop mutating (JS init, animations, deferred renders)
        await waitForDomStable(session.page);
        finalUrl = session.page.url();
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ url: finalUrl, sessionId: modeResult.sessionId }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_navigate failed', { error: String(error) });
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
 * Catches JS init, deferred renders, and post-load animations.
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
      // Also resolve after 3s max in case page is always mutating
      setTimeout(() => { observer.disconnect(); resolve(true); }, 3000);
    })
  `, { timeout: 5000 });
}
