import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { extractTool } = await import('../tools/extract.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

function mockSession(evaluate: jest.Mock) {
  mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });
}

describe('browser_extract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('with no selector, returns the page\'s visible text content', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue('Hello world');
    mockSession(evaluate);

    const result = await extractTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.result).toBe('Hello world');
  });

  it('with a selector and no attribute, returns text of the first match', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue('Product Title');
    mockSession(evaluate);

    const result = await extractTool.handler({ sessionId: 'session-abc12345', selector: '.title' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.result).toBe('Product Title');
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), '.title', undefined, false);
  });

  it('with attribute, extracts that attribute instead of text', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue('/product/123');
    mockSession(evaluate);

    const result = await extractTool.handler({ sessionId: 'session-abc12345', selector: 'a.product-link', attribute: 'href' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.result).toBe('/product/123');
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), 'a.product-link', 'href', false);
  });

  it('with multiple:true, returns an array of all matches', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(['a', 'b', 'c']);
    mockSession(evaluate);

    const result = await extractTool.handler({ sessionId: 'session-abc12345', selector: '.item', multiple: true });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.result).toEqual(['a', 'b', 'c']);
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), '.item', undefined, true);
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await extractTool.handler({});

    expect(result.isError).toBe(true);
  });
});
