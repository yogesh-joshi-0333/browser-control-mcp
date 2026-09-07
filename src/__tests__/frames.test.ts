import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { framesTool } = await import('../tools/frames.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_frames', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('lists all frames on the page with index, url, and name', async () => {
    const frame0 = { url: () => 'https://example.com', name: () => '' };
    const frame1 = { url: () => 'https://example.com/widget', name: () => 'widget-frame' };
    const page = { frames: jest.fn().mockReturnValue([frame0, frame1]) };
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await framesTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.frames).toEqual([
      { index: 0, url: 'https://example.com', name: '' },
      { index: 1, url: 'https://example.com/widget', name: 'widget-frame' }
    ]);
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await framesTool.handler({});

    expect(result.isError).toBe(true);
  });
});
