import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import { nanoid } from 'nanoid';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { logger } from './logger.js';
import type { IErrorResponse } from './types.js';

interface ISession {
  id: string;
  browser: Browser;
  page: Page;
  createdAt: Date;
  logs: Array<{ type: string; text: string; timestamp: string }>;
}

const sessions = new Map<string, ISession>();

/**
 * Find Chrome/Chromium executable on the system.
 * Checks common paths across Linux, macOS, and Windows.
 */
function findChromePath(): string {
  // Check env var override first
  if (process.env['CHROME_PATH'] && existsSync(process.env['CHROME_PATH'])) {
    return process.env['CHROME_PATH'];
  }

  const candidates = [
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Try `which` as last resort (Linux/macOS)
  try {
    const result = execSync('which google-chrome || which chromium || which chromium-browser', { encoding: 'utf-8' }).trim();
    if (result) return result;
  } catch {
    // ignore
  }

  throw new Error(
    'Chrome/Chromium not found. Install Chrome or set CHROME_PATH environment variable. ' +
    'On Linux: sudo apt-get install -y chromium-browser'
  );
}

export async function createSession(): Promise<string> {
  const id = `session-${nanoid(8)}`;
  const executablePath = findChromePath();
  logger.info('Using Chrome executable', { path: executablePath });
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  const pages = await browser.pages();
  const page = pages[0] ?? await browser.newPage();
  // Default viewport — can be overridden per navigate call
  await page.setViewport({ width: 1024, height: 768 });
  // Spoof user agent and hide automation signals so sites load all JS
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const sessionLogs: Array<{ type: string; text: string; timestamp: string }> = [];
  page.on('console', (msg) => {
    sessionLogs.push({ type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() });
  });
  sessions.set(id, { id, browser, page, createdAt: new Date(), logs: sessionLogs });
  logger.info('Puppeteer session created', { id });
  return id;
}

export function getSession(id: string): ISession {
  const session = sessions.get(id);
  if (!session) {
    const error: IErrorResponse = { code: 'SESSION_NOT_FOUND', message: `Session ${id} not found` };
    throw new Error(error.code);
  }
  return session;
}

export function getSessionLogs(id: string): Array<{ type: string; text: string; timestamp: string }> {
  const session = sessions.get(id);
  if (!session) {
    const error: IErrorResponse = { code: 'SESSION_NOT_FOUND', message: `Session ${id} not found` };
    throw new Error(error.code);
  }
  return session.logs;
}

export async function destroySession(id: string): Promise<void> {
  const session = sessions.get(id);
  if (!session) return;
  try {
    await session.browser.close();
  } catch (error) {
    logger.error('Error closing Puppeteer session', { id, error: String(error) });
  }
  sessions.delete(id);
  logger.info('Puppeteer session destroyed', { id });
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}

export async function destroyAll(): Promise<void> {
  const ids = listSessions();
  await Promise.all(ids.map(id => destroySession(id)));
  logger.info('All Puppeteer sessions destroyed');
}
