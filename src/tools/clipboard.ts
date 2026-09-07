import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const clipboardTool: ITool = {
  name: 'browser_clipboard',
  options: {
    title: 'Browser Clipboard',
    description:
      'Read or write the system clipboard from the page context. Automatically grants the clipboard-read/clipboard-write ' +
      'permissions for the current origin first — you do NOT need to call browser_emulate separately for this. ' +
      'Use to verify a "Copy to clipboard" button worked, or to paste text a page doesn\'t expose an input for.',
    inputSchema: z.object({
      action: z.enum(['read', 'write']).describe('Action to perform'),
      text: z.string().optional().describe('Text to write to the clipboard (required for "write")'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, text, sessionId, mode } = args as {
      action?: string;
      text?: string;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (action === 'write' && text === undefined) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_TEXT', message: 'text is required for action "write"' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_clipboard', { mode: modeResult.mode, sessionId: modeResult.sessionId, action });

      const session = getSession(modeResult.sessionId!);

      // Grant clipboard permissions automatically — the agent shouldn't need to
      // remember a separate browser_emulate call just to use this tool.
      // NOTE: browserContext().overridePermissions() does NOT reliably grant
      // clipboard permissions in this Puppeteer/Chrome combination (verified:
      // the call resolves but navigator.permissions.query() still reports
      // "denied"). Raw CDP Browser.grantPermissions does work.
      const origin = new URL(session.page.url()).origin;
      const client = await session.page.createCDPSession();
      await client.send('Browser.grantPermissions', {
        origin,
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite']
      });

      // Both writeText and readText require the document to be focused.
      await session.page.bringToFront();

      if (action === 'write') {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        await session.page.evaluate((value: string) => (globalThis as any).navigator.clipboard.writeText(value), text!);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      if (action === 'read') {
        const clipboardText = await session.page.evaluate(() => (globalThis as any).navigator.clipboard.readText());
        return { content: [{ type: 'text', text: JSON.stringify({ text: clipboardText }) }] };
      }

      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_clipboard failed', { error: String(error) });
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
