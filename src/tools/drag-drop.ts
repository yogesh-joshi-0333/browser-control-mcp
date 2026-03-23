import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const dragDropTool: ITool = {
  name: 'browser_drag_drop',
  options: {
    title: 'Browser Drag & Drop',
    description: 'Drag an element and drop it onto another element. Use for kanban boards, sortable lists, reordering items, or any drag-and-drop interface. Simulates a full human drag: mousedown on source → mousemove to target → mouseup on target, with proper drag events dispatched.',
    inputSchema: z.object({
      sourceSelector: z.string().describe('CSS selector of the element to drag.'),
      targetSelector: z.string().describe('CSS selector of the element to drop onto.'),
      sessionId: z.string().optional().describe('Puppeteer session ID. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { sourceSelector, targetSelector, sessionId, mode } = args as {
      sourceSelector?: string;
      targetSelector?: string;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!sourceSelector) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_SELECTOR', message: 'sourceSelector is required' })
        }]
      };
    }

    if (!targetSelector) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_SELECTOR', message: 'targetSelector is required' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_drag_drop', { mode: modeResult.mode, sessionId: modeResult.sessionId, sourceSelector, targetSelector });

      const session = getSession(modeResult.sessionId!);

      // Wait for both elements to be present and visible
      await session.page.waitForSelector(sourceSelector, { visible: true, timeout: 5000 });
      await session.page.waitForSelector(targetSelector, { visible: true, timeout: 5000 });

      // Get source element bounding box
      const sourceHandle = await session.page.$(sourceSelector);
      if (!sourceHandle) throw new Error(`Element not found: ${sourceSelector}`);
      const sourceBox = await sourceHandle.boundingBox();
      if (!sourceBox) throw new Error(`Element has no visible bounding box: ${sourceSelector}`);

      // Get target element bounding box
      const targetHandle = await session.page.$(targetSelector);
      if (!targetHandle) throw new Error(`Element not found: ${targetSelector}`);
      const targetBox = await targetHandle.boundingBox();
      if (!targetBox) throw new Error(`Element has no visible bounding box: ${targetSelector}`);

      // Compute centers
      const srcX = sourceBox.x + sourceBox.width / 2;
      const srcY = sourceBox.y + sourceBox.height / 2;
      const tgtX = targetBox.x + targetBox.width / 2;
      const tgtY = targetBox.y + targetBox.height / 2;

      // Perform drag sequence
      await session.page.mouse.move(srcX, srcY);
      await session.page.mouse.down();

      // Move in steps to trigger dragover events
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        await session.page.mouse.move(
          srcX + (tgtX - srcX) * (i / steps),
          srcY + (tgtY - srcY) * (i / steps)
        );
      }

      await session.page.mouse.up();

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_drag_drop failed', { error: String(error) });
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
