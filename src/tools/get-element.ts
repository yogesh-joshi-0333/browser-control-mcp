import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

const DEFAULT_STYLES = ['display', 'visibility', 'color', 'background-color', 'font-size', 'font-weight'];

/* eslint-disable @typescript-eslint/no-explicit-any */
function describeElement(selector: string, styleProps: string[]) {
  const win = globalThis as any;
  const doc = win.document;
  const el = doc.querySelector(selector);
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  const computed = win.getComputedStyle(el);
  const attributes: Record<string, string> = {};
  for (const attr of el.attributes) attributes[attr.name] = attr.value;
  const styles: Record<string, string> = {};
  for (const prop of styleProps) styles[prop] = computed.getPropertyValue(prop);

  const visible = computed.display !== 'none' && computed.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;

  return {
    tagName: el.tagName,
    attributes,
    boundingBox: rect.width > 0 || rect.height > 0 ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    visible,
    textContent: ((el.textContent as string) || '').trim().slice(0, 500),
    styles
  };
}

export const getElementTool: ITool = {
  name: 'browser_get_element',
  options: {
    title: 'Browser Get Element',
    description:
      'Get full detail on ONE element by selector: tag name, all attributes, bounding box, visibility, text content, ' +
      'and a curated set of computed CSS properties. Complements browser_extract (text/attribute only) and ' +
      'browser_snapshot (a whole page of elements) — use this when you need to inspect a single specific element closely, ' +
      'e.g. checking why something looks wrong, or confirming an element is actually visible/enabled before interacting.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector of the element to inspect. Prefix "pierce/" to reach into shadow DOM.'),
      styles: z.array(z.string()).optional().describe(`Which computed CSS properties to include (default: ${DEFAULT_STYLES.join(', ')}). Pass your own list for anything else, e.g. ["z-index", "opacity"].`),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { selector, styles, sessionId, mode } = args as {
      selector?: string;
      styles?: string[];
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!selector) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_SELECTOR', message: 'selector is required' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_get_element', { mode: modeResult.mode, sessionId: modeResult.sessionId, selector });

      const session = getSession(modeResult.sessionId!);
      const info = await session.page.evaluate(describeElement, selector, styles ?? DEFAULT_STYLES);

      if (info === null) {
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ code: 'SELECTOR_NOT_FOUND', message: `No element matches selector: ${selector}` }) }]
        };
      }

      return { content: [{ type: 'text', text: JSON.stringify(info) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_get_element failed', { error: String(error) });
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
