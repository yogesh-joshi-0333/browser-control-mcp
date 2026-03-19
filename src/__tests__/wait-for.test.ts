import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../websocket.js', () => ({
  sendToExtension: jest.fn(),
  getConnectionState: jest.fn().mockReturnValue({ connected: false, socketId: null })
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn(),
  listSessions: jest.fn().mockReturnValue([]),
  createSession: jest.fn(),
  destroySession: jest.fn(),
  destroyAll: jest.fn()
}));

const { waitForTool } = await import('../tools/wait-for.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_wait_for', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for selector in extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ success: true });

    const result = await waitForTool.handler({ selector: '#loading' });

    expect(result.isError).toBeFalsy();
    expect(mockSendToExtension).toHaveBeenCalledWith({
      action: 'wait_for',
      payload: { selector: '#loading', text: undefined, textGone: undefined, timeout: 10000, visible: true }
    });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.waited).toBe('selector');
  });

  it('waits for selector in headless mode', async () => {
    const mockPage = {
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await waitForTool.handler({ selector: '.modal', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('.modal', { visible: true, timeout: 10000 });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.waited).toBe('selector');
  });

  it('waits for text in headless mode', async () => {
    const mockPage = {
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await waitForTool.handler({ text: 'Success!', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 10000 },
      'Success!'
    );
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.waited).toBe('text');
  });

  it('waits for text to disappear in headless mode', async () => {
    const mockPage = {
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await waitForTool.handler({ textGone: 'Loading...', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 10000 },
      'Loading...'
    );
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.waited).toBe('textGone');
  });

  it('returns error when no condition provided', async () => {
    const result = await waitForTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_PARAMS');
  });

  it('returns error on timeout', async () => {
    const mockPage = {
      waitForSelector: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Waiting for selector `.missing` failed: timeout 10000ms exceeded')),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await waitForTool.handler({ selector: '.missing', sessionId: 'session-abc12345' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.message).toContain('timeout');
  });
});
