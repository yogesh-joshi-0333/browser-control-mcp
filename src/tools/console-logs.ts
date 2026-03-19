import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSessionLogs } from '../puppeteer-manager.js';

export const consoleLogsTool: ITool = {
  name: 'browser_console_logs',
  options: {
    title: 'Get Browser Console Logs',
    description: 'Read JavaScript console output from the current page — includes console.log, console.warn, console.error, and console.info messages with timestamps. Use this to: debug JavaScript errors, check for failed API calls, find runtime exceptions, see application logs, or diagnose why something is not working on the page.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sessionId, mode } = args as { sessionId?: string; mode?: 'extension' | 'headless' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_console_logs', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      let logs: Array<{ type: string; text: string; timestamp: string }>;

      if (modeResult.mode === 'extension') {
        const response = await sendToExtension({ action: 'get_console_logs', payload: {} });
        logs = response.logs as Array<{ type: string; text: string; timestamp: string }>;
      } else {
        logs = getSessionLogs(modeResult.sessionId!);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ logs }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_console_logs failed', { error: String(error) });
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
