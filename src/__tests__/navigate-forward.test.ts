import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { navigateForwardTool } = await import('../tools/navigate-forward.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_navigate_forward', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates forward in headless mode', async () => {
    const mockPage = {
      goForward: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      url: jest.fn<() => string>().mockReturnValue('https://example.com/next'),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await navigateForwardTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.goForward).toHaveBeenCalledWith({ waitUntil: 'networkidle2' });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.url).toBe('https://example.com/next');
  });

  it('returns error for invalid session', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await navigateForwardTool.handler({ sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
