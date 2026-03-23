import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { scrollTool } = await import('../tools/scroll.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_scroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scrolls page in headless mode', async () => {
    const mockPage = {
      evaluate: jest.fn<() => Promise<{scrollX: number, scrollY: number}>>()
        .mockResolvedValue({ scrollX: 0, scrollY: 500 })
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await scrollTool.handler({ sessionId: 'session-abc12345', x: 0, y: 500 });

    expect(result.isError).toBeFalsy();
    expect(mockPage.evaluate).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.scrollX).toBe(0);
    expect(parsed.scrollY).toBe(500);
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await scrollTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });

  it('returns error for invalid session in headless mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await scrollTool.handler({ sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
