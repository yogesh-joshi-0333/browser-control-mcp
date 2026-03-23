import { createSession, createConnectSession } from './puppeteer-manager.js';
import { logger } from './logger.js';

export type BrowserMode = 'headless' | 'connect';

export interface IModeResult {
  mode: BrowserMode;
  sessionId?: string;
}

interface ISelectModeOptions {
  sessionId?: string;
  forceMode?: BrowserMode;
}

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

export async function selectMode(options: ISelectModeOptions = {}): Promise<IModeResult> {
  const { sessionId, forceMode } = options;

  // Session already exists — return as headless (it's a Puppeteer session either way)
  if (sessionId) {
    return { mode: 'headless', sessionId };
  }

  const mode = forceMode ?? defaultMode ?? 'headless';

  if (mode === 'connect') {
    logger.info('Creating CDP connect session');
    const newSessionId = await createConnectSession();
    return { mode: 'connect', sessionId: newSessionId };
  }

  // Default: headless
  const newSessionId = await createSession();
  return { mode: 'headless', sessionId: newSessionId };
}
