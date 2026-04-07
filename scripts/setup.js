#!/usr/bin/env node

/**
 * Auto-setup: detects installed AI clients and injects the browser-control
 * MCP server entry into each one's config file.
 * Called from postinstall.js after Chrome detection.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { cwd } from 'node:process';

const HOME = homedir();
const PLATFORM = platform(); // 'darwin' | 'win32' | 'linux'
const APPDATA = process.env.APPDATA || join(HOME, 'AppData', 'Roaming');

// The MCP entry to inject
const MCP_ENTRY = {
  command: 'npx',
  args: ['browser-control-mcp-server'],
};

const MCP_KEY = 'browser-control';

// ─── Client Definitions ───────────────────────────────────────────────────────

function resolvePath(...segments) {
  return join(...segments);
}

/**
 * Each client definition:
 *   name       — display name
 *   configPath — resolved absolute path to the config file
 *   read(raw)  — parse raw JSON string into an object
 *   hasEntry(obj) — return true if browser-control already configured
 *   inject(obj)   — mutate obj to add the entry, return obj
 *   write(obj) — serialize back to string
 */

function makeStandardClient(name, configPath) {
  return {
    name,
    configPath,
    read: (raw) => JSON.parse(raw),
    hasEntry: (obj) => !!(obj?.mcpServers?.[MCP_KEY]),
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
    darwin: resolvePath(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    win32: resolvePath(APPDATA, 'Claude', 'claude_desktop_config.json'),
    linux: resolvePath(HOME, '.config', 'Claude', 'claude_desktop_config.json'),
  }[PLATFORM] || resolvePath(HOME, '.config', 'Claude', 'claude_desktop_config.json');

  clients.push(makeStandardClient('Claude Desktop', claudeConfigPath));

  // ── Claude Code (global ~/.claude/settings.json) ────────────────────────────
  // Claude Code reads global MCP servers from ~/.claude/settings.json
  clients.push({
    name: 'Claude Code',
    configPath: resolvePath(HOME, '.claude', 'settings.json'),
    read: (raw) => JSON.parse(raw),
    hasEntry: (obj) => !!(obj?.mcpServers?.[MCP_KEY]),
    inject: (obj) => {
      if (!obj.mcpServers) obj.mcpServers = {};
      obj.mcpServers[MCP_KEY] = MCP_ENTRY;
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  });

  // ── Cursor ───────────────────────────────────────────────────────────────────
  const cursorConfigPath = {
    win32: resolvePath(APPDATA, 'Cursor', 'mcp.json'),
    darwin: resolvePath(HOME, '.cursor', 'mcp.json'),
    linux: resolvePath(HOME, '.cursor', 'mcp.json'),
  }[PLATFORM] || resolvePath(HOME, '.cursor', 'mcp.json');

  clients.push(makeStandardClient('Cursor', cursorConfigPath));

  // ── Windsurf ─────────────────────────────────────────────────────────────────
  const windsurfConfigPath = {
    win32: resolvePath(APPDATA, 'Codeium', 'windsurf', 'mcp_config.json'),
    darwin: resolvePath(HOME, '.codeium', 'windsurf', 'mcp_config.json'),
    linux: resolvePath(HOME, '.codeium', 'windsurf', 'mcp_config.json'),
  }[PLATFORM] || resolvePath(HOME, '.codeium', 'windsurf', 'mcp_config.json');

  clients.push(makeStandardClient('Windsurf', windsurfConfigPath));

  // ── Continue ──────────────────────────────────────────────────────────────────
  clients.push(makeStandardClient('Continue', resolvePath(HOME, '.continue', 'config.json')));

  // ── OpenCode ──────────────────────────────────────────────────────────────────
  clients.push(makeStandardClient('OpenCode', resolvePath(HOME, '.config', 'opencode', 'config.json')));

  // ── Cody (Sourcegraph) ────────────────────────────────────────────────────────
  const codyConfigPath = {
    darwin: resolvePath(HOME, 'Library', 'Application Support', 'Cody', 'cody_desktop_config.json'),
    win32: resolvePath(APPDATA, 'Cody', 'cody_desktop_config.json'),
    linux: resolvePath(HOME, '.config', 'Cody', 'cody_desktop_config.json'),
  }[PLATFORM] || resolvePath(HOME, '.config', 'Cody', 'cody_desktop_config.json');

  clients.push(makeStandardClient('Cody (Sourcegraph)', codyConfigPath));

  // ── VS Code (Copilot / Cline) ─────────────────────────────────────────────────
  // VS Code uses settings.json with "mcp.servers" key
  const vscodeSettingsPath = {
    darwin: resolvePath(HOME, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
    win32: resolvePath(APPDATA, 'Code', 'User', 'settings.json'),
    linux: resolvePath(HOME, '.config', 'Code', 'User', 'settings.json'),
  }[PLATFORM] || resolvePath(HOME, '.config', 'Code', 'User', 'settings.json');

  clients.push({
    name: 'VS Code (Copilot/Cline)',
    configPath: vscodeSettingsPath,
    read: (raw) => JSON.parse(raw),
    hasEntry: (obj) => !!(obj?.['mcp.servers']?.[MCP_KEY]),
    inject: (obj) => {
      if (!obj['mcp.servers']) obj['mcp.servers'] = {};
      obj['mcp.servers'][MCP_KEY] = MCP_ENTRY;
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  });

  // ── Zed ───────────────────────────────────────────────────────────────────────
  // Zed uses settings.json with "context_servers" key
  const zedSettingsPath = {
    win32: resolvePath(APPDATA, 'Zed', 'settings.json'),
    darwin: resolvePath(HOME, '.config', 'zed', 'settings.json'),
    linux: resolvePath(HOME, '.config', 'zed', 'settings.json'),
  }[PLATFORM] || resolvePath(HOME, '.config', 'zed', 'settings.json');

  clients.push({
    name: 'Zed',
    configPath: zedSettingsPath,
    read: (raw) => JSON.parse(raw),
    hasEntry: (obj) => !!(obj?.context_servers?.[MCP_KEY]),
    inject: (obj) => {
      if (!obj.context_servers) obj.context_servers = {};
      obj.context_servers[MCP_KEY] = {
        command: { path: 'npx', args: ['browser-control-mcp-server'] },
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

  // Client not installed
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

  // Already configured
  if (client.hasEntry(obj)) {
    return { name, status: 'already' };
  }

  // Inject entry
  client.inject(obj);

  try {
    // Ensure parent dir exists (e.g. first-time Claude Desktop install)
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, client.write(obj), 'utf-8');
  } catch (err) {
    return { name, status: 'error', reason: `Could not write: ${err.message}` };
  }

  return { name, status: 'configured' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function setupClients() {
  const clients = getClients();
  const results = clients.map(processClient);

  const configured = results.filter(r => r.status === 'configured');
  const already    = results.filter(r => r.status === 'already');
  const skipped    = results.filter(r => r.status === 'skipped');
  const errors     = results.filter(r => r.status === 'error');

  // Only print output if something happened (configured, already, or errors)
  const hasOutput = configured.length > 0 || already.length > 0 || errors.length > 0;

  if (!hasOutput && skipped.length === clients.length) {
    // No clients found at all — silent
    return;
  }

  console.log('\n[browser-control-mcp] Configuring AI clients...');

  for (const r of results) {
    if (r.status === 'configured') {
      console.log(`  ✓ ${r.name} configured`);
    } else if (r.status === 'already') {
      console.log(`  ~ ${r.name} already configured`);
    } else if (r.status === 'error') {
      console.warn(`  ✗ ${r.name} — ${r.reason}`);
    }
    // skipped = silent (client not installed, not relevant to user)
  }

  if (configured.length > 0) {
    console.log('\n[browser-control-mcp] Done. Restart your AI client to activate browser-control.\n');
  } else if (already.length > 0 && configured.length === 0) {
    console.log('\n[browser-control-mcp] Already configured in all detected clients.\n');
  }
}
