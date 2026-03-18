import puppeteer, { Browser, Page } from 'puppeteer';
import { nanoid } from 'nanoid';
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

export async function createSession(): Promise<string> {
  const id = `session-${nanoid(8)}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
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
