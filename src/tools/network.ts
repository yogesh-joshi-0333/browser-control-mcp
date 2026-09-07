import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getNetworkLog, clearNetworkLog, setBlockedResourceTypes } from '../puppeteer-manager.js';

const DEFAULT_LIST_LIMIT = 100;

export const networkTool: ITool = {
  name: 'browser_network',
  options: {
    title: 'Browser Network',
    description:
      'Inspect or control network traffic for a headless session: list captured requests (url, method, resourceType, status), ' +
      'clear the log, or block requests by resource type (e.g. "image", "font", "stylesheet", "media") to speed up pages and ' +
      'reduce noise. Blocking is only available in headless mode — connect mode (the user\'s real Chrome tab) never intercepts ' +
      'requests, to avoid adding latency or risk to their live browsing.',
    inputSchema: z.object({
      action: z.enum(['list', 'clear', 'block', 'unblock']).describe('Action to perform'),
      resourceTypes: z.array(z.string()).optional().describe('Resource types for "block", e.g. ["image", "font", "stylesheet", "media"]. Omit for "unblock" to clear all blocking.'),
      limit: z.number().optional().describe(`Max entries to return for "list" (default ${DEFAULT_LIST_LIMIT}), most recent last.`),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, resourceTypes, limit, sessionId, mode } = args as {
      action?: string;
      resourceTypes?: string[];
      limit?: number;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_network', { mode: modeResult.mode, sessionId: modeResult.sessionId, action });

      if (modeResult.mode === 'connect' && (action === 'block' || action === 'unblock')) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: JSON.stringify({
              code: 'NOT_SUPPORTED_IN_CONNECT_MODE',
              message: 'Request blocking is not available in connect mode — it would intercept every request on the user\'s real, already-open browser tab.'
            })
          }]
        };
      }

      switch (action) {
        case 'list': {
          const log = getNetworkLog(modeResult.sessionId!);
          const cap = limit ?? DEFAULT_LIST_LIMIT;
          const entries = log.slice(-cap);
          return { content: [{ type: 'text', text: JSON.stringify({ entries, totalCaptured: log.length }) }] };
        }

        case 'clear': {
          clearNetworkLog(modeResult.sessionId!);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        case 'block': {
          if (!resourceTypes || resourceTypes.length === 0) {
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_RESOURCE_TYPES', message: 'resourceTypes is required and must be non-empty for "block"' }) }]
            };
          }
          setBlockedResourceTypes(modeResult.sessionId!, resourceTypes);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, blockedResourceTypes: resourceTypes }) }] };
        }

        case 'unblock': {
          setBlockedResourceTypes(modeResult.sessionId!, []);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` }) }]
          };
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_network failed', { error: String(error) });
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
