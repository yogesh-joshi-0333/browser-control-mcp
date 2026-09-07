import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const authTool: ITool = {
  name: 'browser_auth',
  options: {
    title: 'Browser HTTP Basic Auth',
    description:
      'Set or clear HTTP Basic/Digest Auth credentials for the current page — the kind of login prompt the browser itself ' +
      'shows (a native dialog), not a login form on the page. Call this BEFORE browser_navigate to a protected URL ' +
      '(e.g. a password-protected staging site). Use clear:true to remove credentials afterward.',
    inputSchema: z.object({
      username: z.string().optional().describe('Basic Auth username (required unless clear:true)'),
      password: z.string().optional().describe('Basic Auth password (required unless clear:true)'),
      clear: z.boolean().optional().describe('If true, clear any previously set credentials instead of setting new ones'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { username, password, clear, sessionId, mode } = args as {
      username?: string;
      password?: string;
      clear?: boolean;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!clear && (!username || password === undefined)) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_CREDENTIALS', message: 'username and password are required unless clear:true' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_auth', { mode: modeResult.mode, sessionId: modeResult.sessionId, clear: Boolean(clear) });

      const session = getSession(modeResult.sessionId!);
      await session.page.authenticate(clear ? null : { username: username!, password: password! });

      return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_auth failed', { error: String(error) });
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
