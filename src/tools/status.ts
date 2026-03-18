import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { getConnectionState } from '../websocket.js';
import { listSessions } from '../puppeteer-manager.js';

const outputSchema = z.object({
  extensionConnected: z.boolean().describe('Whether the Chrome Extension is connected'),
  headlessSessions: z.array(z.string()).describe('List of active headless session IDs')
});

export const statusTool: ITool = {
  name: 'browser_status',
  options: {
    title: 'Browser Status',
    description: 'Check Chrome Extension connection status and list active headless Puppeteer sessions',
    inputSchema: z.object({}),
    outputSchema
  },
  handler: async (_args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      const { connected } = getConnectionState();
      const sessions = listSessions();
      const status = { extensionConnected: connected, headlessSessions: sessions };
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
