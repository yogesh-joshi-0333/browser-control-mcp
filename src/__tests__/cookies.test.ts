import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { cookiesTool } = await import('../tools/cookies.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

function mockSession(page: Record<string, unknown>) {
  mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });
}

describe('browser_cookies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('action "get" returns all cookies for the current page', async () => {
    const cookies = [{ name: 'session', value: 'abc123', domain: 'example.com' }];
    mockSession({ cookies: jest.fn<() => Promise<unknown[]>>().mockResolvedValue(cookies) });

    const result = await cookiesTool.handler({ sessionId: 'session-abc12345', action: 'get' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.cookies).toEqual(cookies);
  });

  it('action "set" writes the given cookie', async () => {
    const setCookie = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
    mockSession({ setCookie });

    const result = await cookiesTool.handler({
      sessionId: 'session-abc12345',
      action: 'set',
      name: 'token',
      value: 'xyz',
      domain: 'example.com'
    });

    expect(result.isError).toBeFalsy();
    expect(setCookie).toHaveBeenCalledWith({ name: 'token', value: 'xyz', domain: 'example.com' });
  });

  it('action "set" requires name and value', async () => {
    mockSession({ setCookie: jest.fn() });

    const result = await cookiesTool.handler({ sessionId: 'session-abc12345', action: 'set', name: 'token' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_COOKIE');
  });

  it('action "delete" removes the named cookie', async () => {
    const deleteCookie = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
    mockSession({ deleteCookie });

    const result = await cookiesTool.handler({ sessionId: 'session-abc12345', action: 'delete', name: 'token' });

    expect(result.isError).toBeFalsy();
    expect(deleteCookie).toHaveBeenCalledWith({ name: 'token' });
  });

  it('action "clear" deletes every cookie currently on the page', async () => {
    const cookies = [{ name: 'a', value: '1' }, { name: 'b', value: '2' }];
    const deleteCookie = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
    mockSession({
      cookies: jest.fn<() => Promise<unknown[]>>().mockResolvedValue(cookies),
      deleteCookie
    });

    const result = await cookiesTool.handler({ sessionId: 'session-abc12345', action: 'clear' });

    expect(result.isError).toBeFalsy();
    expect(deleteCookie).toHaveBeenCalledWith(...cookies);
  });

  it('returns an error for an unknown action', async () => {
    mockSession({});

    const result = await cookiesTool.handler({ sessionId: 'session-abc12345', action: 'bogus' });

    expect(result.isError).toBe(true);
  });
});
