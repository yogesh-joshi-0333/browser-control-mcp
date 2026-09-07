import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { authTool } = await import('../tools/auth.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('sets HTTP Basic Auth credentials for the current page', async () => {
    const authenticate = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { authenticate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await authTool.handler({ sessionId: 'session-abc12345', username: 'admin', password: 'secret' });

    expect(result.isError).toBeFalsy();
    expect(authenticate).toHaveBeenCalledWith({ username: 'admin', password: 'secret' });
  });

  it('clears credentials when clear:true is passed', async () => {
    const authenticate = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { authenticate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await authTool.handler({ sessionId: 'session-abc12345', clear: true });

    expect(result.isError).toBeFalsy();
    expect(authenticate).toHaveBeenCalledWith(null);
  });

  it('requires both username and password unless clearing', async () => {
    const result = await authTool.handler({ sessionId: 'session-abc12345', username: 'admin' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await authTool.handler({ username: 'admin', password: 'secret' });

    expect(result.isError).toBe(true);
  });
});
