import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { statsTool } = await import('../tools/stats.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports url, title, dom node count, and approx HTML/text sizes', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      url: 'https://example.com/',
      title: 'Example',
      domNodeCount: 42,
      approxHtmlLength: 61468,
      approxTextLength: 120
    });
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await statsTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual({
      url: 'https://example.com/',
      title: 'Example',
      domNodeCount: 42,
      approxHtmlLength: 61468,
      approxTextLength: 120
    });
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await statsTool.handler({});

    expect(result.isError).toBe(true);
  });

  it('returns error for invalid session', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await statsTool.handler({ sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
