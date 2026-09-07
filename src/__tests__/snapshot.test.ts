import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { snapshotTool } = await import('../tools/snapshot.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a formatted accessibility-tree snapshot from headless mode', async () => {
    const mockPage = {
      evaluate: jest.fn<(...args: unknown[]) => Promise<{ nodes: unknown[]; totalInteresting: number }>>().mockResolvedValue({
        nodes: [{ ref: 'e1', depth: 0, role: 'button', name: 'Submit', state: [] }],
        totalInteresting: 1
      })
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await snapshotTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.snapshot).toBe('- button "Submit" [ref=e1]');
  });

  it('passes a maxNodes cap through to the page evaluation', async () => {
    const mockPage = {
      evaluate: jest.fn<(...args: unknown[]) => Promise<{ nodes: unknown[]; totalInteresting: number }>>().mockResolvedValue({
        nodes: [],
        totalInteresting: 0
      })
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await snapshotTool.handler({ sessionId: 'session-abc12345', maxNodes: 50 });

    expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 50);
  });

  it('defaults maxNodes to 300 when not provided', async () => {
    const mockPage = {
      evaluate: jest.fn<(...args: unknown[]) => Promise<{ nodes: unknown[]; totalInteresting: number }>>().mockResolvedValue({
        nodes: [],
        totalInteresting: 0
      })
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await snapshotTool.handler({ sessionId: 'session-abc12345' });

    expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 300);
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await snapshotTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });

  it('returns error for invalid session', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await snapshotTool.handler({ sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
