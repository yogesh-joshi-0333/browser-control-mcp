import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getSession: jest.fn()
}));

const { emulateTool } = await import('../tools/emulate.js');
const { selectMode } = await import('../mode-selector.js');
const { getSession } = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

function makeMockPage(overrides: Record<string, unknown> = {}) {
  return {
    emulate: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    emulateMediaFeatures: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    emulateTimezone: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    emulateCPUThrottling: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    emulateNetworkConditions: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    setOfflineMode: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    setExtraHTTPHeaders: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    setGeolocation: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    url: jest.fn<() => string>().mockReturnValue('https://example.com'),
    browserContext: jest.fn<() => { overridePermissions: jest.Mock }>().mockReturnValue({
      overridePermissions: jest.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    }),
    ...overrides
  };
}

describe('browser_emulate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('applies a known device preset', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await emulateTool.handler({ sessionId: 'session-abc12345', device: 'iPhone 15 Pro' });

    expect(result.isError).toBeFalsy();
    expect(page.emulate).toHaveBeenCalled();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.applied).toContain('device');
  });

  it('errors on an unknown device name', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    const result = await emulateTool.handler({ sessionId: 'session-abc12345', device: 'Not A Real Device' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('UNKNOWN_DEVICE');
  });

  it('applies color scheme and reduced motion together', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', colorScheme: 'dark', reducedMotion: 'reduce' });

    expect(page.emulateMediaFeatures).toHaveBeenCalledWith([
      { name: 'prefers-color-scheme', value: 'dark' },
      { name: 'prefers-reduced-motion', value: 'reduce' }
    ]);
  });

  it('applies timezone', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', timezone: 'America/New_York' });

    expect(page.emulateTimezone).toHaveBeenCalledWith('America/New_York');
  });

  it('applies locale via Accept-Language header', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', locale: 'fr-FR' });

    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({ 'Accept-Language': 'fr-FR' });
  });

  it('grants geolocation permission then sets coordinates', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', geolocation: { latitude: 51.5, longitude: -0.12 } });

    expect(page.browserContext().overridePermissions).toHaveBeenCalledWith('https://example.com', ['geolocation']);
    expect(page.setGeolocation).toHaveBeenCalledWith({ latitude: 51.5, longitude: -0.12 });
  });

  it('overrides arbitrary permissions', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', permissions: ['clipboard-read', 'clipboard-write'] });

    expect(page.browserContext().overridePermissions).toHaveBeenCalledWith('https://example.com', ['clipboard-read', 'clipboard-write']);
  });

  it('applies a named network throttle preset', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', networkThrottle: 'Slow 3G' });

    expect(page.emulateNetworkConditions).toHaveBeenCalled();
  });

  it('enables offline mode', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', networkThrottle: 'offline' });

    expect(page.setOfflineMode).toHaveBeenCalledWith(true);
  });

  it('clears throttling when networkThrottle is "none"', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', networkThrottle: 'none' });

    expect(page.setOfflineMode).toHaveBeenCalledWith(false);
    expect(page.emulateNetworkConditions).toHaveBeenCalledWith(null);
  });

  it('applies CPU throttling factor', async () => {
    const page = makeMockPage();
    mockGetSession.mockReturnValue({ id: 'session-abc12345', page: page as never, browser: {} as never, createdAt: new Date(), logs: [], networkLog: [], blockedResourceTypes: new Set() });

    await emulateTool.handler({ sessionId: 'session-abc12345', cpuThrottle: 4 });

    expect(page.emulateCPUThrottling).toHaveBeenCalledWith(4);
  });

  it('returns error when mode selection fails', async () => {
    mockSelectMode.mockRejectedValue({ code: 'EXTENSION_NOT_CONNECTED', message: 'Not connected' });

    const result = await emulateTool.handler({ device: 'iPhone 15 Pro' });

    expect(result.isError).toBe(true);
  });
});
