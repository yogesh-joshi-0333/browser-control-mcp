import type { Browser, Page } from 'puppeteer-core';
import { stealthPuppeteer as puppeteer } from './stealth-browser.js';
import { nanoid } from 'nanoid';
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import { logger } from './logger.js';
import { DEBUG_PORT } from './config.js';
import type { IErrorResponse } from './types.js';

export interface INetworkEntry {
  url: string;
  method: string;
  resourceType: string;
  status: number | 'blocked' | null;
  timestamp: string;
}

interface ISession {
  id: string;
  browser: Browser;
  page: Page;
  createdAt: Date;
  logs: Array<{ type: string; text: string; timestamp: string }>;
  networkLog: INetworkEntry[];
  blockedResourceTypes: Set<string>;
  downloadPath?: string;
  pageErrors: Array<{ message: string; stack?: string; timestamp: string }>;
}

/** Attaches a pageerror listener that records uncaught exceptions thrown in the page. */
function attachPageErrorCapture(session: ISession): void {
  session.page.on('pageerror', (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    session.pageErrors.push({ message: error.message, stack: error.stack, timestamp: new Date().toISOString() });
  });
}

const sessions = new Map<string, ISession>();
const MAX_NETWORK_LOG_ENTRIES = 500;

/**
 * Enables request interception and records every request/response on the
 * session's networkLog (capped at MAX_NETWORK_LOG_ENTRIES). Requests whose
 * resourceType is in session.blockedResourceTypes are aborted instead of
 * continued, and logged with status "blocked".
 */
async function attachNetworkCapture(session: ISession): Promise<void> {
  await session.page.setRequestInterception(true);

  session.page.on('request', (request) => {
    const resourceType = request.resourceType();
    const blocked = session.blockedResourceTypes.has(resourceType);

    session.networkLog.push({
      url: request.url(),
      method: request.method(),
      resourceType,
      status: blocked ? 'blocked' : null,
      timestamp: new Date().toISOString()
    });
    if (session.networkLog.length > MAX_NETWORK_LOG_ENTRIES) {
      session.networkLog.shift();
    }

    if (blocked) {
      void request.abort();
    } else {
      void request.continue();
    }
  });

  session.page.on('response', (response) => {
    const url = response.url();
    for (let i = session.networkLog.length - 1; i >= 0; i--) {
      if (session.networkLog[i].url === url && session.networkLog[i].status === null) {
        session.networkLog[i].status = response.status();
        break;
      }
    }
  });
}

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

export interface ICreateSessionOptions {
  proxyServer?: string;
  userDataDir?: string;
}

export async function createSession(options: ICreateSessionOptions = {}): Promise<string> {
  const id = `session-${nanoid(8)}`;
  const executablePath = findChromePath();
  logger.info('Using Chrome executable', { path: executablePath });
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled'
  ];
  if (options.proxyServer) {
    args.push(`--proxy-server=${options.proxyServer}`);
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    userDataDir: options.userDataDir,
    args
  });
  const pages = await browser.pages();
  const page = (pages[0] ?? await browser.newPage()) as Page;
  // Default viewport — can be overridden per navigate call
  await page.setViewport({ width: 1024, height: 768 });
  // Spoof user agent; stealth plugin (registered in stealth-browser.ts) handles
  // navigator.webdriver, plugins/languages, permissions.query, and other evasions.
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  const sessionLogs: Array<{ type: string; text: string; timestamp: string }> = [];
  page.on('console', (msg) => {
    sessionLogs.push({ type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() });
  });
  const session: ISession = {
    id, browser, page, createdAt: new Date(), logs: sessionLogs,
    networkLog: [], blockedResourceTypes: new Set(), pageErrors: []
  };
  await attachNetworkCapture(session);
  attachPageErrorCapture(session);
  sessions.set(id, session);
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

export function getSessionPageErrors(id: string): Array<{ message: string; stack?: string; timestamp: string }> {
  return getSession(id).pageErrors;
}

