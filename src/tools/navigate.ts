import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';
import { waitForDomStable } from '../dom-utils.js';

export const navigateTool: ITool = {
  name: 'browser_navigate',
  options: {
    title: 'Navigate Browser',
    description: 'Navigate the browser to any URL — websites, localhost, web apps. Opens the page and waits for it to fully load. In headless mode, you can set custom viewport dimensions (width/height in pixels) to simulate desktop (1920x1080), tablet (768x1024), or mobile (375x812) screen sizes. Returns the final URL and sessionId. Pass the returned sessionId to all subsequent tool calls to reuse this browser session. Pass proxyServer or profile (only when NOT reusing an existing sessionId) — both apply at browser launch and cannot be changed on an existing session.',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to.'),
      width: z.number().optional().describe('Viewport width in pixels (headless only). Default 1024.'),
      height: z.number().optional().describe('Viewport height in pixels (headless only). Default 768.'),
      proxyServer: z.string().optional().describe('Proxy server for a NEW headless session, e.g. "127.0.0.1:8080" or "http://user:pass@host:port". Ignored if sessionId is already set — proxy can only be set when the browser launches.'),
      profile: z.string().optional().describe('Named persistent profile for a NEW headless session (letters, digits, dash, underscore only) — cookies/localStorage survive across separate MCP server runs, unlike normal sessions which are wiped when the session ends. Manage profiles with browser_profiles. Ignored if sessionId is already set.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { url, sessionId, mode, width, height, proxyServer, profile } = args as { url?: string; sessionId?: string; mode?: 'headless' | 'connect'; width?: number; height?: number; proxyServer?: string; profile?: string };

    if (!url) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_URL', message: 'url is required' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode, proxyServer, profile });
      logger.info('browser_navigate', { mode: modeResult.mode, sessionId: modeResult.sessionId, url });

      const session = getSession(modeResult.sessionId!);
      if (width || height) {
        await session.page.setViewport({ width: width ?? 1024, height: height ?? 768 });
      }
      await session.page.goto(url, { waitUntil: 'networkidle2' });
      // Wait for DOM to stop mutating (JS init, animations, deferred renders)
      await waitForDomStable(session.page);
      const finalUrl = session.page.url();

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
