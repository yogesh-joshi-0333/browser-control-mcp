import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const pdfTool: ITool = {
  name: 'browser_pdf',
  options: {
    title: 'Browser PDF Export',
    description:
      'Render the current page to a PDF file on disk (not returned inline — PDFs are too large for tool-call context). ' +
      'Returns the saved path and file size. Headless mode only.',
    inputSchema: z.object({
      path: z.string().describe('Absolute file path to save the PDF to.'),
      format: z.enum(['A4', 'Letter', 'Legal', 'Tabloid', 'A3', 'A5']).optional().describe('Paper size (default "A4").'),
      landscape: z.boolean().optional().describe('Landscape orientation (default false).'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { path, format, landscape, sessionId, mode } = args as {
      path?: string;
      format?: 'A4' | 'Letter' | 'Legal' | 'Tabloid' | 'A3' | 'A5';
      landscape?: boolean;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!path) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_PATH', message: 'path is required' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_pdf', { mode: modeResult.mode, sessionId: modeResult.sessionId, path, format, landscape });

      const session = getSession(modeResult.sessionId!);
      const buffer = await session.page.pdf({
        path,
        format: format ?? 'A4',
        landscape: landscape ?? false,
        printBackground: true
      });

      return { content: [{ type: 'text', text: JSON.stringify({ success: true, path, sizeBytes: buffer.length }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_pdf failed', { error: String(error) });
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
