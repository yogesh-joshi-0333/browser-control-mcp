#!/usr/bin/env node

/**
 * Auto-setup: detects installed AI clients and injects the browser-control
 * MCP server entry into each one's config file.
 * Called from postinstall.js after Chrome detection.
 *
 * DYNAMIC DETECTION STRATEGY:
 * For each client we check ALL known config paths (across OS versions, install
 * methods, and version changes). Every path that exists gets updated — so if a
 * user has multiple installs (stable + insiders, brew + direct, etc.) all are
 * configured. New paths can be added to the arrays without breaking old ones.
 *
 * PATH RESOLUTION:
 * We use process.execPath (absolute node binary) + import.meta.url-relative path
 * to dist/index.js. Works universally across nvm, volta, fnm, system node,
 * Windows, Mac, Linux — no PATH dependency needed.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HOME     = homedir();
const PLATFORM = platform();
const APPDATA  = process.env.APPDATA       || join(HOME, 'AppData', 'Roaming');
const LAPPDATA = process.env.LOCALAPPDATA  || join(HOME, 'AppData', 'Local');
const USERPROFILE = process.env.USERPROFILE || HOME;
const MCP_KEY  = 'browser-control';

// Absolute node path + entry point — resolved once at install time
const NODE_PATH  = normalize(process.execPath);
const ENTRY_POINT = normalize(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js')
);
const MCP_ENTRY = { command: NODE_PATH, args: [ENTRY_POINT] };

// ─── JSON helpers ─────────────────────────────────────────────────────────────

/** Parse JSON or JSONC (with // and block comments) safely */
function parseJson(raw) {
  try { return JSON.parse(raw); } catch { /* fall through to JSONC */ }
  let result = '', inString = false, escaped = false, i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (escaped)                                   { result += ch; escaped = false; i++; continue; }
    if (ch === '\\' && inString)                   { result += ch; escaped = true;  i++; continue; }
    if (ch === '"')                                { inString = !inString; result += ch; i++; continue; }
    if (!inString && ch === '/' && raw[i+1] === '/') { while (i < raw.length && raw[i] !== '\n') i++; continue; }
    if (!inString && ch === '/' && raw[i+1] === '*') { i += 2; while (i < raw.length && !(raw[i] === '*' && raw[i+1] === '/')) i++; i += 2; continue; }
    result += ch; i++;
  }
  return JSON.parse(result);
}

// ─── Dynamic path helpers ─────────────────────────────────────────────────────

