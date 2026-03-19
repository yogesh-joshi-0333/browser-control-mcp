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

const { tabsTool } = await import('../tools/tabs.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists tabs in extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ tabs: [{ index: 0, url: 'https://example.com', title: 'Example' }] });

    const result = await tabsTool.handler({ action: 'list' });

    expect(result.isError).toBeFalsy();
    expect(mockSendToExtension).toHaveBeenCalledWith({
      action: 'manage_tabs',
      payload: { action: 'list', url: undefined, index: undefined }
    });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.tabs).toBeDefined();
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
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage1 as never, browser: mockBrowser as never, createdAt: new Date(), logs: [] });

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
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: mockBrowser as never, createdAt: new Date(), logs: [] });

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
