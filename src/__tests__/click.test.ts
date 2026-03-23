import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { clickTool } = await import('../tools/click.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_click', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clicks element in headless mode with humanClick (default)', async () => {
    const mockMouse = {
      move: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    const mockElementHandle = {
      boundingBox: jest.fn<() => Promise<{ x: number; y: number; width: number; height: number }>>()
        .mockResolvedValue({ x: 100, y: 200, width: 50, height: 30 })
    };
    const mockPage = {
      click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      evaluate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      $: jest.fn<() => Promise<typeof mockElementHandle>>().mockResolvedValue(mockElementHandle),
      mouse: mockMouse
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await clickTool.handler({ selector: '#btn', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockMouse.move).toHaveBeenCalledWith(125, 215); // center of bounding box
    expect(mockMouse.click).toHaveBeenCalledWith(125, 215);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('clicks element in headless mode with humanClick=false', async () => {
    const mockPage = {
      click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      evaluate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await clickTool.handler({ selector: '#btn', sessionId: 'session-abc12345', humanClick: false });

    expect(result.isError).toBeFalsy();
    expect(mockPage.evaluate).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('returns error when selector is missing', async () => {
    const result = await clickTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await clickTool.handler({ selector: '#btn' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });

  it('returns error for invalid session ID', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await clickTool.handler({ selector: '#btn', sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
