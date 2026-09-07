import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { pdfTool } = await import('../tools/pdf.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves a PDF to the given path and reports its size', async () => {
    const fakeBuffer = Buffer.from('fake-pdf-bytes');
    const pdf = jest.fn<(...args: unknown[]) => Promise<Buffer>>().mockResolvedValue(fakeBuffer);
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { pdf } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await pdfTool.handler({ sessionId: 'session-abc12345', path: '/tmp/out.pdf' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual({ success: true, path: '/tmp/out.pdf', sizeBytes: fakeBuffer.length });
    expect(pdf).toHaveBeenCalledWith({ path: '/tmp/out.pdf', format: 'A4', landscape: false, printBackground: true });
  });

  it('passes through format and landscape options', async () => {
    const pdf = jest.fn<(...args: unknown[]) => Promise<Buffer>>().mockResolvedValue(Buffer.from(''));
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: { pdf } as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    await pdfTool.handler({ sessionId: 'session-abc12345', path: '/tmp/out.pdf', format: 'Letter', landscape: true });

    expect(pdf).toHaveBeenCalledWith({ path: '/tmp/out.pdf', format: 'Letter', landscape: true, printBackground: true });
  });

  it('requires a path', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: {} as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] });

    const result = await pdfTool.handler({ sessionId: 'session-abc12345' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_PATH');
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await pdfTool.handler({ path: '/tmp/out.pdf' });

    expect(result.isError).toBe(true);
  });
});
