import { describe, it, expect, afterEach } from '@jest/globals';
import {
  createSession,
  getSession,
  destroySession,
  listSessions,
  destroyAll
} from '../puppeteer-manager.js';

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
});
