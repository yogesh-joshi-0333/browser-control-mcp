import { describe, it, expect, afterEach } from '@jest/globals';
import {
  createSession,
  getSession,
  destroySession,
  listSessions,
  destroyAll,
  getNetworkLog,
  clearNetworkLog,
  setBlockedResourceTypes,
  setDownloadPath,
  getDownloadPath
} from '../puppeteer-manager.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('PuppeteerManager', () => {
  afterEach(async () => {
    await destroyAll();
  });

  it('creates a session with valid ID format', async () => {
    const id = await createSession();
    expect(id).toMatch(/^session-[a-zA-Z0-9_-]{8}$/);
  }, 30000);

  it('returns the same session when called with existing ID', async () => {
    const id = await createSession();
    const session1 = getSession(id);
    const session2 = getSession(id);
    expect(session1).toBe(session2);
  }, 30000);

  it('lists active sessions', async () => {
    const id = await createSession();
    expect(listSessions()).toContain(id);
  }, 30000);

  it('throws SESSION_NOT_FOUND for unknown sessionId', () => {
    expect(() => getSession('session-notexist')).toThrow('SESSION_NOT_FOUND');
  });

  it('removes session after destroy', async () => {
    const id = await createSession();
    await destroySession(id);
    expect(listSessions()).not.toContain(id);
  }, 30000);

  it('destroyAll closes all sessions', async () => {
    await createSession();
    await createSession();
    await destroyAll();
    expect(listSessions()).toHaveLength(0);
  }, 30000);

  it('captures real network requests made during navigation', async () => {
    const id = await createSession();
    const session = getSession(id);
    await session.page.goto('https://example.com', { waitUntil: 'networkidle0' });

    const log = getNetworkLog(id);

    expect(log.length).toBeGreaterThan(0);
    const docEntry = log.find(entry => entry.url === 'https://example.com/');
    expect(docEntry).toBeDefined();
    expect(docEntry?.method).toBe('GET');
    expect(docEntry?.status).toBe(200);
  }, 30000);

  it('clearNetworkLog empties the log for a session', async () => {
    const id = await createSession();
    const session = getSession(id);
    await session.page.goto('https://example.com', { waitUntil: 'networkidle0' });
    expect(getNetworkLog(id).length).toBeGreaterThan(0);

    clearNetworkLog(id);

    expect(getNetworkLog(id)).toHaveLength(0);
  }, 30000);

  it('blocks requests for resource types marked blocked, logging them as "blocked"', async () => {
    const id = await createSession();
    const session = getSession(id);
    setBlockedResourceTypes(id, ['image']);

    await session.page.setContent('<html><body><img src="https://blocked.invalid/test.png"></body></html>');
    await new Promise(r => setTimeout(r, 200));

    const log = getNetworkLog(id);
    const imageEntry = log.find(entry => entry.url === 'https://blocked.invalid/test.png');
    expect(imageEntry).toBeDefined();
    expect(imageEntry?.status).toBe('blocked');
  }, 30000);

  it('setDownloadPath configures real CDP download behavior without throwing, and is readable via getDownloadPath', async () => {
    const id = await createSession();
    const dir = mkdtempSync(join(tmpdir(), 'bc-mcp-download-test-'));

    await setDownloadPath(id, dir);

    expect(getDownloadPath(id)).toBe(dir);
    rmSync(dir, { recursive: true, force: true });
  }, 30000);

  it('getDownloadPath returns undefined when never configured', async () => {
    const id = await createSession();
    expect(getDownloadPath(id)).toBeUndefined();
  }, 30000);
});
