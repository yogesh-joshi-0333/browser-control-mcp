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

const { dragDropTool } = await import('../tools/drag-drop.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_drag_drop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drags in extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ success: true });

    const result = await dragDropTool.handler({ sourceSelector: '#card-1', targetSelector: '#column-2' });

    expect(result.isError).toBeFalsy();
    expect(mockSendToExtension).toHaveBeenCalledWith({
      action: 'drag_drop',
      payload: { sourceSelector: '#card-1', targetSelector: '#column-2' }
    });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('drags in headless mode', async () => {
    const mockMouse = {
      move: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      down: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      up: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    const mockSourceHandle = {
      boundingBox: jest.fn<() => Promise<{ x: number; y: number; width: number; height: number }>>()
        .mockResolvedValue({ x: 100, y: 100, width: 50, height: 50 })
    };
    const mockTargetHandle = {
      boundingBox: jest.fn<() => Promise<{ x: number; y: number; width: number; height: number }>>()
        .mockResolvedValue({ x: 400, y: 300, width: 50, height: 50 })
    };
    const mockPage = {
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      $: jest.fn<() => Promise<typeof mockSourceHandle | typeof mockTargetHandle>>()
        .mockResolvedValueOnce(mockSourceHandle)
        .mockResolvedValueOnce(mockTargetHandle),
      mouse: mockMouse
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await dragDropTool.handler({ sourceSelector: '#card-1', targetSelector: '#column-2', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    // Initial move to source center (125, 125)
    expect(mockMouse.move).toHaveBeenCalledWith(125, 125);
    expect(mockMouse.down).toHaveBeenCalled();
    // 10 intermediate steps + 1 initial move = 11 total move calls
    expect(mockMouse.move).toHaveBeenCalledTimes(11);
    // Final move should land at target center (425, 325)
    expect(mockMouse.move).toHaveBeenLastCalledWith(425, 325);
    expect(mockMouse.up).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('returns error when sourceSelector is missing', async () => {
    const result = await dragDropTool.handler({ targetSelector: '#column-2' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
    expect(parsed.message).toBe('sourceSelector is required');
  });

  it('returns error when targetSelector is missing', async () => {
    const result = await dragDropTool.handler({ sourceSelector: '#card-1' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
    expect(parsed.message).toBe('targetSelector is required');
  });
});
