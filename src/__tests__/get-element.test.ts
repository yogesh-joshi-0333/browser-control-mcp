import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { getElementTool } = await import('../tools/get-element.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_get_element', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('returns full element detail: tag, attributes, boundingBox, visibility, text, curated styles', async () => {
    const elementInfo = {
      tagName: 'BUTTON',
      attributes: { id: 'submit', class: 'btn primary' },
      boundingBox: { x: 10, y: 20, width: 100, height: 40 },
      visible: true,
      textContent: 'Submit',
      styles: { display: 'inline-block', color: 'rgb(255, 255, 255)' }
    };
    const evaluate = jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue(elementInfo);
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await getElementTool.handler({ sessionId: 'session-abc12345', selector: '#submit' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual(elementInfo);
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), '#submit', expect.any(Array));
  });

  it('passes a custom styles list through when provided', async () => {
    const evaluate = jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue({ tagName: 'DIV', attributes: {}, boundingBox: null, visible: false, textContent: '', styles: {} });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    await getElementTool.handler({ sessionId: 'session-abc12345', selector: '#x', styles: ['z-index', 'opacity'] });

    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), '#x', ['z-index', 'opacity']);
  });

  it('returns SELECTOR_NOT_FOUND when nothing matches', async () => {
    const evaluate = jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue(null);
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { evaluate } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await getElementTool.handler({ sessionId: 'session-abc12345', selector: '#missing' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('SELECTOR_NOT_FOUND');
  });

  it('requires a selector', async () => {
    const result = await getElementTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await getElementTool.handler({ selector: '#x' });

    expect(result.isError).toBe(true);
  });
});
