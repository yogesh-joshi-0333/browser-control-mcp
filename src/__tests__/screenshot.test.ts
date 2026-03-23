import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { screenshotTool } = await import('../tools/screenshot.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_screenshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns image content from headless mode', async () => {
    const fakeBuffer = Buffer.from('fake-png-data');
    const mockPage = { screenshot: jest.fn<() => Promise<Buffer>>().mockResolvedValue(fakeBuffer) };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await screenshotTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe('image');
    expect((result.content[0] as { data: string }).data).toBe(fakeBuffer.toString('base64'));
  });

  it('returns error when selectMode rejects', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await screenshotTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('EXTENSION_NOT_CONNECTED');
  });
});
