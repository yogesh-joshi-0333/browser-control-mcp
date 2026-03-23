import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  isDebugChromeRunning: jest.fn<() => Promise<boolean>>()
}));
jest.unstable_mockModule('../mode-selector.js', () => ({
  getDefaultMode: jest.fn(),
  setDefaultMode: jest.fn()
}));

const { selectModeTool } = await import('../tools/select-mode.js');
const { isDebugChromeRunning } = await import('../puppeteer-manager.js');
const { getDefaultMode, setDefaultMode } = await import('../mode-selector.js');

const mockIsDebugChromeRunning = isDebugChromeRunning as jest.MockedFunction<typeof isDebugChromeRunning>;
const mockGetDefaultMode = getDefaultMode as jest.MockedFunction<typeof getDefaultMode>;
const mockSetDefaultMode = setDefaultMode as jest.MockedFunction<typeof setDefaultMode>;

describe('browser_select_mode tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct tool name', () => {
    expect(selectModeTool.name).toBe('browser_select_mode');
  });

  it('returns both options when connect is available', async () => {
    mockIsDebugChromeRunning.mockResolvedValue(true);
    mockGetDefaultMode.mockReturnValue(null);

    const result = await selectModeTool.handler({});
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(data.connectAvailable).toBe(true);
    expect(data.options).toEqual(['headless', 'connect']);
    expect(data.currentMode).toBeNull();
    expect(data.message).toContain('Chrome debug port detected');
  });

  it('returns only headless when connect is not available', async () => {
    mockIsDebugChromeRunning.mockResolvedValue(false);
    mockGetDefaultMode.mockReturnValue(null);

    const result = await selectModeTool.handler({});
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(data.connectAvailable).toBe(false);
    expect(data.options).toEqual(['headless']);
    expect(data.message).toContain('Headless mode available');
  });

  it('sets default mode when mode param provided', async () => {
    mockIsDebugChromeRunning.mockResolvedValue(true);
    mockGetDefaultMode.mockReturnValue('connect');

    const result = await selectModeTool.handler({ mode: 'connect' });
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(mockSetDefaultMode).toHaveBeenCalledWith('connect');
    expect(data.currentMode).toBe('connect');
  });

  it('rejects connect mode when connect not available', async () => {
    mockIsDebugChromeRunning.mockResolvedValue(false);
    mockGetDefaultMode.mockReturnValue(null);

    const result = await selectModeTool.handler({ mode: 'connect' });
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('CONNECT_NOT_AVAILABLE');
    expect(mockSetDefaultMode).not.toHaveBeenCalled();
  });

  it('allows headless mode when connect not available', async () => {
    mockIsDebugChromeRunning.mockResolvedValue(false);
    mockGetDefaultMode.mockReturnValue('headless');

    const result = await selectModeTool.handler({ mode: 'headless' });

    expect(result.isError).toBeUndefined();
    expect(mockSetDefaultMode).toHaveBeenCalledWith('headless');
  });

  it('returns current mode when already set', async () => {
    mockIsDebugChromeRunning.mockResolvedValue(true);
    mockGetDefaultMode.mockReturnValue('headless');

    const result = await selectModeTool.handler({});
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(data.currentMode).toBe('headless');
  });
});
