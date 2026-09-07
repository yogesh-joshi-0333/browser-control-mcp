import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';
import { formatSnapshot, diffSnapshotNodes, type ISnapshotNode } from '../dom-utils.js';

const DEFAULT_MAX_NODES = 300;
const lastSnapshotBySession = new Map<string, ISnapshotNode[]>();

/**
 * Runs in the page context (via page.evaluate). Walks interactive/semantic
 * elements in document order, skips hidden ones, tags each with a stable
 * data-mcp-ref attribute (reusable as a CSS selector by browser_click/type/
 * hover/select_option — no other tool needs to change), and returns a flat
 * list with a depth computed from ancestors that are also in the result set.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function collectSnapshot(maxNodes: number): { nodes: ISnapshotNode[]; totalInteresting: number } {
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

  const candidates = Array.from(doc.querySelectorAll(INTERESTING_SELECTOR)) as any[];
  const included = new Set<any>();
  const nodes: ISnapshotNode[] = [];
  let refCounter = 0;
  let totalInteresting = 0;

  for (const el of candidates) {
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (!isVisible(el)) continue;
    totalInteresting++;
    if (nodes.length >= maxNodes) continue;

    refCounter++;
    const ref = `e${refCounter}`;
    el.setAttribute('data-mcp-ref', ref);
    included.add(el);

    let depth = 0;
    let parent = el.parentElement;
    while (parent) {
      if (included.has(parent)) depth++;
      parent = parent.parentElement;
    }

    const state: string[] = [];
    if (el.disabled) state.push('disabled');
    if (el.checked) state.push('checked');
    const tag = el.tagName.toLowerCase();
    if ((tag === 'input' || tag === 'textarea') && el.value) {
      state.push(`value="${String(el.value).slice(0, 40)}"`);
    }

    nodes.push({ ref, depth, role: role(el), name: accessibleName(el), state });
  }

  return { nodes, totalInteresting };
}

export const snapshotTool: ITool = {
  name: 'browser_snapshot',
  options: {
    title: 'Browser Accessibility Snapshot',
    description:
      'Get a compact accessibility-tree view of the page: interactive and semantic elements (links, buttons, inputs, headings, landmarks) as a small indented text list, each tagged with a stable ref like [ref=e12]. ' +
      'Far cheaper than browser_get_dom for finding what to interact with — use this first when exploring an unfamiliar page. ' +
      'Every ref is also a valid CSS selector — pass `[data-mcp-ref="e12"]` directly as the `selector` argument to browser_click, browser_type, browser_hover, or browser_select_option. ' +
      'Pass diff:true to get only what changed since your last browser_snapshot call in this session — much cheaper than a full snapshot for checking the result of a click/type.',
    inputSchema: z.object({
      maxNodes: z.number().optional().describe(`Maximum number of elements to include (default ${DEFAULT_MAX_NODES}). Lower it for a shorter list, raise it for exhaustive coverage of a large page.`),
      diff: z.boolean().optional().describe('If true, return only elements added/removed since the last browser_snapshot call for this session, instead of the full tree. First call always returns the full snapshot.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { maxNodes, diff, sessionId, mode } = args as { maxNodes?: number; diff?: boolean; sessionId?: string; mode?: 'headless' | 'connect' };
    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_snapshot', { mode: modeResult.mode, sessionId: modeResult.sessionId, maxNodes, diff });

      const session = getSession(modeResult.sessionId!);
      const { nodes, totalInteresting } = await session.page.evaluate(collectSnapshot, maxNodes ?? DEFAULT_MAX_NODES);

      let snapshot: string;
      if (diff) {
        const previous = lastSnapshotBySession.get(modeResult.sessionId!);
        snapshot = previous ? diffSnapshotNodes(previous, nodes) : formatSnapshot(nodes, totalInteresting);
      } else {
        snapshot = formatSnapshot(nodes, totalInteresting);
      }
      lastSnapshotBySession.set(modeResult.sessionId!, nodes);

      return {
        content: [{ type: 'text', text: JSON.stringify({ snapshot }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_snapshot failed', { error: String(error) });
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
