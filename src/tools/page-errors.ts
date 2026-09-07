import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSessionPageErrors } from '../puppeteer-manager.js';

export const pageErrorsTool: ITool = {
  name: 'browser_page_errors',
  options: {
    title: 'Get Browser Page Errors',
    description:
      'Read uncaught JavaScript exceptions thrown by the page (window "error" events / unhandled errors in page scripts). ' +
      'Different from browser_console_logs: console_logs only captures explicit console.log/warn/error calls, this ' +
      'captures real crashes — a script that threw and stopped running, even if it never called console.error itself. ' +
      'Check this whenever a page seems "stuck" or a feature silently does nothing.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_page_errors', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      const errors = getSessionPageErrors(modeResult.sessionId!);

      return { content: [{ type: 'text', text: JSON.stringify({ errors }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_page_errors failed', { error: String(error) });
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
