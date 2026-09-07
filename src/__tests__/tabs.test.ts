import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn(),
  setSessionPage: jest.fn()
}));

const { tabsTool } = await import('../tools/tabs.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('action "screenshot" captures a specific tab by index without switching the active tab', async () => {
    const fakeBuffer = Buffer.from('fake-png-data');
    const mockPage0 = { screenshot: jest.fn() };
    const mockPage1 = { screenshot: jest.fn<() => Promise<Buffer>>().mockResolvedValue(fakeBuffer) };
    const mockBrowser = { pages: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([mockPage0, mockPage1]) };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage0 as never, browser: mockBrowser as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await tabsTool.handler({ action: 'screenshot', index: 1, sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe('image');
    expect((result.content[0] as { data: string }).data).toBe(fakeBuffer.toString('base64'));
    expect(mockPage0.screenshot).not.toHaveBeenCalled();
  });

  it('action "screenshot" requires a valid index', async () => {
    const mockBrowser = { pages: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([{}]) };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: {} as never, browser: mockBrowser as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await tabsTool.handler({ action: 'screenshot', index: 5, sessionId: 'session-abc12345' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_INDEX');
  });

  it('lists tabs in headless mode', async () => {
    const mockPage1 = {
      url: jest.fn<() => string>().mockReturnValue('https://example.com'),
      title: jest.fn<() => Promise<string>>().mockResolvedValue('Example')
    };
    const mockPage2 = {
      url: jest.fn<() => string>().mockReturnValue('https://test.com'),
      title: jest.fn<() => Promise<string>>().mockResolvedValue('Test')
    };
    const mockBrowser = {
      pages: jest.fn<() => Promise<typeof mockPage1[]>>().mockResolvedValue([mockPage1, mockPage2])
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage1 as never, browser: mockBrowser as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await tabsTool.handler({ action: 'list', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.tabs).toHaveLength(2);
    expect(parsed.tabs[0]).toEqual({ index: 0, url: 'https://example.com', title: 'Example' });
    expect(parsed.tabs[1]).toEqual({ index: 1, url: 'https://test.com', title: 'Test' });
  });

  it('creates new tab in headless mode', async () => {
    const mockNewPage = {
      goto: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      url: jest.fn<() => string>().mockReturnValue('https://new.com')
    };
    const mockPage = {
      url: jest.fn<() => string>().mockReturnValue('https://example.com'),
      title: jest.fn<() => Promise<string>>().mockResolvedValue('Example')
    };
    const mockBrowser = {
      pages: jest.fn<() => Promise<typeof mockPage[]>>().mockResolvedValue([mockPage]),
      newPage: jest.fn<() => Promise<typeof mockNewPage>>().mockResolvedValue(mockNewPage)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: mockBrowser as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await tabsTool.handler({ action: 'new', url: 'https://new.com', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockNewPage.goto).toHaveBeenCalledWith('https://new.com', { waitUntil: 'networkidle2' });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.index).toBe(1);
    expect(parsed.url).toBe('https://new.com');
  });

  it('returns error when action missing', async () => {
    const result = await tabsTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_ACTION');
  });
});
