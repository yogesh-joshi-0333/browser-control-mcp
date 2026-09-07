import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { storageTool } = await import('../tools/storage.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

function mockSession(evaluate: jest.Mock) {
  mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });
}

describe('browser_storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('action "get" returns localStorage and sessionStorage as key-value objects', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      localStorage: { token: 'abc' },
      sessionStorage: { draft: 'x' }
    });
    mockSession(evaluate);

    const result = await storageTool.handler({ sessionId: 'session-abc12345', action: 'get' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.localStorage).toEqual({ token: 'abc' });
    expect(parsed.sessionStorage).toEqual({ draft: 'x' });
  });

  it('action "set" writes a key/value pair into the given storage area', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined);
    mockSession(evaluate);

    const result = await storageTool.handler({
      sessionId: 'session-abc12345',
      action: 'set',
      area: 'localStorage',
      key: 'token',
      value: 'xyz'
    });

    expect(result.isError).toBeFalsy();
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), 'localStorage', 'token', 'xyz');
  });

  it('action "set" requires key and value', async () => {
    mockSession(jest.fn());

    const result = await storageTool.handler({ sessionId: 'session-abc12345', action: 'set', key: 'token' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_STORAGE_ENTRY');
  });

  it('action "clear" clears both storage areas by default', async () => {
    const evaluate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined);
    mockSession(evaluate);

    const result = await storageTool.handler({ sessionId: 'session-abc12345', action: 'clear' });

    expect(result.isError).toBeFalsy();
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it('returns an error for an unknown action', async () => {
    mockSession(jest.fn());

    const result = await storageTool.handler({ sessionId: 'session-abc12345', action: 'bogus' });

    expect(result.isError).toBe(true);
  });
});
