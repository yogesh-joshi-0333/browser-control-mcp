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

const { fileUploadTool } = await import('../tools/file-upload.js');
const { selectMode } = await import('../mode-selector.js');
const { sendToExtension } = await import('../websocket.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSendToExtension = sendToExtension as jest.MockedFunction<typeof sendToExtension>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('browser_file_upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads file in extension mode', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'extension' });
    mockSendToExtension.mockResolvedValue({ success: true });

    const result = await fileUploadTool.handler({ selector: 'input[type=file]', paths: ['/home/user/document.pdf'] });

    expect(result.isError).toBeFalsy();
    expect(mockSendToExtension).toHaveBeenCalledWith({
      action: 'file_upload',
      payload: { selector: 'input[type=file]', paths: ['/home/user/document.pdf'] }
    });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.filesUploaded).toBe(1);
  });

  it('uploads file in headless mode', async () => {
    const mockFileInput = {
      uploadFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    const mockPage = {
      waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      $: jest.fn<() => Promise<typeof mockFileInput>>().mockResolvedValue(mockFileInput),
      evaluate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    };
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: mockPage as never, browser: {} as never, createdAt: new Date(), logs: [] });

    const result = await fileUploadTool.handler({ selector: 'input[type=file]', paths: ['/tmp/img1.png', '/tmp/img2.png'], sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('input[type=file]', { timeout: 5000 });
    expect(mockPage.$).toHaveBeenCalledWith('input[type=file]');
    expect(mockFileInput.uploadFile).toHaveBeenCalledWith('/tmp/img1.png', '/tmp/img2.png');
    expect(mockPage.evaluate).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.filesUploaded).toBe(2);
  });

  it('returns error when selector is missing', async () => {
    const result = await fileUploadTool.handler({ paths: ['/tmp/file.txt'] });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_SELECTOR');
  });

  it('returns error when paths is missing or empty', async () => {
    const resultMissing = await fileUploadTool.handler({ selector: 'input[type=file]' });

    expect(resultMissing.isError).toBe(true);
    const parsedMissing = JSON.parse((resultMissing.content[0] as { text: string }).text);
    expect(parsedMissing.code).toBe('INVALID_PATHS');

    const resultEmpty = await fileUploadTool.handler({ selector: 'input[type=file]', paths: [] });

    expect(resultEmpty.isError).toBe(true);
    const parsedEmpty = JSON.parse((resultEmpty.content[0] as { text: string }).text);
    expect(parsedEmpty.code).toBe('INVALID_PATHS');
  });

  it('returns error for invalid session ID', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-invalid' });
    mockGetSession.mockImplementation(() => { throw new Error('SESSION_NOT_FOUND'); });

    const result = await fileUploadTool.handler({ selector: 'input[type=file]', paths: ['/tmp/file.txt'], sessionId: 'session-invalid' });

    expect(result.isError).toBe(true);
  });
});
