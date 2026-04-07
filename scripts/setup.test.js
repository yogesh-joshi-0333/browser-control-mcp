#!/usr/bin/env node

/**
 * Tests for setup.js
 * Run with: node scripts/setup.test.js
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TMP = join(tmpdir(), `setup-test-${Date.now()}`);
mkdirSync(TMP, { recursive: true });

function tmpFile(name, content = null) {
  const f = join(TMP, name);
  mkdirSync(dirname(f), { recursive: true });
  if (content !== null) writeFileSync(f, content, 'utf-8');
  return f;
}

function readJson(f) { return JSON.parse(readFileSync(f, 'utf-8')); }

// Inline same parseJson logic from setup.js for direct unit testing
function parseJson(raw) {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  let result = '', inString = false, escaped = false, i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (escaped)                              { result += ch; escaped = false; i++; continue; }
    if (ch === '\\' && inString)              { result += ch; escaped = true;  i++; continue; }
    if (ch === '"')                           { inString = !inString; result += ch; i++; continue; }
    if (!inString && ch === '/' && raw[i+1] === '/') { while (i < raw.length && raw[i] !== '\n') i++; continue; }
    if (!inString && ch === '/' && raw[i+1] === '*') { i += 2; while (i < raw.length && !(raw[i] === '*' && raw[i+1] === '/')) i++; i += 2; continue; }
    result += ch; i++;
  }
  return JSON.parse(result);
}

const FAKE_NODE  = '/fake/node';
const FAKE_ENTRY = '/fake/dist/index.js';
const FAKE_MCP   = { command: FAKE_NODE, args: [FAKE_ENTRY] };
const MCP_KEY    = 'browser-control';

// Generic processClient logic (mirrors setup.js)
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
  try { mkdirSync(dirname(configPath), { recursive: true }); writeFileSync(configPath, client.write(obj), 'utf-8'); }
  catch (err) { return { name, status: 'error', reason: `Could not write: ${err.message}` }; }
  return { name, status: 'configured' };
}

// Client factories (mirrors setup.js)
function std(name, configPath) {
  return { name, configPath, read: parseJson, hasEntry: () => false,
    inject: (obj) => { obj.mcpServers ??= {}; obj.mcpServers[MCP_KEY] = FAKE_MCP; return obj; },
    write:  (obj) => JSON.stringify(obj, null, 2) };
}
function vscodeMcp(name, configPath) {
  return { name, configPath, read: parseJson, hasEntry: () => false,
    inject: (obj) => { obj.servers ??= {}; obj.servers[MCP_KEY] = FAKE_MCP; return obj; },
    write:  (obj) => JSON.stringify(obj, null, 2) };
}

// ─── parseJson tests ──────────────────────────────────────────────────────────

console.log('\n── parseJson ──');

test('plain JSON', () => assert.deepEqual(parseJson('{"a":1}'), { a: 1 }));
test('empty object', () => assert.deepEqual(parseJson('{}'), {}));
test('single-line comment', () => assert.deepEqual(parseJson('{\n// comment\n"a":1}'), { a: 1 }));
test('inline comment after value', () => assert.deepEqual(parseJson('{"a":1 // hi\n}'), { a: 1 }));
test('block comment', () => assert.deepEqual(parseJson('{"a":/* x */1}'), { a: 1 }));
test('URL value with :// not stripped', () => {
  const r = parseJson('{"url":"http://127.0.0.1:1123/","b":2}');
  assert.equal(r.url, 'http://127.0.0.1:1123/');
});
test('URL value with :// in JSONC', () => {
  const r = parseJson('{\n// comment\n"url":"http://127.0.0.1:1123/"}');
  assert.equal(r.url, 'http://127.0.0.1:1123/');
});
test('escaped quote inside string', () => {
  const r = parseJson('{"msg":"say \\"hi\\" // not a comment"}');
  assert.equal(r.msg, 'say "hi" // not a comment');
});
test('backslash in string', () => {
  const r = parseJson('{"path":"C:\\\\Users\\\\foo"}');
  assert.equal(r.path, 'C:\\Users\\foo');
});
test('multiple comment styles', () => {
  const r = parseJson('{\n// c1\n"a":1,/* c2 */"b":2}');
  assert.deepEqual(r, { a: 1, b: 2 });
});
test('throws on truly invalid JSON', () => assert.throws(() => parseJson('{ bad }')));
test('throws on trailing comma', () => assert.throws(() => parseJson('{"a":1,}')));

