import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../websocket.js', () => ({
  getConnectionState: jest.fn()
}));
jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  createSession: jest.fn()
}));

const { selectMode } = await import('../mode-selector.js');
const { getConnectionState } = await import('../websocket.js');
const { createSession } = await import('../puppeteer-manager.js');

const mockGetConnectionState = getConnectionState as jest.MockedFunction<typeof getConnectionState>;
const mockCreateSession = createSession as jest.MockedFunction<typeof createSession>;

describe('mode-selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-selects headless when sessionId provided', async () => {
    const result = await selectMode({ sessionId: 'session-abc12345' });
    expect(result.mode).toBe('headless');
    expect(result.sessionId).toBe('session-abc12345');
  });

  it('returns headless mode when forceMode is headless', async () => {
    mockCreateSession.mockResolvedValue('session-new12345');
    const result = await selectMode({ forceMode: 'headless' });
    expect(result.mode).toBe('headless');
    expect(result.sessionId).toBe('session-new12345');
  });

  it('returns extension mode when connected and forceMode is extension', async () => {
    mockGetConnectionState.mockReturnValue({ connected: true, socketId: 'abc' });
    const result = await selectMode({ forceMode: 'extension' });
    expect(result.mode).toBe('extension');
  });

  it('falls back to headless after timeout when extension not connected', async () => {
    mockGetConnectionState.mockReturnValue({ connected: false, socketId: null });
    mockCreateSession.mockResolvedValue('session-fallback1');
    const result = await selectMode({
      forceMode: 'extension',
      waitTimeoutMs: 100,
      pollIntervalMs: 50
    });
    expect(result.mode).toBe('headless');
    expect(result.sessionId).toBe('session-fallback1');
  }, 10000);
});
