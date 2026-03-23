import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { executeTool } = await import('../tools/execute.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes code in headless mode', async () => {
    const mockPage = {
      evaluate: jest.fn<() => Promise<string>>().mockResolvedValue('test result')
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await executeTool.handler({ code: 'return document.title', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.evaluate).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.result).toBe('"test result"');
    expect(parsed.sessionId).toBe('session-abc12345');
  });

  it('returns error when code is missing', async () => {
    const result = await executeTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_CODE');
  });

  it('returns error on execution failure', async () => {
    const mockPage = {
      evaluate: jest.fn<() => Promise<never>>().mockRejectedValue(new Error('Evaluation failed'))
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await executeTool.handler({ code: 'throw new Error("oops")', sessionId: 'session-abc12345' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXECUTION_ERROR');
  });

  it('handles undefined result', async () => {
    const mockPage = {
      evaluate: jest.fn<() => Promise<undefined>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await executeTool.handler({ code: 'console.log("hi")', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.result).toBe('undefined');
  });
});