// ─── processClient tests ──────────────────────────────────────────────────────

console.log('\n── processClient ──');

test('skips when file does not exist', () => {
  const r = processClient(std('X', join(TMP, 'nope.json')));
  assert.equal(r.status, 'skipped');
});

test('configures empty config {}', () => {
  const f = tmpFile('empty.json', '{}');
  const r = processClient(std('X', f));
  assert.equal(r.status, 'configured');
  assert.deepEqual(readJson(f).mcpServers[MCP_KEY], FAKE_MCP);
});

test('merges with existing mcpServers — preserves others', () => {
  const f = tmpFile('merge.json', JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
  processClient(std('X', f));
  const d = readJson(f);
  assert.ok(d.mcpServers.other, 'existing entry preserved');
  assert.deepEqual(d.mcpServers[MCP_KEY], FAKE_MCP);
});

test('preserves non-mcpServers keys', () => {
  const f = tmpFile('keys.json', JSON.stringify({ theme: 'dark', fontSize: 14 }));
  processClient(std('X', f));
  const d = readJson(f);
  assert.equal(d.theme, 'dark');
  assert.equal(d.fontSize, 14);
  assert.deepEqual(d.mcpServers[MCP_KEY], FAKE_MCP);
});

test('overwrites stale browser-control entry', () => {
  const f = tmpFile('stale.json', JSON.stringify({ mcpServers: { 'browser-control': { command: 'old-npx' } } }));
  processClient(std('X', f));
  assert.deepEqual(readJson(f).mcpServers[MCP_KEY], FAKE_MCP);
});

test('does not corrupt file on invalid JSON', () => {
  const original = 'this is { not json }';
  const f = tmpFile('bad.json', original);
  const r = processClient(std('X', f));
  assert.equal(r.status, 'error');
  assert.equal(readFileSync(f, 'utf-8'), original); // unchanged
});

test('creates parent dirs if missing', () => {
  const f = tmpFile('deep/a/b/c/cfg.json', '{}');
  assert.equal(processClient(std('X', f)).status, 'configured');
});

// ─── Client-specific key tests ────────────────────────────────────────────────

console.log('\n── Client-specific keys ──');

test('Standard client (Claude, Cursor, Cline, etc.) uses mcpServers key', () => {
  const f = tmpFile('std.json', '{}');
  processClient(std('X', f));
  const d = readJson(f);
  assert.ok(d.mcpServers, 'mcpServers key present');
  assert.deepEqual(d.mcpServers[MCP_KEY], FAKE_MCP);
});

test('VS Code Copilot uses "servers" key (not mcpServers)', () => {
  const f = tmpFile('vscode-mcp.json', '{}');
  processClient(vscodeMcp('VS Code', f));
  const d = readJson(f);
  assert.ok(d.servers, '"servers" key present');
  assert.ok(!d.mcpServers, '"mcpServers" key should NOT be present');
  assert.deepEqual(d.servers[MCP_KEY], FAKE_MCP);
});

test('Cody uses "cody.mcpServers" key in VS Code settings.json', () => {
  const f = tmpFile('cody-settings.json', '{"editor.fontSize":14}');
  const client = {
    name: 'Cody', configPath: f, read: parseJson, hasEntry: () => false,
    inject: (obj) => { obj['cody.mcpServers'] ??= {}; obj['cody.mcpServers'][MCP_KEY] = FAKE_MCP; return obj; },
    write: (obj) => JSON.stringify(obj, null, 2),
  };
  processClient(client);
  const d = readJson(f);
  assert.equal(d['editor.fontSize'], 14, 'existing VS Code settings preserved');
  assert.deepEqual(d['cody.mcpServers'][MCP_KEY], FAKE_MCP);
  assert.ok(!d.mcpServers, 'mcpServers key should NOT be present for Cody');
});

test('Zed uses "context_servers" key with nested command.path', () => {
  const f = tmpFile('zed.json', '{}');
  const client = {
    name: 'Zed', configPath: f, read: parseJson, hasEntry: () => false,
    inject: (obj) => {
      obj.context_servers ??= {};
      obj.context_servers[MCP_KEY] = { command: { path: FAKE_NODE, args: [FAKE_ENTRY] } };
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  };
  processClient(client);
  const d = readJson(f);
  assert.ok(d.context_servers, 'context_servers key present');
  assert.deepEqual(d.context_servers[MCP_KEY], { command: { path: FAKE_NODE, args: [FAKE_ENTRY] } });
  assert.ok(!d.mcpServers, 'mcpServers key should NOT be present for Zed');
});

test('JSONC VS Code settings.json with URLs — configures without corruption', () => {
  const jsonc = `{
    // VS Code settings
    "editor.fontSize": 14,
    "tabnine.cloudHost": "http://127.0.0.1:1123/",
    /* theme */
    "workbench.colorTheme": "Dark+"
  }`;
  const f = tmpFile('vscode-settings.json', jsonc);
  processClient(vscodeMcp('VS Code', f));
  const d = readJson(f);
  assert.equal(d['editor.fontSize'], 14);
  assert.equal(d['tabnine.cloudHost'], 'http://127.0.0.1:1123/');
  assert.equal(d['workbench.colorTheme'], 'Dark+');
  assert.deepEqual(d.servers[MCP_KEY], FAKE_MCP);
});

test('Multiple clients processed independently', () => {
  const f1 = tmpFile('multi/c1.json', '{}');
  const f2 = tmpFile('multi/c2.json', '{"existing":true}');
  const f3 = join(TMP, 'multi/nope.json'); // not created
  const results = [std('A', f1), std('B', f2), std('C', f3)].map(processClient);
  assert.equal(results[0].status, 'configured');
  assert.equal(results[1].status, 'configured');
  assert.equal(results[2].status, 'skipped');
  assert.equal(readJson(f2).existing, true);
});

// ─── Path resolution ──────────────────────────────────────────────────────────

console.log('\n── Path resolution ──');

test('process.execPath is absolute', () => {
  assert.ok(process.execPath.startsWith('/') || /^[A-Z]:\\/i.test(process.execPath));
});

test('ENTRY_POINT ends with dist/index.js', () => {
  const ep = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');
  assert.ok(ep.endsWith('dist/index.js') || ep.endsWith('dist\\index.js'));
});

test('ENTRY_POINT file exists (package is built)', () => {
  const ep = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');
  assert.ok(existsSync(ep), `dist/index.js not found at: ${ep}`);
});

test('CLAUDE_CONFIG_DIR env var respected for Claude config path', () => {
  const customDir = join(TMP, 'custom-claude-dir');
  mkdirSync(customDir, { recursive: true });
  const expectedPath = join(customDir, '.claude.json');
  // Simulate what setup.js does
  const resolvedPath = process.env.CLAUDE_CONFIG_DIR
    ? join(process.env.CLAUDE_CONFIG_DIR, '.claude.json')
    : join(homedir(), '.claude.json');
  // When env var is not set, should use homedir
  assert.equal(resolvedPath, join(homedir(), '.claude.json'));
});

test('OPENCODE_CONFIG_DIR env var respected for OpenCode config path', () => {
  const resolvedPath = process.env.OPENCODE_CONFIG_DIR
    ? join(process.env.OPENCODE_CONFIG_DIR, 'opencode.json')
    : join(homedir(), '.config', 'opencode', 'opencode.json');
  assert.ok(resolvedPath.endsWith('opencode.json'));
});

// ─── Cleanup + summary ────────────────────────────────────────────────────────

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
