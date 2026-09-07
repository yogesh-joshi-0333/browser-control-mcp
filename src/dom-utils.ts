const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
};

/**
 * Strips HTML markup (including script/style contents) and decodes common
 * entities, returning collapsed plain text. Used for browser_get_dom's
 * format:"text" mode.
 */
export function stripTags(html: string): string {
  const withoutScriptsAndStyles = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  const withoutTags = withoutScriptsAndStyles.replace(/<[^>]*>/g, ' ');
  const decoded = withoutTags.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity: string) => HTML_ENTITIES[entity] ?? '');
  return decoded.replace(/\s+/g, ' ').trim();
}

export interface ISnapshotNode {
  ref: string;
  depth: number;
  role: string;
  name: string;
  state: string[];
}

/**
 * Renders accessibility-snapshot nodes (collected in-page by browser_snapshot)
 * as an indented text tree, e.g. "- button \"Submit\" [ref=e3]". Appends a
 * truncation note when fewer nodes were returned than were found on the page.
 */
export function formatSnapshot(nodes: ISnapshotNode[], totalInteresting: number): string {
  const lines = nodes.map(({ ref, depth, role, name, state }) => {
    const namePart = name ? ` "${name}"` : '';
    const statePart = state.length ? ` [${state.join(', ')}]` : '';
    return `${'  '.repeat(depth)}- ${role}${namePart}${statePart} [ref=${ref}]`;
  });

  if (totalInteresting > nodes.length) {
    const remaining = totalInteresting - nodes.length;
    lines.push(`... ${remaining} more elements not shown (scope with a selector or increase maxNodes)`);
  }

  return lines.join('\n');
}

/**
 * Waits until the DOM stops mutating for 300ms, or 3s max.
 * Catches JS init, deferred renders, post-load animations, and AJAX updates.
 */
export async function waitForDomStable(page: { waitForFunction: (fn: string, opts: Record<string, unknown>) => Promise<unknown> }): Promise<void> {
  await page.waitForFunction(`
    new Promise(resolve => {
      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => { observer.disconnect(); resolve(true); }, 300);
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      setTimeout(() => { observer.disconnect(); resolve(true); }, 3000);
    })
  `, { timeout: 5000 });
}
