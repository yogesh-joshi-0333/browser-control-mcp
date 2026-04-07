#!/usr/bin/env node

/**
 * Auto-setup: detects installed AI clients and injects the browser-control
 * MCP server entry into each one's config file.
 * Called from postinstall.js after Chrome detection.
 *
 * KEY INSIGHT: We use process.execPath (absolute node binary) + a path
 * relative to this script to locate dist/index.js. This works universally
 * across nvm, volta, fnm, system node, Windows, Mac, Linux — no PATH needed.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOME = homedir();
const PLATFORM = platform(); // 'darwin' | 'win32' | 'linux'
const APPDATA = process.env.APPDATA || join(HOME, 'AppData', 'Roaming');
const MCP_KEY = 'browser-control';

// Absolute path to node binary running this script — always correct regardless of PATH
const NODE_PATH = normalize(process.execPath);

// Absolute path to dist/index.js — relative to this script file, always resolvable
const ENTRY_POINT = normalize(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js')
);

// The MCP entry — uses absolute paths so GUI apps don't need node in PATH
const MCP_ENTRY = { command: NODE_PATH, args: [ENTRY_POINT] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function p(...segments) {
  return normalize(join(...segments));
}

/** Parse JSON tolerantly — handles JSONC (JSON with comments) */
function parseJson(raw) {
  // First try plain JSON (most configs are valid JSON)
  try { return JSON.parse(raw); } catch { /* fall through to JSONC */ }
  // Strip comments only outside of strings using a state machine
  let result = '';
  let inString = false;
  let escaped = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (escaped) { result += ch; escaped = false; i++; continue; }
    if (ch === '\\' && inString) { result += ch; escaped = true; i++; continue; }
    if (ch === '"') { inString = !inString; result += ch; i++; continue; }
    if (!inString && ch === '/' && raw[i + 1] === '/') {
      while (i < raw.length && raw[i] !== '\n') i++; continue; // skip line
    }
    if (!inString && ch === '/' && raw[i + 1] === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i++;
      i += 2; continue; // skip block comment
    }
    result += ch; i++;
  }
  return JSON.parse(result);
}

// ─── Client Definitions ───────────────────────────────────────────────────────

/**
 * Standard client: MCP entry lives at obj.mcpServers[MCP_KEY]
 * Always overwrites — keeps absolute paths current across node upgrades.
 */
