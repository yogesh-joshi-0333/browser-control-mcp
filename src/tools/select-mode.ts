import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { getConnectionState } from '../websocket.js';
import { getDefaultMode, setDefaultMode } from '../mode-selector.js';
import type { BrowserMode } from '../mode-selector.js';

export const selectModeTool: ITool = {
  name: 'browser_select_mode',
  options: {
    title: 'Select Browser Mode',
    description:
      'Check available browser modes and set the session default. CALL THIS FIRST before using any other browser tool. ' +
      'Two modes: "extension" (controls user\'s real Chrome browser, requires extension installed) or "headless" (invisible background Puppeteer browser, always available). ' +
      'Call without params to see what is available. Call with mode="headless" or mode="extension" to set the default for all subsequent calls. ' +
      'If only headless is available, it is auto-selected.',
    inputSchema: z.object({
      mode: z.enum(['extension', 'headless']).optional().describe(
        'Set the default browser mode for this session. Omit to just query available options.'
      )
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { mode } = args as { mode?: BrowserMode };
    const extensionConnected = getConnectionState().connected;
    const options: BrowserMode[] = extensionConnected
      ? ['extension', 'headless']
      : ['headless'];

    if (mode) {
      if (mode === 'extension' && !extensionConnected) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: JSON.stringify({
              code: 'EXTENSION_NOT_AVAILABLE',
              message: 'Chrome Extension is not connected. Only headless mode is available.'
            })
          }]
        };
      }
      setDefaultMode(mode);
      logger.info('Default browser mode set', { mode });
    }

    const currentMode = getDefaultMode();

    let message: string;
    if (extensionConnected) {
      message = 'Chrome browser extension detected. Available modes: "extension" (your real Chrome browser) or "headless" (background Puppeteer browser). Which would you like to use?';
    } else {
      message = 'Chrome extension not connected. Using headless mode (background Puppeteer browser).';
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          extensionConnected,
          options,
          currentMode,
          message
        })
      }]
    };
  }
};
