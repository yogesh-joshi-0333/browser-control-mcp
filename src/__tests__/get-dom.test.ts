import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { getDomTool } = await import('../tools/get-dom.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_get_dom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns DOM from headless mode', async () => {
    const mockPage = {
      content: jest.fn<() => Promise<string>>().mockResolvedValue('<html><body>test</body></html>')
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await getDomTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.dom).toBe('<html><body>test</body></html>');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await getDomTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });

  it('returns error for invalid session in headless mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await getDomTool.handler({ sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });

  it('scopes to a selector when provided, returning only that subtree\'s outerHTML', async () => {
    const mockPage = {
      content: jest.fn<() => Promise<string>>().mockResolvedValue('<html><body><div id="a">full</div></body></html>'),
      evaluate: jest.fn<(...args: unknown[]) => Promise<string | null>>().mockResolvedValue('<div id="a">scoped</div>')
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await getDomTool.handler({ sessionId: 'session-abc12345', selector: '#a' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.dom).toBe('<div id="a">scoped</div>');
    expect(mockPage.content).not.toHaveBeenCalled();
  });

  it('returns an error when the scoping selector matches nothing', async () => {
    const mockPage = {
      content: jest.fn<() => Promise<string>>(),
      evaluate: jest.fn<(...args: unknown[]) => Promise<string | null>>().mockResolvedValue(null)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await getDomTool.handler({ sessionId: 'session-abc12345', selector: '#missing' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('SELECTOR_NOT_FOUND');
  });

  it('returns text content (tags stripped) when format is "text"', async () => {
    const mockPage = {
      content: jest.fn<() => Promise<string>>().mockResolvedValue('<html><body><p>Hello <b>world</b></p></body></html>')
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await getDomTool.handler({ sessionId: 'session-abc12345', format: 'text' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.dom).toBe('Hello world');
  });

  it('truncates and flags truncated:true when content exceeds maxLength', async () => {
    const longHtml = '<html><body>' + 'x'.repeat(100) + '</body></html>';
    const mockPage = {
      content: jest.fn<() => Promise<string>>().mockResolvedValue(longHtml)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await getDomTool.handler({ sessionId: 'session-abc12345', maxLength: 20 });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.dom).toHaveLength(20);
    expect(parsed.truncated).toBe(true);
    expect(parsed.totalLength).toBe(longHtml.length);
  });

  it('does not set truncated when maxLength is not provided (default unlimited, backward compatible)', async () => {
    const longHtml = '<html><body>' + 'x'.repeat(100) + '</body></html>';
    const mockPage = {
      content: jest.fn<() => Promise<string>>().mockResolvedValue(longHtml)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await getDomTool.handler({ sessionId: 'session-abc12345' });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.dom).toBe(longHtml);
    expect(parsed.truncated).toBeUndefined();
  });
});
