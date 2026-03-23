import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { keyboardTool } = await import('../tools/keyboard.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_keyboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('presses key in headless mode', async () => {
    const mockKeyboard = {
      press: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      down: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      up: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    const mockPage = {
      keyboard: mockKeyboard,
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      focus: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await keyboardTool.handler({ key: 'Enter', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockKeyboard.press).toHaveBeenCalledWith('Enter');
    expect(mockKeyboard.down).not.toHaveBeenCalled();
    expect(mockKeyboard.up).not.toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('presses key with modifier in headless mode', async () => {
    const mockKeyboard = {
      press: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      down: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      up: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    const mockPage = {
      keyboard: mockKeyboard,
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      focus: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await keyboardTool.handler({ key: 'a', modifiers: ['Control'], sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockKeyboard.down).toHaveBeenCalledWith('Control');
    expect(mockKeyboard.press).toHaveBeenCalledWith('a');
    expect(mockKeyboard.up).toHaveBeenCalledWith('Control');
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('focuses element before pressing key', async () => {
    const mockKeyboard = {
      press: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      down: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      up: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    const mockPage = {
      keyboard: mockKeyboard,
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      focus: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await keyboardTool.handler({ key: 'Tab', selector: '#input-field', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#input-field', { visible: true, timeout: 5000 });
    expect(mockPage.focus).toHaveBeenCalledWith('#input-field');
    expect(mockKeyboard.press).toHaveBeenCalledWith('Tab');
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it('returns error when key is missing', async () => {
    const result = await keyboardTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_KEY');
  });
});
