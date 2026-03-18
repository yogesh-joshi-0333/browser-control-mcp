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

const { getDomTool } = await import('../tools/get-dom.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_get_dom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns DOM from extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ dom: '<html><body>hello</body></html>' });

    const result = await getDomTool.handler({});

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.dom).toBe('<html><body>hello</body></html>');
  });

  it('returns DOM from headless mode', async () => {
    const mockPage = {
      content: jest.fn<() => Promise<string>>().mockResolvedValue('<html><body>test</body></html>')
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await getDomTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.dom).toBe('<html><body>test</body></html>');
  });

  it('returns error when extension not connected', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await getDomTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });

  it('returns error for invalid session in headless mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await getDomTool.handler({ sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
