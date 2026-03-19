import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { sendToExtension } from '../websocket.js';
import { getSession } from '../puppeteer-manager.js';

export const dialogTool: ITool = {
  name: 'browser_handle_dialog',
  options: {
    title: 'Handle Browser Dialog',
    description: 'Handle JavaScript alert(), confirm(), and prompt() dialogs. Call this BEFORE triggering an action that shows a dialog (e.g. before clicking a delete button that shows a confirm). The handler will auto-accept or auto-dismiss the next dialog that appears. For prompt() dialogs, provide promptText to enter text before accepting. If a dialog is already showing, it will be handled immediately.',
    inputSchema: z.object({
      action: z.enum(['accept', 'dismiss']).describe('Accept or dismiss the dialog'),
      promptText: z.string().optional().describe('Text to enter if the dialog is a prompt()'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['extension', 'headless']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, promptText, sessionId, mode } = args as {
      action?: 'accept' | 'dismiss';
      promptText?: string;
      sessionId?: string;
      mode?: 'extension' | 'headless';
    };

    if (!action) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_ACTION', message: 'action is required and must be "accept" or "dismiss"' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_handle_dialog', { mode: modeResult.mode, sessionId: modeResult.sessionId, action });

      if (modeResult.mode === 'extension') {
        await sendToExtension({ action: 'handle_dialog', payload: { action, promptText } });
      } else {
        const session = getSession(modeResult.sessionId!);
        session.page.once('dialog', async (dialog) => {
          if (action === 'accept') {
            await dialog.accept(promptText);
          } else {
            await dialog.dismiss();
          }
        });
      }

      const verb = action === 'accept' ? 'accept' : 'dismiss';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, message: `Dialog handler armed — will ${verb} the next dialog` })
        }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_handle_dialog failed', { error: String(error) });
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
