import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isValidProfileName, resolveProfilePath, listProfiles, deleteProfile } from '../profiles.js';

describe('profiles', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'bc-mcp-profiles-test-'));
    process.env['BROWSER_CONTROL_MCP_PROFILES_DIR'] = baseDir;
  });

  afterEach(() => {
    delete process.env['BROWSER_CONTROL_MCP_PROFILES_DIR'];
    rmSync(baseDir, { recursive: true, force: true });
  });

  describe('isValidProfileName', () => {
    it('accepts alphanumeric, dash, underscore names', () => {
      expect(isValidProfileName('my-profile_1')).toBe(true);
    });

    it('rejects path traversal attempts', () => {
      expect(isValidProfileName('../../etc')).toBe(false);
      expect(isValidProfileName('a/b')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidProfileName('')).toBe(false);
    });
  });

  describe('resolveProfilePath', () => {
    it('resolves inside the configured base directory', () => {
      expect(resolveProfilePath('work')).toBe(join(baseDir, 'work'));
    });
  });

  describe('listProfiles / deleteProfile', () => {
    it('returns an empty list when the base dir does not exist yet', async () => {
      rmSync(baseDir, { recursive: true, force: true });
      expect(await listProfiles()).toEqual([]);
    });

    it('lists a profile directory created by launching a session with it, and deleteProfile removes it', async () => {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(resolveProfilePath('team-a'), { recursive: true });

      expect(await listProfiles()).toContain('team-a');

      await deleteProfile('team-a');

      expect(await listProfiles()).not.toContain('team-a');
    });
  });
});
