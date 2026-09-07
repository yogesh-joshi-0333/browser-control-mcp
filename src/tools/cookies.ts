import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const cookiesTool: ITool = {
  name: 'browser_cookies',
  options: {
    title: 'Browser Cookies',
    description:
      'Get, set, delete, or clear cookies on the current page. Use this to inspect auth/session cookies, ' +
      'inject a saved session to skip a login flow, or clean up before testing a fresh session.',
    inputSchema: z.object({
      action: z.enum(['get', 'set', 'delete', 'clear']).describe('Action to perform'),
      name: z.string().optional().describe('Cookie name (required for "set" and "delete")'),
      value: z.string().optional().describe('Cookie value (required for "set")'),
      domain: z.string().optional().describe('Cookie domain (optional for "set", defaults to the current page\'s domain)'),
      path: z.string().optional().describe('Cookie path (optional for "set")'),
      httpOnly: z.boolean().optional().describe('Mark cookie HttpOnly (optional for "set")'),
      secure: z.boolean().optional().describe('Mark cookie Secure (optional for "set")'),
      expires: z.number().optional().describe('Unix timestamp in seconds when the cookie expires (optional for "set")'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, name, value, domain, path, httpOnly, secure, expires, sessionId, mode } = args as {
      action?: string;
      name?: string;
      value?: string;
      domain?: string;
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      expires?: number;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_cookies', { mode: modeResult.mode, sessionId: modeResult.sessionId, action, name });

      const session = getSession(modeResult.sessionId!);

      switch (action) {
        case 'get': {
          const cookies = await session.page.cookies();
          return { content: [{ type: 'text', text: JSON.stringify({ cookies }) }] };
        }

        case 'set': {
          if (!name || value === undefined) {
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_COOKIE', message: 'name and value are required to set a cookie' }) }]
            };
          }
          const cookie: {
            name: string; value: string; domain?: string; path?: string;
            httpOnly?: boolean; secure?: boolean; expires?: number;
          } = { name, value };
          if (domain !== undefined) cookie.domain = domain;
          if (path !== undefined) cookie.path = path;
          if (httpOnly !== undefined) cookie.httpOnly = httpOnly;
          if (secure !== undefined) cookie.secure = secure;
          if (expires !== undefined) cookie.expires = expires;
          await session.page.setCookie(cookie);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        case 'delete': {
          if (!name) {
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_COOKIE', message: 'name is required to delete a cookie' }) }]
            };
          }
          await session.page.deleteCookie({ name });
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        case 'clear': {
          const existing = await session.page.cookies();
          if (existing.length > 0) {
            await session.page.deleteCookie(...existing);
          }
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, cleared: existing.length }) }] };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` }) }]
          };
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_cookies failed', { error: String(error) });
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
