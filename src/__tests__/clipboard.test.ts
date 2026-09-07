import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { clipboardTool } = await import('../tools/clipboard.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

function makeMockPage() {
  const cdpSend = jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
  return {
    url: jest.fn<() => string>().mockReturnValue('https://example.com'),
    bringToFront: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    evaluate: jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
    createCDPSession: jest.fn<() => Promise<{ send: typeof cdpSend }>>().mockResolvedValue({ send: cdpSend })
  };
}

describe('browser_clipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('action "write" grants clipboard permissions automatically, then writes the text', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await clipboardTool.handler({ sessionId: 'session-abc12345', action: 'write', text: 'hello clipboard' });

    expect(result.isError).toBeFalsy();
    const cdpSession = await page.createCDPSession();
    expect(cdpSession.send).toHaveBeenCalledWith('Browser.grantPermissions', {
      origin: 'https://example.com',
      permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite']
    });
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), 'hello clipboard');
    expect(page.bringToFront).toHaveBeenCalled();
  });

  it('action "write" requires text', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await clipboardTool.handler({ sessionId: 'session-abc12345', action: 'write' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_TEXT');
  });

  it('action "read" grants permissions, focuses the page, and returns clipboard contents', async () => {
    const page = makeMockPage();
    page.evaluate.mockResolvedValue('clipboard contents');
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await clipboardTool.handler({ sessionId: 'session-abc12345', action: 'read' });

    expect(result.isError).toBeFalsy();
    expect(page.bringToFront).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.text).toBe('clipboard contents');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await clipboardTool.handler({ action: 'read' });

    expect(result.isError).toBe(true);
  });
});
