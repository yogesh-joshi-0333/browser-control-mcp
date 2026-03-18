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
  getSessionLogs: jest.fn(),
  listSessions: jest.fn().mockReturnValue([]),
  createSession: jest.fn(),
  destroySession: jest.fn(),
  destroyAll: jest.fn()
}));

const { consoleLogsTool } = await import('../tools/console-logs.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSessionLogs } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSessionLogs = getSessionLogs as jest.MockedFunction<typeof getSessionLogs>;

describe('browser_console_logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns console logs from extension mode', async () => {
    const fakeLogs = [{ type: 'log', text: 'hello', timestamp: '2026-03-18T00:00:00.000Z' }];
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ logs: fakeLogs });

    const result = await consoleLogsTool.handler({});

    expect(result.isError).toBeFalsy();
    expect(mockSendToExtension).toHaveBeenCalledWith({ action: 'get_console_logs', payload: {} });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.logs).toEqual(fakeLogs);
  });

  it('returns console logs from headless mode', async () => {
    const fakeLogs = [
      { type: 'log', text: 'hello', timestamp: '2026-03-18T00:00:00.000Z' },
      { type: 'error', text: 'oops', timestamp: '2026-03-18T00:00:01.000Z' }
    ];
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSessionLogs.mockReturnValue(fakeLogs);

    const result = await consoleLogsTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockGetSessionLogs).toHaveBeenCalledWith('session-abc12345');
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.logs).toEqual(fakeLogs);
  });

  it('returns empty logs array when no logs captured', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-empty' });
    mockGetSessionLogs.mockReturnValue([]);

    const result = await consoleLogsTool.handler({ sessionId: 'session-empty' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.logs).toEqual([]);
  });

  it('returns error when extension not connected', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await consoleLogsTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });
});
