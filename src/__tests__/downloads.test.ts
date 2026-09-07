import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  setDownloadPath: jest.fn(),
  getDownloadPath: jest.fn()
}));

jest.unstable_mockModule('node:fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn()
}));

const { downloadsTool } = await import('../tools/downloads.js');
const { selectMode } = await import('../mode-selector.js');
const manager = await import('../puppeteer-manager.js');
const fsPromises = await import('node:fs/promises');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockSetDownloadPath = manager.setDownloadPath as jest.MockedFunction<typeof manager.setDownloadPath>;
const mockGetDownloadPath = manager.getDownloadPath as jest.MockedFunction<typeof manager.getDownloadPath>;
const mockReaddir = fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>;
const mockStat = fsPromises.stat as jest.MockedFunction<typeof fsPromises.stat>;

describe('browser_downloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('action "configure" sets the download directory for the session', async () => {
    const result = await downloadsTool.handler({ sessionId: 'session-abc12345', action: 'configure', path: '/tmp/downloads' });

    expect(result.isError).toBeFalsy();
    expect(mockSetDownloadPath).toHaveBeenCalledWith('session-abc12345', '/tmp/downloads');
  });

  it('action "configure" requires a path', async () => {
    const result = await downloadsTool.handler({ sessionId: 'session-abc12345', action: 'configure' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_PATH');
  });

  it('action "list" reads the configured download directory and returns file info', async () => {
    mockGetDownloadPath.mockReturnValue('/tmp/downloads');
    mockReaddir.mockResolvedValue(['report.pdf', 'image.png'] as never);
    mockStat.mockImplementation(async (path: unknown) => {
      const p = String(path);
      return { size: p.includes('report') ? 1234 : 56, mtime: new Date('2026-01-01T00:00:00Z') } as never;
    });

    const result = await downloadsTool.handler({ sessionId: 'session-abc12345', action: 'list' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files.find((f: { name: string }) => f.name === 'report.pdf').sizeBytes).toBe(1234);
  });

  it('action "list" errors if no download path has been configured yet', async () => {
    mockGetDownloadPath.mockReturnValue(undefined);

    const result = await downloadsTool.handler({ sessionId: 'session-abc12345', action: 'list' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('DOWNLOAD_PATH_NOT_CONFIGURED');
  });

  it('returns an error for an unknown action', async () => {
    const result = await downloadsTool.handler({ sessionId: 'session-abc12345', action: 'bogus' });

    expect(result.isError).toBe(true);
  });
});
