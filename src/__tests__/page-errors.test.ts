import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSessionPageErrors: jest.fn()
}));

const { pageErrorsTool } = await import('../tools/page-errors.js');
const { selectMode } = await import('../mode-selector.js');
const { getSessionPageErrors } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSessionPageErrors = getSessionPageErrors as jest.MockedFunction<typeof getSessionPageErrors>;

describe('browser_page_errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns captured uncaught page exceptions', async () => {
    const errors = [{ message: 'boom', stack: 'Error: boom\n at x', timestamp: '2026-01-01T00:00:00.000Z' }];
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSessionPageErrors.mockReturnValue(errors);

    const result = await pageErrorsTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.errors).toEqual(errors);
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await pageErrorsTool.handler({});

    expect(result.isError).toBe(true);
  });
});
