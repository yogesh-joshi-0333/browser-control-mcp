import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { navigateTool } = await import('../tools/navigate.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_navigate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates in headless mode using page.goto', async () => {
    const mockPage = {
      goto: jest.fn<() => Promise<null>>().mockResolvedValue(null),
      url: jest.fn<() => string>().mockReturnValue('https://example.com'),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await navigateTool.handler({ url: 'https://example.com', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'networkidle2' });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.url).toBe('https://example.com');
  });

  it('returns error when url is missing', async () => {
    const result = await navigateTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_URL');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await navigateTool.handler({ url: 'https://example.com' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });

  it('returns error for invalid session ID in headless mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await navigateTool.handler({ url: 'https://example.com', sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
