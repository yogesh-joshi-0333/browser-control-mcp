import { getConnectionState } from './websocket.js';
import { createSession } from './puppeteer-manager.js';
import { logger } from './logger.js';

export type BrowserMode = 'extension' | 'headless';

export interface IModeResult {
  mode: BrowserMode;
  sessionId?: string;
}

interface ISelectModeOptions {
  sessionId?: string;
  forceMode?: BrowserMode;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

// Module-level default mode — set by browser_select_mode, read by all tools
let defaultMode: BrowserMode | null = null;

export function getDefaultMode(): BrowserMode | null {
  return defaultMode;
}

export function setDefaultMode(mode: BrowserMode): void {
  defaultMode = mode;
}

export function clearDefaultMode(): void {
  defaultMode = null;
}

async function waitForExtension(timeoutMs: number, pollMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getConnectionState().connected) return true;
    await new Promise<void>(resolve => setTimeout(resolve, pollMs));
  }
  return false;
}

export async function selectMode(options: ISelectModeOptions = {}): Promise<IModeResult> {
  const {
    sessionId,
    forceMode,
    waitTimeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
  } = options;

  if (sessionId) {
    return { mode: 'headless', sessionId };
  }

  const mode = forceMode ?? defaultMode ?? 'extension';

  if (mode === 'headless') {
    const newSessionId = await createSession();
    return { mode: 'headless', sessionId: newSessionId };
  }

  if (getConnectionState().connected) {
    return { mode: 'extension' };
  }

  logger.warn('Chrome Extension not connected. Open Chrome manually. Waiting...', {
    waitSeconds: waitTimeoutMs / 1000
  });

  const connected = await waitForExtension(waitTimeoutMs, pollIntervalMs);

  if (connected) {
    logger.info('Chrome Extension connected within timeout');
    return { mode: 'extension' };
  }

  logger.warn('Extension not available after timeout. Falling back to Headless mode.');
  const newSessionId = await createSession();
  return { mode: 'headless', sessionId: newSessionId };
}
