import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { isDebugChromeRunning } from '../puppeteer-manager.js';
import { getDefaultMode, setDefaultMode } from '../mode-selector.js';
import type { BrowserMode } from '../mode-selector.js';

export const selectModeTool: ITool = {
  name: 'browser_select_mode',
  options: {
    title: 'Select Browser Mode',
    description:
      'Check available browser modes and set the session default. CALL THIS FIRST before using any other browser tool. ' +
      'Two modes: "connect" (connects to user\'s Chrome via debug port) or "headless" (invisible background Puppeteer browser, always available). ' +
      'Call without params to see what is available. Call with mode="headless" or mode="connect" to set the default for all subsequent calls. ' +
      'If only headless is available, it is auto-selected.',
    inputSchema: z.object({
      mode: z.enum(['headless', 'connect']).optional().describe(
        'Set the default browser mode for this session. Omit to just query available options.'
      )
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { mode } = args as { mode?: BrowserMode };
    const connectAvailable = await isDebugChromeRunning();
    const options: BrowserMode[] = connectAvailable
      ? ['headless', 'connect']
      : ['headless'];

    if (mode) {
      if (mode === 'connect' && !connectAvailable) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: JSON.stringify({
              code: 'CONNECT_NOT_AVAILABLE',
              message: 'Chrome debug port not found. Only headless mode is available. To enable connect mode, launch Chrome with --remote-debugging-port=9222'
            })
          }]
        };
      }
      setDefaultMode(mode);
      logger.info('Default browser mode set', { mode });
    }

    const currentMode = getDefaultMode();

    let message: string;
    if (connectAvailable) {
      message = 'Chrome debug port detected (connect mode available). Available modes: "connect" (your running Chrome browser) or "headless" (background Puppeteer browser). Which would you like to use?';
    } else {
      message = 'Chrome debug port not found. Headless mode available. To enable connect mode, launch Chrome with --remote-debugging-port=9222';
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          connectAvailable,
          options,
          currentMode,
          message
        })
      }]
    };
  }
};
