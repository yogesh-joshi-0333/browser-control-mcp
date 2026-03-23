import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const keyboardTool: ITool = {
  name: 'browser_keyboard',
  options: {
    title: 'Browser Keyboard',
    description: 'Press keyboard keys like Enter, Tab, Escape, arrow keys, or key combinations with Ctrl/Shift/Alt modifiers. Use to: submit forms (Enter), navigate between fields (Tab), close modals (Escape), select all text (Ctrl+A), copy/paste, or navigate autocomplete menus (ArrowDown/ArrowUp). If selector is provided, focuses that element first.',
    inputSchema: z.object({
      key: z.string().describe('Key to press. Examples: "Enter", "Tab", "Escape", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Backspace", "Delete", "Space", "a", "1", etc.'),
      modifiers: z.array(z.enum(['Control', 'Shift', 'Alt', 'Meta'])).optional().describe('Modifier keys to hold. Examples: ["Control", "a"] for select-all, ["Control", "c"] for copy.'),
      selector: z.string().optional().describe('CSS selector to focus before pressing key. If omitted, key is sent to currently focused element.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { key, modifiers, selector, sessionId, mode } = args as {
      key?: string;
      modifiers?: ('Control' | 'Shift' | 'Alt' | 'Meta')[];
      selector?: string;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!key) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_KEY', message: 'key is required' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_keyboard', { mode: modeResult.mode, sessionId: modeResult.sessionId, key, modifiers, selector });

      const session = getSession(modeResult.sessionId!);

      // If selector provided, focus that element first
      if (selector) {
        await session.page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await session.page.focus(selector);
      }

      if (modifiers && modifiers.length > 0) {
        // Hold down each modifier
        for (const mod of modifiers) {
          await session.page.keyboard.down(mod as import('puppeteer-core').KeyInput);
        }
        // Press the key
        await session.page.keyboard.press(key as import('puppeteer-core').KeyInput);
        // Release modifiers in reverse order
        for (const mod of [...modifiers].reverse()) {
          await session.page.keyboard.up(mod as import('puppeteer-core').KeyInput);
        }
      } else {
        await session.page.keyboard.press(key as import('puppeteer-core').KeyInput);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_keyboard failed', { error: String(error) });
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
