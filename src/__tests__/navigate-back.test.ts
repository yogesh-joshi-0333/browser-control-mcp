import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { navigateBackTool } = await import('../tools/navigate-back.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_navigate_back', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates back in headless mode', async () => {
    const mockPage = {
      goBack: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      url: jest.fn<() => string>().mockReturnValue('https://example.com'),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await navigateBackTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.goBack).toHaveBeenCalledWith({ waitUntil: 'networkidle2' });
    expect(mockPage.url).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.sessionId).toBe('session-abc12345');
  });

  it('returns error for invalid session', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await navigateBackTool.handler({ sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.message).toBe('SESSION_NOT_FOUND');
  });
});
