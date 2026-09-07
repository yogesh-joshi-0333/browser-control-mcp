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
/**
 * Formats a single snapshot node as one indented line, e.g.
 * '  - link "Home" [disabled] [ref=e1]'. Shared by formatSnapshot and by
 * browser_snapshot's diff mode, which formats added/removed nodes individually.
 */
export function formatSnapshotLine({ ref, depth, role, name, state }: ISnapshotNode): string {
  const namePart = name ? ` "${name}"` : '';
  const statePart = state.length ? ` [${state.join(', ')}]` : '';
  return `${'  '.repeat(depth)}- ${role}${namePart}${statePart} [ref=${ref}]`;
}

export function formatSnapshot(nodes: ISnapshotNode[], totalInteresting: number): string {
  const lines = nodes.map(formatSnapshotLine);

  if (totalInteresting > nodes.length) {
    const remaining = totalInteresting - nodes.length;
    lines.push(`... ${remaining} more elements not shown (scope with a selector or increase maxNodes)`);
  }

  return lines.join('\n');
}

function snapshotNodeKey(node: ISnapshotNode): string {
  return `${node.depth}|${node.role}|${node.name}|${node.state.join(',')}`;
}

/**
 * Diffs two browser_snapshot node lists by (depth, role, name, state) rather
 * than by ref — refs are reassigned every snapshot call, so comparing by ref
 * would flag every unchanged element as both removed and re-added.
 */
export function diffSnapshotNodes(previous: ISnapshotNode[], current: ISnapshotNode[]): string {
  const previousKeys = new Set(previous.map(snapshotNodeKey));
  const currentKeys = new Set(current.map(snapshotNodeKey));

  const added = current.filter(node => !previousKeys.has(snapshotNodeKey(node)));
  const removed = previous.filter(node => !currentKeys.has(snapshotNodeKey(node)));

  const lines = [
    ...added.map(node => `+ ${formatSnapshotLine(node)}`),
    ...removed.map(node => `- ${formatSnapshotLine(node)}`)
  ];

  return lines.length > 0 ? lines.join('\n') : '(no changes since last snapshot)';
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
