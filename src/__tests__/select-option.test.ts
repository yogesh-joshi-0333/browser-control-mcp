import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { selectOptionTool } = await import('../tools/select-option.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_select_option', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects option by value in headless mode', async () => {
    const mockPage = {
      select: jest.fn<() => Promise<string[]>>().mockResolvedValue(['US']),
      evaluate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await selectOptionTool.handler({ selector: '#country', value: 'US', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.select).toHaveBeenCalledWith('#country', 'US');
    expect(mockPage.evaluate).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.selectedValue).toBe('US');
  });

  it('selects option by label in headless mode', async () => {
    const mockPage = {
      select: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
      evaluate: jest.fn<() => Promise<string | undefined>>(),
      waitForFunction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    // First call: find option by label and set value, returns the option value
    // Second call: dispatch events
    mockPage.evaluate
      .mockResolvedValueOnce('US' as never)
      .mockResolvedValueOnce(undefined as never);

    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await selectOptionTool.handler({ selector: '#country', label: 'United States', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.select).not.toHaveBeenCalled();
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.selectedValue).toBe('US');
  });

  it('returns error when selector is missing', async () => {
    const result = await selectOptionTool.handler({});

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
  });

  it('returns error when neither value nor label provided', async () => {
    const result = await selectOptionTool.handler({ selector: '#country' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_OPTION');
  });
});
