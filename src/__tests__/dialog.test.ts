import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { dialogTool } = await import('../tools/dialog.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_handle_dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets up accept handler in headless mode', async () => {
    const mockPage = {
      once: jest.fn()
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await dialogTool.handler({ action: 'accept', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.once).toHaveBeenCalledWith('dialog', expect.any(Function));
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain('accept');
  });

  it('sets up dismiss handler in headless mode', async () => {
    const mockPage = {
      once: jest.fn()
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await dialogTool.handler({ action: 'dismiss', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.once).toHaveBeenCalledWith('dialog', expect.any(Function));
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain('dismiss');
  });

  it('returns error when action is missing', async () => {
    const result = await dialogTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_ACTION');
  });
});
