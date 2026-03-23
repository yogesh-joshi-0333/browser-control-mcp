import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  createSession: jest.fn(),
  createConnectSession: jest.fn(),
  isDebugChromeRunning: jest.fn()
}));

const { selectMode, setDefaultMode, getDefaultMode, clearDefaultMode } = await import('../mode-selector.js');
const { createSession, createConnectSession } = await import('../puppeteer-manager.js');

const mockCreateSession = createSession as jest.MockedFunction<typeof createSession>;
const mockCreateConnectSession = createConnectSession as jest.MockedFunction<typeof createConnectSession>;

describe('mode-selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDefaultMode();
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

  it('returns connect mode when forceMode is connect', async () => {
    mockCreateConnectSession.mockResolvedValue('session-connect1');
    const result = await selectMode({ forceMode: 'connect' });
    expect(result.mode).toBe('connect');
    expect(result.sessionId).toBe('session-connect1');
  });

  it('uses defaultMode when no forceMode provided', async () => {
    setDefaultMode('headless');
    mockCreateSession.mockResolvedValue('session-default1');
    const result = await selectMode({});
    expect(result.mode).toBe('headless');
    expect(result.sessionId).toBe('session-default1');
  });

  it('forceMode overrides defaultMode', async () => {
    setDefaultMode('headless');
    mockCreateConnectSession.mockResolvedValue('session-connect2');
    const result = await selectMode({ forceMode: 'connect' });
    expect(result.mode).toBe('connect');
    expect(result.sessionId).toBe('session-connect2');
  });

  it('getDefaultMode returns null initially', () => {
    expect(getDefaultMode()).toBeNull();
  });

  it('setDefaultMode and getDefaultMode work together', () => {
    setDefaultMode('connect');
    expect(getDefaultMode()).toBe('connect');
    setDefaultMode('headless');
    expect(getDefaultMode()).toBe('headless');
  });

  it('clearDefaultMode resets to null', () => {
    setDefaultMode('connect');
    clearDefaultMode();
    expect(getDefaultMode()).toBeNull();
  });
});
