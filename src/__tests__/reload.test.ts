import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { reloadTool } = await import('../tools/reload.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_reload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('reloads the page normally by default', async () => {
    const reload = jest.fn<(...a: unknown[]) => Promise<null>>().mockResolvedValue(null);
    const url = jest.fn<() => string>().mockReturnValue('https://example.com');
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { reload, url } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await reloadTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(reload).toHaveBeenCalledWith({ waitUntil: 'networkidle2' });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.url).toBe('https://example.com');
  });

  it('with ignoreCache:true, issues a CDP Page.reload with ignoreCache instead of the plain page.reload()', async () => {
    const reload = jest.fn<(...a: unknown[]) => Promise<null>>().mockResolvedValue(null);
    const url = jest.fn<() => string>().mockReturnValue('https://example.com');
    const cdpSend = jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
    const createCDPSession = jest.fn<() => Promise<{ send: typeof cdpSend }>>().mockResolvedValue({ send: cdpSend });
    const waitForNavigation = jest.fn<(...a: unknown[]) => Promise<null>>().mockResolvedValue(null);
    mockGetSession.mockReturnValue({
      id: 'session-abc12345',
      page: { reload, url, createCDPSession, waitForNavigation } as never,
      browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: []
    });

    await reloadTool.handler({ sessionId: 'session-abc12345', ignoreCache: true });

    expect(cdpSend).toHaveBeenCalledWith('Page.reload', { ignoreCache: true });
    expect(reload).not.toHaveBeenCalled();
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await reloadTool.handler({});

    expect(result.isError).toBe(true);
  });
});
