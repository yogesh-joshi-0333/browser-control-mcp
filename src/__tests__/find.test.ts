import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { findTool } = await import('../tools/find.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_find', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('finds elements by substring text match (case-insensitive, default)', async () => {
    const matches = [{ ref: 'f1', role: 'button', name: 'Sign in' }];
    const evaluate = jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue(matches);
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await findTool.handler({ sessionId: 'session-abc12345', text: 'sign in' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.matches).toEqual(matches);
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), { text: 'sign in', role: undefined, exact: false, maxResults: 1 });
  });

  it('passes multiple:true through as a higher maxResults', async () => {
    const evaluate = jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue([]);
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    await findTool.handler({ sessionId: 'session-abc12345', text: 'item', multiple: true, maxResults: 20 });

    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), { text: 'item', role: undefined, exact: false, maxResults: 20 });
  });

  it('filters by role', async () => {
    const evaluate = jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue([]);
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    await findTool.handler({ sessionId: 'session-abc12345', role: 'button' });

    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), { text: undefined, role: 'button', exact: false, maxResults: 1 });
  });

  it('requires at least text or role', async () => {
    const result = await findTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_QUERY');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await findTool.handler({ text: 'x' });

    expect(result.isError).toBe(true);
  });
});