export function getNetworkLog(id: string): INetworkEntry[] {
  return getSession(id).networkLog;
}

export function clearNetworkLog(id: string): void {
  getSession(id).networkLog = [];
}

export function setBlockedResourceTypes(id: string, resourceTypes: string[]): void {
  getSession(id).blockedResourceTypes = new Set(resourceTypes);
}

export function getBlockedResourceTypes(id: string): string[] {
  return Array.from(getSession(id).blockedResourceTypes);
}

interface ICdpDownloadBehavior {
  setDownloadBehavior(behavior: { policy: 'allow'; downloadPath: string }): Promise<void>;
}

export async function setDownloadPath(id: string, downloadPath: string): Promise<void> {
  const session = getSession(id);
  // setDownloadBehavior is a CDP-specific capability, not on the public cross-protocol
  // BrowserContext type — but puppeteer-core's launch()/connect() always give us the
  // CDP implementation, which does implement it.
  const context = session.page.browserContext() as unknown as ICdpDownloadBehavior;
  await context.setDownloadBehavior({ policy: 'allow', downloadPath });
  session.downloadPath = downloadPath;
}

export function getDownloadPath(id: string): string | undefined {
  return getSession(id).downloadPath;
}

export async function destroySession(id: string): Promise<void> {
  const session = sessions.get(id);
  if (!session) return;
  try {
    await session.browser.close();
    // browser.close() resolves once the CDP connection closes, which can race
    // ahead of the Chrome process actually exiting and flushing profile writes
    // (userDataDir) to disk under load. Wait for real process exit too.
    const proc = session.browser.process();
    if (proc && proc.exitCode === null && !proc.killed) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        proc.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
  } catch (error) {
    logger.error('Error closing Puppeteer session', { id, error: String(error) });
  }
  sessions.delete(id);
  logger.info('Puppeteer session destroyed', { id });
}

export function setSessionPage(id: string, page: Page): void {
  const session = sessions.get(id);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }
  session.page = page;
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}

export async function destroyAll(): Promise<void> {
  const ids = listSessions();
  await Promise.all(ids.map(id => destroySession(id)));
  logger.info('All Puppeteer sessions destroyed');
}

export function isDebugChromeRunning(port: number = DEBUG_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume(); // drain response
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function launchDebugChrome(port: number = DEBUG_PORT): Promise<void> {
  const chromePath = findChromePath();
  logger.info('Launching debug Chrome', { path: chromePath, port });

  const child = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const maxWait = 15_000;
  const interval = 500;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    if (await isDebugChromeRunning(port)) {
      logger.info('Debug Chrome is ready', { port });
      return;
    }
  }

  throw new Error(`Chrome did not start on port ${port} within ${maxWait / 1000} seconds`);
}

export async function createConnectSession(port: number = DEBUG_PORT): Promise<string> {
  const id = `connect-${nanoid(8)}`;

  if (!(await isDebugChromeRunning(port))) {
    await launchDebugChrome(port);
  }

  const browserURL = `http://127.0.0.1:${port}`;
  logger.info('Connecting to debug Chrome via CDP', { browserURL });

  const browser = await puppeteer.connect({ browserURL });

  const pages = await browser.pages();
  const page = (pages[0] ?? await browser.newPage()) as Page;

  // Apply same anti-bot protections as createSession() (UA + stealth plugin evasions)
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Console log capture
  const sessionLogs: Array<{ type: string; text: string; timestamp: string }> = [];
  page.on('console', (msg) => {
    sessionLogs.push({ type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() });
  });

  // NOTE: network capture/blocking is intentionally NOT enabled in connect mode —
  // this is the user's real, already-in-use Chrome tab, and request interception
  // adds latency/risk to every request on their live browsing session.
  const connectSession: ISession = { id, browser, page, createdAt: new Date(), logs: sessionLogs, networkLog: [], blockedResourceTypes: new Set(), pageErrors: [] };
  attachPageErrorCapture(connectSession);
  sessions.set(id, connectSession);
  logger.info('CDP connect session created', { id });
  return id;
}