function makeStandardClient(name, configPath) {
  return {
    name,
    configPath,
    read: parseJson,
    hasEntry: () => false, // always overwrite to keep paths current
    inject: (obj) => {
      if (!obj.mcpServers) obj.mcpServers = {};
      obj.mcpServers[MCP_KEY] = MCP_ENTRY;
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  };
}

function getClients() {
  const clients = [];

  // ── Claude Desktop ──────────────────────────────────────────────────────────
  const claudeConfigPath = {
    darwin: p(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    win32:  p(APPDATA, 'Claude', 'claude_desktop_config.json'),
    linux:  p(HOME, '.config', 'Claude', 'claude_desktop_config.json'),
  }[PLATFORM] ?? p(HOME, '.config', 'Claude', 'claude_desktop_config.json');

  clients.push(makeStandardClient('Claude Desktop', claudeConfigPath));

  // ── Claude Code (global settings) ───────────────────────────────────────────
  clients.push(makeStandardClient('Claude Code', p(HOME, '.claude', 'settings.json')));

  // ── Cursor ───────────────────────────────────────────────────────────────────
  const cursorConfigPath = PLATFORM === 'win32'
    ? p(APPDATA, 'Cursor', 'mcp.json')
    : p(HOME, '.cursor', 'mcp.json');

  clients.push(makeStandardClient('Cursor', cursorConfigPath));

  // ── Windsurf ─────────────────────────────────────────────────────────────────
  const windsurfConfigPath = PLATFORM === 'win32'
    ? p(APPDATA, 'Codeium', 'windsurf', 'mcp_config.json')
    : p(HOME, '.codeium', 'windsurf', 'mcp_config.json');

  clients.push(makeStandardClient('Windsurf', windsurfConfigPath));

  // ── Continue ──────────────────────────────────────────────────────────────────
  clients.push(makeStandardClient('Continue', p(HOME, '.continue', 'config.json')));

  // ── OpenCode ──────────────────────────────────────────────────────────────────
  clients.push(makeStandardClient('OpenCode', p(HOME, '.config', 'opencode', 'config.json')));

  // ── Cody (Sourcegraph) ────────────────────────────────────────────────────────
  const codyConfigPath = {
    darwin: p(HOME, 'Library', 'Application Support', 'Cody', 'cody_desktop_config.json'),
    win32:  p(APPDATA, 'Cody', 'cody_desktop_config.json'),
    linux:  p(HOME, '.config', 'Cody', 'cody_desktop_config.json'),
  }[PLATFORM] ?? p(HOME, '.config', 'Cody', 'cody_desktop_config.json');

  clients.push(makeStandardClient('Cody (Sourcegraph)', codyConfigPath));

  // ── VS Code (Copilot / Cline) ─────────────────────────────────────────────────
  // Uses "mcp.servers" key in settings.json
  const vscodeSettingsPath = {
    darwin: p(HOME, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
    win32:  p(APPDATA, 'Code', 'User', 'settings.json'),
    linux:  p(HOME, '.config', 'Code', 'User', 'settings.json'),
  }[PLATFORM] ?? p(HOME, '.config', 'Code', 'User', 'settings.json');

  // VS Code Insiders
  const vscodeInsidersSettingsPath = {
    darwin: p(HOME, 'Library', 'Application Support', 'Code - Insiders', 'User', 'settings.json'),
    win32:  p(APPDATA, 'Code - Insiders', 'User', 'settings.json'),
    linux:  p(HOME, '.config', 'Code - Insiders', 'User', 'settings.json'),
  }[PLATFORM] ?? p(HOME, '.config', 'Code - Insiders', 'User', 'settings.json');

  for (const [name, cfgPath] of [['VS Code (Copilot/Cline)', vscodeSettingsPath], ['VS Code Insiders', vscodeInsidersSettingsPath]]) {
    clients.push({
      name,
      configPath: cfgPath,
      read: parseJson,
      hasEntry: () => false, // always overwrite
      inject: (obj) => {
        if (!obj['mcp.servers']) obj['mcp.servers'] = {};
        obj['mcp.servers'][MCP_KEY] = MCP_ENTRY;
        return obj;
      },
      write: (obj) => JSON.stringify(obj, null, 2),
    });
  }

  // ── Zed ───────────────────────────────────────────────────────────────────────
  // Uses "context_servers" key in settings.json
  const zedSettingsPath = PLATFORM === 'win32'
    ? p(APPDATA, 'Zed', 'settings.json')
    : p(HOME, '.config', 'zed', 'settings.json');

  clients.push({
    name: 'Zed',
    configPath: zedSettingsPath,
    read: parseJson,
    hasEntry: () => false, // always overwrite
    inject: (obj) => {
      if (!obj.context_servers) obj.context_servers = {};
      obj.context_servers[MCP_KEY] = {
        command: { path: NODE_PATH, args: [ENTRY_POINT] },
      };
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  });

  return clients;
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

function processClient(client) {
  const { name, configPath } = client;

  if (!existsSync(configPath)) {
    return { name, status: 'skipped' };
  }

  let raw;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    return { name, status: 'error', reason: `Could not read: ${err.message}` };
  }

  let obj;
  try {
    obj = client.read(raw);
  } catch {
    return { name, status: 'error', reason: 'Invalid JSON — skipping to avoid corruption' };
  }

  if (client.hasEntry(obj)) {
    return { name, status: 'already' };
  }

  client.inject(obj);

  try {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, client.write(obj), 'utf-8');
  } catch (err) {
    return { name, status: 'error', reason: `Could not write: ${err.message}` };
  }

  return { name, status: 'configured' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function setupClients() {
  // Bail out if entry point doesn't exist (e.g. local install, not global)
  if (!existsSync(ENTRY_POINT)) return;

  const clients = getClients();
  const results = clients.map(processClient);

  const configured = results.filter(r => r.status === 'configured');
  const errors     = results.filter(r => r.status === 'error');
  const skipped    = results.filter(r => r.status === 'skipped');

  if (configured.length === 0 && errors.length === 0 && skipped.length === clients.length) {
    return; // no clients installed — stay silent
  }

  console.log('\n[browser-control-mcp] Configuring AI clients...');

  for (const r of results) {
    if (r.status === 'configured') {
      console.log(`  ✓ ${r.name}`);
    } else if (r.status === 'error') {
      console.warn(`  ✗ ${r.name} — ${r.reason}`);
    }
    // skipped and already = silent
  }

  if (configured.length > 0) {
    console.log('[browser-control-mcp] Done. Restart your AI client to activate browser-control.\n');
  }
}
