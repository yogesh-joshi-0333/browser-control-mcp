import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';

const VALID_NAME = /^[a-zA-Z0-9_-]+$/;

/**
 * Base directory persistent profiles live under. Overridable via
 * BROWSER_CONTROL_MCP_PROFILES_DIR (read lazily, not cached, so tests can
 * point it at a temp directory).
 */
function getProfilesBaseDir(): string {
  return process.env['BROWSER_CONTROL_MCP_PROFILES_DIR'] || join(homedir(), '.browser-control-mcp', 'profiles');
}

export function isValidProfileName(name: string): boolean {
  return VALID_NAME.test(name);
}

export function resolveProfilePath(name: string): string {
  return join(getProfilesBaseDir(), name);
}

export async function listProfiles(): Promise<string[]> {
  const baseDir = getProfilesBaseDir();
  if (!existsSync(baseDir)) return [];
  return readdir(baseDir);
}

export async function deleteProfile(name: string): Promise<void> {
  await rm(resolveProfilePath(name), { recursive: true, force: true });
}
