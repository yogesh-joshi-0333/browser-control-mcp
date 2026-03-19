import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const fileUploadTool: ITool = {
  name: 'browser_file_upload',
  options: {
    title: 'Browser File Upload',
    description: 'Upload one or more files to a file input element. Provide the CSS selector of the <input type="file"> element and an array of absolute file paths to upload. Works with single and multiple file inputs. Examples: browser_file_upload({selector: "input[type=file]", paths: ["/home/user/document.pdf"]}) or multiple files: browser_file_upload({selector: "#photos", paths: ["/tmp/img1.png", "/tmp/img2.png"]})',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the <input type="file"> element.'),
      paths: z.array(z.string()).min(1).describe('Array of absolute file paths to upload.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, paths, sessionId, mode } = args as {
      selector?: string;
      paths?: string[];
      sessionId?: string;
      mode?: 'extension' | 'headless';
    };

    if (!selector) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_SELECTOR', message: 'selector is required' })
        }]
      };
    }

    if (!paths || paths.length === 0) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_PATHS', message: 'paths is required and must not be empty' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_file_upload', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector, paths });

      if (modeResult.mode === 'extension') {
        await sendToExtension({ action: 'file_upload', payload: { selector, paths } });
      } else {
        const session = getSession(modeResult.sessionId!);
        await session.page.waitForSelector(selector, { timeout: 5000 });

        const fileInput = await session.page.$(selector);
        if (!fileInput) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: JSON.stringify({ code: 'ELEMENT_NOT_FOUND', message: `Element not found: ${selector}` })
            }]
          };
        }

        await fileInput.uploadFile(...paths);

        // Dispatch change event so JS frameworks detect the file selection
        await session.page.evaluate((sel: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const win = globalThis as any;
          const el = win.document.querySelector(sel);
          if (el) {
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, selector);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, filesUploaded: paths.length }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_file_upload failed', { error: String(error) });
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
