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

const { screenshotTool } = await import('../tools/screenshot.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_screenshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns image content from extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ dataUrl: 'data:image/png;base64,abc123' });

    const result = await screenshotTool.handler({});

    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe('image');
    expect((result.content[0] as { data: string }).data).toBe('abc123');
    expect((result.content[0] as { mimeType: string }).mimeType).toBe('image/png');
  });

  it('strips data URL prefix correctly', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ dataUrl: 'data:image/png;base64,XYZ789==' });

    const result = await screenshotTool.handler({});

    expect((result.content[0] as { data: string }).data).toBe('XYZ789==');
  });

  it('returns image content from headless mode', async () => {
    const fakeBuffer = Buffer.from('fake-png-data');
    const mockPage = { screenshot: jest.fn<() => Promise<Buffer>>().mockResolvedValue(fakeBuffer) };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date() });

    const result = await screenshotTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe('image');
    expect((result.content[0] as { data: string }).data).toBe(fakeBuffer.toString('base64'));
  });

  it('returns error when selectMode rejects', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await screenshotTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });

  it('returns error when sendToExtension rejects', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockRejectedValue({ code: 'TIMEOUT_ERROR', message: 'Request timed out' });

    const result = await screenshotTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('TIMEOUT_ERROR');
  });
});
