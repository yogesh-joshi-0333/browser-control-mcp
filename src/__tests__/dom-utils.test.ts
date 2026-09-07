import { describe, it, expect } from '@jest/globals';
import { stripTags, formatSnapshot, type ISnapshotNode } from '../dom-utils.js';

describe('stripTags', () => {
  it('removes tags and collapses whitespace between words', () => {
    expect(stripTags('<html><body><p>Hello <b>world</b></p></body></html>')).toBe('Hello world');
  });

  it('drops script and style content entirely, not just their tags', () => {
    expect(stripTags('<p>Keep</p><script>var x=1;</script><style>.a{color:red}</style>')).toBe('Keep');
  });

  it('decodes common HTML entities', () => {
    expect(stripTags('<p>Tom &amp; Jerry &lt;3&gt;</p>')).toBe('Tom & Jerry <3>');
  });

  it('returns empty string for empty input', () => {
    expect(stripTags('')).toBe('');
  });
});

describe('formatSnapshot', () => {
  it('formats a single node with its role, name, and ref', () => {
    const nodes: ISnapshotNode[] = [{ ref: 'e1', depth: 0, role: 'button', name: 'Submit', state: [] }];
    expect(formatSnapshot(nodes, 1)).toBe('- button "Submit" [ref=e1]');
  });

  it('indents nested nodes by depth', () => {
    const nodes: ISnapshotNode[] = [
      { ref: 'e1', depth: 0, role: 'navigation', name: '', state: [] },
      { ref: 'e2', depth: 1, role: 'link', name: 'Home', state: [] }
    ];
    expect(formatSnapshot(nodes, 2)).toBe('- navigation [ref=e1]\n  - link "Home" [ref=e2]');
  });

  it('appends bracketed state annotations when present', () => {
    const nodes: ISnapshotNode[] = [{ ref: 'e1', depth: 0, role: 'checkbox', name: 'Agree', state: ['checked', 'disabled'] }];
    expect(formatSnapshot(nodes, 1)).toBe('- checkbox "Agree" [checked, disabled] [ref=e1]');
  });

  it('omits the name segment when name is empty', () => {
    const nodes: ISnapshotNode[] = [{ ref: 'e1', depth: 0, role: 'navigation', name: '', state: [] }];
    expect(formatSnapshot(nodes, 1)).toBe('- navigation [ref=e1]');
  });

  it('appends a truncation note when totalInteresting exceeds nodes returned', () => {
    const nodes: ISnapshotNode[] = [{ ref: 'e1', depth: 0, role: 'button', name: 'A', state: [] }];
    const result = formatSnapshot(nodes, 5);
    expect(result).toBe('- button "A" [ref=e1]\n... 4 more elements not shown (scope with a selector or increase maxNodes)');
  });

  it('adds no truncation note when nodes returned equals total', () => {
    const nodes: ISnapshotNode[] = [{ ref: 'e1', depth: 0, role: 'button', name: 'A', state: [] }];
    expect(formatSnapshot(nodes, 1)).not.toContain('more elements');
  });
});
