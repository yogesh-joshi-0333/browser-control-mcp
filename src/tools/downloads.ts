import { z } from 'zod';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { setDownloadPath, getDownloadPath } from '../puppeteer-manager.js';

export const downloadsTool: ITool = {
  name: 'browser_downloads',
  options: {
    title: 'Browser Downloads',
    description:
      'Configure where downloads are saved for this session, and list what has landed there. ' +
      'Call action "configure" once with a directory before triggering a download (e.g. clicking a download link), ' +
      'then action "list" afterward to see the files and their sizes.',
    inputSchema: z.object({
      action: z.enum(['configure', 'list']).describe('Action to perform'),
      path: z.string().optional().describe('Absolute directory path to save downloads to (required for "configure")'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, path, sessionId, mode } = args as {
      action?: string;
      path?: string;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_downloads', { mode: modeResult.mode, sessionId: modeResult.sessionId, action });

      switch (action) {
        case 'configure': {
          if (!path) {
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_PATH', message: 'path is required to configure a download directory' }) }]
            };
          }
          await setDownloadPath(modeResult.sessionId!, path);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, path }) }] };
        }

        case 'list': {
          const downloadPath = getDownloadPath(modeResult.sessionId!);
          if (!downloadPath) {
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ code: 'DOWNLOAD_PATH_NOT_CONFIGURED', message: 'Call browser_downloads with action "configure" first' }) }]
            };
          }
          const names = await readdir(downloadPath);
          const files = await Promise.all(names.map(async (name) => {
            const info = await stat(join(downloadPath, name));
            return { name, sizeBytes: info.size, modifiedAt: info.mtime.toISOString() };
          }));
          return { content: [{ type: 'text', text: JSON.stringify({ files, path: downloadPath }) }] };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` }) }]
          };
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_downloads failed', { error: String(error) });
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