/** Try to find an executable on PATH — returns its path or null */
function which(cmd) {
  try {
    const result = execSync(
      PLATFORM === 'win32' ? `where ${cmd} 2>nul` : `which ${cmd} 2>/dev/null`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim().split('\n')[0].trim();
    return result || null;
  } catch { return null; }
}

/** Resolve XDG_CONFIG_HOME or fall back to ~/.config */
const XDG_CONFIG = process.env.XDG_CONFIG_HOME || join(HOME, '.config');

/** Return all paths from the list that actually exist on disk */
function existing(...paths) {
  return paths.filter(Boolean).filter(existsSync);
}

// ─── Client builders ──────────────────────────────────────────────────────────

/**
 * Build a client descriptor.
 * configPaths: array of all candidate paths — every existing one gets updated.
 * key:    dot-path into the JSON object where mcpServers lives (e.g. 'mcpServers', 'servers', 'cody.mcpServers')
 * format: 'standard' | 'vscode' | 'zed'
 */
function makeClients(name, configPaths, { key = 'mcpServers', format = 'standard' } = {}) {
  return existing(...configPaths).map(configPath => ({
    name,
    configPath,
    read:     parseJson,
    hasEntry: () => false, // always overwrite — keeps absolute paths current
    inject:   (obj) => {
      if (format === 'zed') {
        obj.context_servers ??= {};
        obj.context_servers[MCP_KEY] = { command: { path: NODE_PATH, args: [ENTRY_POINT] } };
      } else {
        // Support dot-path keys like 'cody.mcpServers'
        const parts = key.split('.');
        let ref = obj;
        for (let i = 0; i < parts.length - 1; i++) { ref[parts[i]] ??= {}; ref = ref[parts[i]]; }
        ref[parts[parts.length - 1]] ??= {};
        ref[parts[parts.length - 1]][MCP_KEY] = MCP_ENTRY;
      }
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  }));
}

// ─── Client Registry ──────────────────────────────────────────────────────────

function getClients() {
  const clients = [];

  // ── Claude Desktop ──────────────────────────────────────────────────────────
  clients.push(...makeClients('Claude Desktop', [
    // macOS
    join(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    // Linux
    join(XDG_CONFIG, 'Claude', 'claude_desktop_config.json'),
    // Windows standard
    join(APPDATA, 'Claude', 'claude_desktop_config.json'),
    // Windows MSIX store version (virtualized path)
    join(LAPPDATA, 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  ]));

  // ── Claude Code (VS Code extension + CLI) ────────────────────────────────────
  // Source: extension.js → j = join(CLAUDE_CONFIG_DIR || homedir(), ".claude.json")
  const claudeJsonDir = process.env.CLAUDE_CONFIG_DIR || HOME;
  clients.push(...makeClients('Claude Code', [
    join(claudeJsonDir, '.claude.json'),
    // Older versions wrote to ~/.claude/settings.json
    join(HOME, '.claude', 'settings.json'),
  ]));

  // ── Cursor ───────────────────────────────────────────────────────────────────
  // Detect install: check executable + all known config locations
  const cursorInstalled = which('cursor') ||
    existsSync('/Applications/Cursor.app') ||
    existsSync(join(APPDATA, 'Programs', 'cursor', 'Cursor.exe')) ||
    existsSync(join(HOME, '.cursor', 'mcp.json')); // config exists = was installed

  if (cursorInstalled) {
    clients.push(...makeClients('Cursor', [
      join(HOME, '.cursor', 'mcp.json'),               // macOS + Linux
      join(USERPROFILE, '.cursor', 'mcp.json'),         // Windows (USERPROFILE ≠ HOME sometimes)
      join(APPDATA, 'Cursor', 'mcp.json'),              // Windows alternate
    ]));
  }

  // ── Windsurf ─────────────────────────────────────────────────────────────────
  const windsurfInstalled = which('windsurf') ||
    existsSync('/Applications/Windsurf.app') ||
    existsSync(join(HOME, '.codeium', 'windsurf', 'mcp_config.json'));

  if (windsurfInstalled) {
    clients.push(...makeClients('Windsurf', [
      join(HOME, '.codeium', 'windsurf', 'mcp_config.json'),
      join(USERPROFILE, '.codeium', 'windsurf', 'mcp_config.json'),
      join(APPDATA, 'Codeium', 'windsurf', 'mcp_config.json'),
    ]));
  }

  // ── VS Code — GitHub Copilot native MCP (mcp.json, "servers" key) ────────────
  // Check all VS Code variants: stable, insiders, OSS, Codium
  const vscodeVariants = [
    { name: 'VS Code (Copilot)', dirs: ['Code', 'code'] },
    { name: 'VS Code Insiders',  dirs: ['Code - Insiders', 'code-insiders'] },
    { name: 'VSCodium',          dirs: ['VSCodium', 'vscodium'] },
  ];
  for (const { name, dirs } of vscodeVariants) {
    const paths = dirs.flatMap(dir => [
      join(HOME, 'Library', 'Application Support', dir, 'User', 'mcp.json'),  // macOS
      join(XDG_CONFIG, dir, 'User', 'mcp.json'),                               // Linux XDG
      join(HOME, `.${dir.toLowerCase()}`, 'User', 'mcp.json'),                 // Linux alt
      join(APPDATA, dir, 'User', 'mcp.json'),                                  // Windows
    ]);
    clients.push(...makeClients(name, paths, { key: 'servers' }));
  }

  // ── Cline (VS Code extension — own settings file in globalStorage) ────────────
  const clineVariants = [
    { name: 'Cline', extId: 'saoudrizwan.claude-dev' },
    { name: 'Cline (fork)',  extId: 'cline.cline' },
  ];
  const vscodeStorageDirs = [
    join(HOME, 'Library', 'Application Support', 'Code', 'User', 'globalStorage'),
    join(XDG_CONFIG, 'Code', 'User', 'globalStorage'),
    join(APPDATA, 'Code', 'User', 'globalStorage'),
  ];
  for (const { name, extId } of clineVariants) {
    clients.push(...makeClients(name,
      vscodeStorageDirs.map(d => join(d, extId, 'settings', 'cline_mcp_settings.json'))
    ));
  }

  // ── Cody (Sourcegraph VS Code extension) ─────────────────────────────────────
  // Uses "cody.mcpServers" key inside VS Code settings.json
  const vscodeSettingsPaths = [
    join(HOME, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
    join(XDG_CONFIG, 'Code', 'User', 'settings.json'),
    join(APPDATA, 'Code', 'User', 'settings.json'),
  ];
  clients.push(...makeClients('Cody (Sourcegraph)', vscodeSettingsPaths, { key: 'cody.mcpServers' }));

  // ── Zed ───────────────────────────────────────────────────────────────────────
  clients.push(...makeClients('Zed', [
    join(XDG_CONFIG, 'zed', 'settings.json'),
    join(HOME, 'Library', 'Application Support', 'Zed', 'settings.json'),
    join(APPDATA, 'Zed', 'settings.json'),
  ], { format: 'zed' }));

  // ── Continue ──────────────────────────────────────────────────────────────────
  clients.push(...makeClients('Continue', [
    join(HOME, '.continue', 'config.json'),
    join(USERPROFILE, '.continue', 'config.json'),
    join(XDG_CONFIG, 'continue', 'config.json'),
  ]));

  // ── OpenCode ──────────────────────────────────────────────────────────────────
  const opencodeDir = process.env.OPENCODE_CONFIG_DIR || join(XDG_CONFIG, 'opencode');
  clients.push(...makeClients('OpenCode', [
    join(opencodeDir, 'opencode.json'),
    join(HOME, '.config', 'opencode', 'opencode.json'), // fallback if XDG not set
  ]));

  // ── Roo Code (VS Code extension, fork of Cline) ───────────────────────────────
  clients.push(...makeClients('Roo Code',
    vscodeStorageDirs.map(d => join(d, 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'))
  ));

  // Deduplicate — same physical path may appear from multiple candidate arrays
  const seen = new Set();
  return clients.filter(c => {
    if (seen.has(c.configPath)) return false;
    seen.add(c.configPath);
    return true;
  });
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

function processClient(client) {
  const { name, configPath } = client;
  if (!existsSync(configPath)) return { name, status: 'skipped' };

  let raw;
  try { raw = readFileSync(configPath, 'utf-8'); }
  catch (err) { return { name, status: 'error', reason: `Could not read: ${err.message}` }; }

  let obj;
  try { obj = client.read(raw); }
  catch { return { name, status: 'error', reason: 'Invalid JSON — skipping to avoid corruption' }; }

  if (client.hasEntry(obj)) return { name, status: 'already' };

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
  if (!existsSync(ENTRY_POINT)) return; // not a global install — skip

  const clients = getClients();
  const results = clients.map(processClient);

  const configured = results.filter(r => r.status === 'configured');
  const errors     = results.filter(r => r.status === 'error');
  const skipped    = results.filter(r => r.status === 'skipped');

  if (configured.length === 0 && errors.length === 0 && skipped.length === clients.length) return;

  console.log('\n[browser-control-mcp] Configuring AI clients...');
  for (const r of results) {
    if (r.status === 'configured') console.log(`  ✓ ${r.name}`);
    else if (r.status === 'error') console.warn(`  ✗ ${r.name} — ${r.reason}`);
  }
  if (configured.length > 0) {
    console.log('[browser-control-mcp] Done. Restart your AI client to activate browser-control.\n');
  }
}
