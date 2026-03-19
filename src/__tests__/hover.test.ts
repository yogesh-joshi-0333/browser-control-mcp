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

const { hoverTool } = await import('../tools/hover.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_hover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hovers element in extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ success: true });

    const result = await hoverTool.handler({ selector: '#menu-trigger' });

    expect(result.isError).toBeFalsy();
    expect(mockSendToExtension).toHaveBeenCalledWith({
      action: 'hover_element',
      payload: { selector: '#menu-trigger' }
    });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('hovers element in headless mode (mouse.move called with center coords)', async () => {
    const mockMouse = {
      move: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    const mockElementHandle = {
      boundingBox: jest.fn<() => Promise<{ x: number; y: number; width: number; height: number }>>()
        .mockResolvedValue({ x: 100, y: 200, width: 50, height: 30 })
    };
    const mockPage = {
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      $: jest.fn<() => Promise<typeof mockElementHandle>>().mockResolvedValue(mockElementHandle),
      mouse: mockMouse
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await hoverTool.handler({ selector: '#menu-trigger', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockMouse.move).toHaveBeenCalledWith(125, 215); // center of bounding box
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('returns error when selector is missing', async () => {
    const result = await hoverTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
  });

  it('returns error for invalid session ID', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await hoverTool.handler({ selector: '#menu-trigger', sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
