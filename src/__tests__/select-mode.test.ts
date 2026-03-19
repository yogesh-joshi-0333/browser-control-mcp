import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../websocket.js', () => ({
  getConnectionState: jest.fn()
}));
jest.unstable_mockModule('../mode-selector.js', () => ({
  getDefaultMode: jest.fn(),
  setDefaultMode: jest.fn()
}));

const { selectModeTool } = await import('../tools/select-mode.js');
const { getConnectionState } = await import('../websocket.js');
const { getDefaultMode, setDefaultMode } = await import('../mode-selector.js');

const mockGetConnectionState = getConnectionState as jest.MockedFunction<typeof getConnectionState>;
const mockGetDefaultMode = getDefaultMode as jest.MockedFunction<typeof getDefaultMode>;
const mockSetDefaultMode = setDefaultMode as jest.MockedFunction<typeof setDefaultMode>;

describe('browser_select_mode tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct tool name', () => {
    expect(selectModeTool.name).toBe('browser_select_mode');
  });

  it('returns both options when extension is connected', async () => {
    mockGetConnectionState.mockReturnValue({ connected: true, socketId: 'abc' });
    mockGetDefaultMode.mockReturnValue(null);

    const result = await selectModeTool.handler({});
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(data.extensionConnected).toBe(true);
    expect(data.options).toEqual(['extension', 'headless']);
    expect(data.currentMode).toBeNull();
    expect(data.message).toContain('Chrome browser extension detected');
  });

  it('returns only headless when extension is not connected', async () => {
    mockGetConnectionState.mockReturnValue({ connected: false, socketId: null });
    mockGetDefaultMode.mockReturnValue(null);

    const result = await selectModeTool.handler({});
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(data.extensionConnected).toBe(false);
    expect(data.options).toEqual(['headless']);
    expect(data.message).toContain('headless mode');
  });

  it('sets default mode when mode param provided', async () => {
    mockGetConnectionState.mockReturnValue({ connected: true, socketId: 'abc' });
    mockGetDefaultMode.mockReturnValue('extension');

    const result = await selectModeTool.handler({ mode: 'extension' });
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(mockSetDefaultMode).toHaveBeenCalledWith('extension');
    expect(data.currentMode).toBe('extension');
  });

  it('rejects extension mode when extension not connected', async () => {
    mockGetConnectionState.mockReturnValue({ connected: false, socketId: null });
    mockGetDefaultMode.mockReturnValue(null);

    const result = await selectModeTool.handler({ mode: 'extension' });
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('EXTENSION_NOT_AVAILABLE');
    expect(mockSetDefaultMode).not.toHaveBeenCalled();
  });

  it('allows headless mode when extension not connected', async () => {
    mockGetConnectionState.mockReturnValue({ connected: false, socketId: null });
    mockGetDefaultMode.mockReturnValue('headless');

    const result = await selectModeTool.handler({ mode: 'headless' });

    expect(result.isError).toBeUndefined();
    expect(mockSetDefaultMode).toHaveBeenCalledWith('headless');
  });

  it('returns current mode when already set', async () => {
    mockGetConnectionState.mockReturnValue({ connected: true, socketId: 'abc' });
    mockGetDefaultMode.mockReturnValue('headless');

    const result = await selectModeTool.handler({});
    const data = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);

    expect(data.currentMode).toBe('headless');
  });
});
