import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { formFillTool } = await import('../tools/form.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

function makeMockPage(tagName: string) {
  return {
    waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    type: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    select: jest.fn<(...a: unknown[]) => Promise<string[]>>().mockResolvedValue([]),
    evaluate: jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue({ tagName, type: 'text', checked: false }),
    click: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
  };
}

describe('browser_form_fill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('types into a plain text input', async () => {
    const page = makeMockPage('INPUT');
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await formFillTool.handler({ sessionId: 'session-abc12345', fields: { '#email': 'user@example.com' } });

    expect(result.isError).toBeFalsy();
    expect(page.type).toHaveBeenCalledWith('#email', 'user@example.com');
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.filled).toEqual(['#email']);
  });

  it('uses select() for a <select> element', async () => {
    const page = makeMockPage('SELECT');
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    await formFillTool.handler({ sessionId: 'session-abc12345', fields: { '#country': 'IN' } });

    expect(page.select).toHaveBeenCalledWith('#country', 'IN');
    expect(page.type).not.toHaveBeenCalled();
  });

  it('requires a non-empty fields object', async () => {
    const result = await formFillTool.handler({ sessionId: 'session-abc12345', fields: {} });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_FIELDS');
  });

  it('clicks submitSelector after filling all fields, when provided', async () => {
    const page = makeMockPage('INPUT');
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    await formFillTool.handler({ sessionId: 'session-abc12345', fields: { '#email': 'a@b.com' }, submitSelector: '#submit-btn' });

    expect(page.click).toHaveBeenCalledWith('#submit-btn');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await formFillTool.handler({ fields: { '#a': 'b' } });

    expect(result.isError).toBe(true);
  });
});
