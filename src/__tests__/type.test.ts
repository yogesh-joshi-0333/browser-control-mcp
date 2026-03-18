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

const { typeTool } = await import('../tools/type.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_type', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('types text into element in extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ success: true });

    const result = await typeTool.handler({ selector: '#input', text: 'hello' });

    expect(result.isError).toBeFalsy();
    expect(mockSendToExtension).toHaveBeenCalledWith({
      action: 'type_text',
      payload: { selector: '#input', text: 'hello' }
    });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual({ success: true });
  });

  it('types text into element in headless mode', async () => {
    const mockPage = {
      type: jest.fn<(selector: string, text: string) => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await typeTool.handler({ selector: '#input', text: 'hello', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.type).toHaveBeenCalledWith('#input', 'hello');
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual({ success: true });
  });

  it('returns error when selector is missing', async () => {
    const result = await typeTool.handler({ text: 'hello' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
  });

  it('returns error when text is missing', async () => {
    const result = await typeTool.handler({ selector: '#input' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_TEXT');
  });

  it('returns error when extension not connected', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await typeTool.handler({ selector: '#input', text: 'hello' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });
});
