import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

interface IFindQuery {
  text?: string;
  role?: string;
  exact: boolean;
  maxResults: number;
}

interface IFindMatch {
  ref: string;
  role: string;
  name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function findElements(query: IFindQuery): IFindMatch[] {
  const win = globalThis as any;
  const doc = win.document;

  const INTERESTING_SELECTOR =
    'a[href], button, input, select, textarea, [role], [onclick], ' +
    'h1, h2, h3, h4, h5, h6, label, img[alt], nav, main, header, footer, [aria-label]';

  function isVisible(el: any): boolean {
    const style = win.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function role(el: any): string {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit' || type === 'button') return 'button';
      return 'textbox';
    }
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'nav') return 'navigation';
    if (tag === 'main') return 'main';
    if (tag === 'header') return 'banner';
    if (tag === 'footer') return 'contentinfo';
    if (tag === 'label') return 'label';
    if (tag === 'img') return 'img';
    return tag;
  }

  function accessibleName(el: any): string {
    const label = el.getAttribute('aria-label');
    if (label) return label.trim();
    if (el.labels && el.labels[0] && el.labels[0].textContent) return el.labels[0].textContent.trim();
    const alt = el.getAttribute('alt');
    if (alt) return alt.trim();
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();
    return (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  const results: IFindMatch[] = [];
  let refCounter = 0;

  for (const el of Array.from(doc.querySelectorAll(INTERESTING_SELECTOR)) as any[]) {
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (!isVisible(el)) continue;

    const elRole = role(el);
    if (query.role && elRole !== query.role) continue;

    const name = accessibleName(el);
    if (query.text) {
      const matches = query.exact ? name === query.text : name.toLowerCase().includes(query.text.toLowerCase());
      if (!matches) continue;
    }

    refCounter++;
    // "f" prefix keeps refs issued by browser_find distinguishable from
    // browser_snapshot's "e" refs, so the two tools' ids can never collide.
    const ref = `f${refCounter}`;
    el.setAttribute('data-mcp-ref', ref);
    results.push({ ref, role: elRole, name });

    if (results.length >= query.maxResults) break;
  }

  return results;
}

export const findTool: ITool = {
  name: 'browser_find',
  options: {
    title: 'Browser Find',
    description:
      'Search for element(s) by visible text and/or ARIA role, without needing a CSS selector or a full browser_snapshot dump. ' +
      'e.g. find({text: "sign in"}) or find({role: "button", text: "submit"}). Matches are tagged with a ref, ' +
      'usable as \'[data-mcp-ref="f1"]\' in browser_click/type/hover/select_option — same mechanism as browser_snapshot, ' +
      'but with an "f" prefix so the two never collide.',
    inputSchema: z.object({
      text: z.string().optional().describe('Substring (case-insensitive by default) to match against the element\'s accessible name/label/text.'),
      role: z.string().optional().describe('Filter by ARIA role, e.g. "button", "link", "textbox", "heading". At least one of text/role is required.'),
      exact: z.boolean().optional().describe('If true, text must match exactly rather than as a substring (default false).'),
      multiple: z.boolean().optional().describe('If true, return all matches instead of stopping at the first (default false).'),
      maxResults: z.number().optional().describe('Cap on results when multiple:true (default 10). Ignored when multiple is false.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { text, role, exact, multiple, maxResults, sessionId, mode } = args as {
      text?: string;
      role?: string;
      exact?: boolean;
      multiple?: boolean;
      maxResults?: number;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!text && !role) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_QUERY', message: 'At least one of text or role is required' }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_find', { mode: modeResult.mode, sessionId: modeResult.sessionId, text, role, multiple });

      const session = getSession(modeResult.sessionId!);
      const matches = await session.page.evaluate(findElements, {
        text,
        role,
        exact: exact ?? false,
        maxResults: multiple ? (maxResults ?? 10) : 1
      });

      return { content: [{ type: 'text', text: JSON.stringify({ matches }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_find failed', { error: String(error) });
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
