import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { isDebugChromeRunning, listSessions } from '../puppeteer-manager.js';

const outputSchema = z.object({
  connectAvailable: z.boolean().describe('Whether a Chrome debug port is available for connect mode'),
  headlessSessions: z.array(z.string()).describe('List of active headless session IDs')
});

export const statusTool: ITool = {
  name: 'browser_status',
  options: {
    title: 'Browser Status',
    description: 'Check browser readiness: reports whether a Chrome debug port is available (for connect mode) and lists all active Puppeteer session IDs. No parameters needed. Use this to verify the server is running and see which browser sessions are available before interacting with pages.',
    inputSchema: z.object({}),
    outputSchema
  },
  handler: async (_args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      const connectAvailable = await isDebugChromeRunning();
      const sessions = listSessions();
      const status = { connectAvailable, headlessSessions: sessions };
      logger.info('browser_status called', status);
      return {
        content: [{ type: 'text', text: JSON.stringify(status) }],
        structuredContent: status
      };
    } catch (error) {
      logger.error('browser_status failed', { error: String(error) });
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'browser_status failed unexpectedly' })
        }]
      };
    }
  }
};
