import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const tabsTool: ITool = {
  name: 'browser_tabs',
  options: {
    title: 'Browser Tabs',
    description: 'Manage browser tabs — list open tabs, create new tabs, switch between tabs, or close tabs. Use this for: OAuth flows that open popups, links that open in new tabs, multi-page workflows, or cleaning up tabs. In headless mode, manages pages within the Puppeteer browser session.',
    inputSchema: z.object({
      action: z.enum(['list', 'new', 'close', 'switch']).describe('Action to perform'),
      url: z.string().optional().describe('URL to open in new tab (for "new" action). Defaults to "about:blank"'),
      index: z.number().optional().describe('Tab index for "switch" or "close" actions (0-based)'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, url, index, sessionId, mode } = args as {
      action?: string;
      url?: string;
      index?: number;
      sessionId?: string;
      mode?: 'extension' | 'headless';
    };

    if (!action) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_ACTION', message: 'action is required' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_tabs', { mode: modeResult.mode, sessionId: modeResult.sessionId, action, url, index });

      if (modeResult.mode === 'extension') {
        const result = await sendToExtension({ action: 'manage_tabs', payload: { action, url, index } });
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        };
      } else {
        const session = getSession(modeResult.sessionId!);
        const browser = session.browser;

        switch (action) {
          case 'list': {
            const pages = await browser.pages();
            const tabs = await Promise.all(
              pages.map(async (page: { url: () => string; title: () => Promise<string> }, i: number) => ({
                index: i,
                url: page.url(),
                title: await page.title()
              }))
            );
            return {
              content: [{ type: 'text', text: JSON.stringify({ tabs }) }]
            };
          }

          case 'new': {
            const pages = await browser.pages();
            const newPage = await browser.newPage();
            const targetUrl = url || 'about:blank';
            if (url) {
              await newPage.goto(targetUrl, { waitUntil: 'networkidle2' });
            }
            const newIndex = pages.length;
            return {
              content: [{ type: 'text', text: JSON.stringify({ index: newIndex, url: targetUrl, success: true }) }]
            };
          }

          case 'switch': {
            const pages = await browser.pages();
            if (index === undefined || index < 0 || index >= pages.length) {
              return {
                isError: true,
                content: [{
                  type: 'text',
                  text: JSON.stringify({ code: 'INVALID_INDEX', message: `Tab index ${index} is out of range (0-${pages.length - 1})` })
                }]
              };
            }
            await pages[index].bringToFront();
            (session as any).page = pages[index];
            return {
              content: [{ type: 'text', text: JSON.stringify({ index, url: pages[index].url(), success: true }) }]
            };
          }

          case 'close': {
            const pages = await browser.pages();
            if (pages.length <= 1) {
              return {
                isError: true,
                content: [{
                  type: 'text',
                  text: JSON.stringify({ code: 'LAST_TAB', message: 'Cannot close the last tab' })
                }]
              };
            }
            if (index === undefined || index < 0 || index >= pages.length) {
              return {
                isError: true,
                content: [{
                  type: 'text',
                  text: JSON.stringify({ code: 'INVALID_INDEX', message: `Tab index ${index} is out of range (0-${pages.length - 1})` })
                }]
              };
            }
            const closedPage = pages[index];
            await closedPage.close();
            if (closedPage === session.page) {
              const remainingPages = await browser.pages();
              (session as any).page = remainingPages[0];
            }
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
            };
          }

          default:
            return {
              isError: true,
              content: [{
                type: 'text',
                text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` })
              }]
            };
        }
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_tabs failed', { error: String(error) });
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
