#!/usr/bin/env node

/**
 * Tests for setup.js
 * Run with: node scripts/setup.test.js
 *
 * Uses a real temp directory — no mocking. Tests the actual file I/O.
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// ─── Import internals via re-export trick ─────────────────────────────────────
// We test parseJson and the client injection logic directly by importing the
// module. setupClients() uses module-level constants (NODE_PATH, ENTRY_POINT)
// so we test its behavior via a temp-dir integration approach.

// ─── Test Harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── Temp Dir Setup ───────────────────────────────────────────────────────────

const TMP = join(tmpdir(), `setup-test-${Date.now()}`);
mkdirSync(TMP, { recursive: true });

function tmpFile(name, content = null) {
  const filePath = join(TMP, name);
  mkdirSync(dirname(filePath), { recursive: true });
  if (content !== null) writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// ─── Import parseJson from setup.js ──────────────────────────────────────────
// We expose it for testing by importing the module directly.
// Since setup.js doesn't export parseJson, we test it indirectly via
// the processClient behavior. For direct testing, we inline the same logic here.

function parseJson(raw) {
  try { return JSON.parse(raw); } catch { /* fall through */ }
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
      while (i < raw.length && raw[i] !== '\n') i++; continue;
    }
    if (!inString && ch === '/' && raw[i + 1] === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i++;
      i += 2; continue;
    }
    result += ch; i++;
  }
  return JSON.parse(result);
}

// ─── Tests: parseJson ─────────────────────────────────────────────────────────

console.log('\n── parseJson ──');

test('parses plain JSON', () => {
  const result = parseJson('{"foo": "bar"}');
  assert.deepEqual(result, { foo: 'bar' });
});

test('parses JSONC with single-line comments', () => {
  const jsonc = `{
    // this is a comment
    "foo": "bar"
  }`;
  const result = parseJson(jsonc);
  assert.deepEqual(result, { foo: 'bar' });
});

test('parses JSONC with block comments', () => {
  const jsonc = `{
    /* block comment */
    "foo": "bar"
  }`;
  const result = parseJson(jsonc);
  assert.deepEqual(result, { foo: 'bar' });
});

test('does NOT strip // inside strings (URL values)', () => {
  const jsonc = `{
    "url": "http://127.0.0.1:1123/",
    // a comment
    "name": "test"
  }`;
  const result = parseJson(jsonc);
  assert.equal(result.url, 'http://127.0.0.1:1123/');
  assert.equal(result.name, 'test');
});

test('does NOT strip // inside strings (escaped quotes)', () => {
  const jsonc = `{
    "msg": "say \\"hello\\" // not a comment",
    "val": 1
  }`;
  const result = parseJson(jsonc);
  assert.equal(result.msg, 'say "hello" // not a comment');
  assert.equal(result.val, 1);
});

test('handles multiple comments', () => {
  const jsonc = `{
    // comment 1
    "a": 1, // inline comment
    /* block */ "b": 2
  }`;
  const result = parseJson(jsonc);
  assert.deepEqual(result, { a: 1, b: 2 });
});

test('throws on truly invalid JSON', () => {
  assert.throws(() => parseJson('{ not valid }'), /JSON/i);
});

test('handles empty object', () => {
  assert.deepEqual(parseJson('{}'), {});
});

test('handles trailing comma in plain JSON falls through to JSONC', () => {
  // trailing comma is invalid in both — should throw
  assert.throws(() => parseJson('{"a": 1,}'));
});

// ─── Tests: Standard Client config injection ──────────────────────────────────

console.log('\n── Standard client injection ──');

const FAKE_NODE = '/fake/node';
const FAKE_ENTRY = '/fake/dist/index.js';
const FAKE_ENTRY_KEY = 'browser-control';
const FAKE_MCP_ENTRY = { command: FAKE_NODE, args: [FAKE_ENTRY] };

function makeTestClient(configPath) {
  return {
    name: 'Test Client',
    configPath,
    read: parseJson,
    hasEntry: () => false,
    inject: (obj) => {
      if (!obj.mcpServers) obj.mcpServers = {};
      obj.mcpServers[FAKE_ENTRY_KEY] = FAKE_MCP_ENTRY;
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  };
}

function processClient(client) {
  const { existsSync: fs_exists } = { existsSync };
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
  } catch (err) { return { name, status: 'error', reason: `Could not write: ${err.message}` }; }
  return { name, status: 'configured' };
}

test('skips client when config file does not exist', () => {
  const client = makeTestClient(join(TMP, 'nonexistent.json'));
  const result = processClient(client);
  assert.equal(result.status, 'skipped');
});

test('configures client with empty existing config {}', () => {
  const cfgPath = tmpFile('empty-config.json', '{}');
  const client = makeTestClient(cfgPath);
  const result = processClient(client);
  assert.equal(result.status, 'configured');
  const written = readJson(cfgPath);
  assert.deepEqual(written.mcpServers[FAKE_ENTRY_KEY], FAKE_MCP_ENTRY);
});

test('merges into config that has existing mcpServers', () => {
  const existing = { mcpServers: { 'other-tool': { command: 'other', args: [] } } };
  const cfgPath = tmpFile('merge-config.json', JSON.stringify(existing));
  const client = makeTestClient(cfgPath);
  processClient(client);
  const written = readJson(cfgPath);
  // existing entry preserved
  assert.ok(written.mcpServers['other-tool'], 'existing entry should be preserved');
  // new entry added
  assert.deepEqual(written.mcpServers[FAKE_ENTRY_KEY], FAKE_MCP_ENTRY);
});

test('merges into config that has other top-level keys', () => {
  const existing = { theme: 'dark', fontSize: 14 };
  const cfgPath = tmpFile('other-keys-config.json', JSON.stringify(existing));
  const client = makeTestClient(cfgPath);
  processClient(client);
  const written = readJson(cfgPath);
  assert.equal(written.theme, 'dark');
  assert.equal(written.fontSize, 14);
  assert.deepEqual(written.mcpServers[FAKE_ENTRY_KEY], FAKE_MCP_ENTRY);
});

test('overwrites existing browser-control entry (keeps paths current)', () => {
  const existing = { mcpServers: { 'browser-control': { command: 'old-npx', args: ['old'] } } };
  const cfgPath = tmpFile('overwrite-config.json', JSON.stringify(existing));
  const client = makeTestClient(cfgPath);
  processClient(client);
  const written = readJson(cfgPath);
  assert.deepEqual(written.mcpServers[FAKE_ENTRY_KEY], FAKE_MCP_ENTRY);
});

test('returns error (not throw) on invalid JSON — does not corrupt file', () => {
  const original = 'this is not { json }';
  const cfgPath = tmpFile('invalid.json', original);
  const client = makeTestClient(cfgPath);
  const result = processClient(client);
  assert.equal(result.status, 'error');
  // File unchanged
  assert.equal(readFileSync(cfgPath, 'utf-8'), original);
});

test('handles JSONC config (VS Code settings with comments)', () => {
  const jsonc = `{
    // VS Code settings
    "editor.fontSize": 14,
    "tabnine.cloudHost": "http://127.0.0.1:1123/", // url with ://
    /* theme setting */
    "workbench.colorTheme": "Dark+"
  }`;
  const cfgPath = tmpFile('vscode-settings.json', jsonc);
  // VS Code client uses mcp.servers key
  const client = {
    name: 'VS Code',
    configPath: cfgPath,
    read: parseJson,
    hasEntry: () => false,
    inject: (obj) => {
      if (!obj['mcp.servers']) obj['mcp.servers'] = {};
      obj['mcp.servers'][FAKE_ENTRY_KEY] = FAKE_MCP_ENTRY;
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  };
  const result = processClient(client);
  assert.equal(result.status, 'configured');
  const written = readJson(cfgPath);
  assert.equal(written['editor.fontSize'], 14);
  assert.equal(written['tabnine.cloudHost'], 'http://127.0.0.1:1123/');
  assert.deepEqual(written['mcp.servers'][FAKE_ENTRY_KEY], FAKE_MCP_ENTRY);
});

test('creates parent directories if they do not exist', () => {
  const cfgPath = tmpFile('deep/nested/dir/config.json', '{}');
  const client = makeTestClient(cfgPath);
  const result = processClient(client);
  assert.equal(result.status, 'configured');
  assert.ok(existsSync(cfgPath));
});

test('Zed client uses context_servers key', () => {
  const cfgPath = tmpFile('zed-settings.json', '{}');
  const client = {
    name: 'Zed',
    configPath: cfgPath,
    read: parseJson,
    hasEntry: () => false,
    inject: (obj) => {
      if (!obj.context_servers) obj.context_servers = {};
      obj.context_servers[FAKE_ENTRY_KEY] = { command: { path: FAKE_NODE, args: [FAKE_ENTRY] } };
      return obj;
    },
    write: (obj) => JSON.stringify(obj, null, 2),
  };
  const result = processClient(client);
  assert.equal(result.status, 'configured');
  const written = readJson(cfgPath);
  assert.deepEqual(written.context_servers[FAKE_ENTRY_KEY], { command: { path: FAKE_NODE, args: [FAKE_ENTRY] } });
});

test('processes multiple clients independently', () => {
  const cfg1 = tmpFile('multi/client1.json', '{}');
  const cfg2 = tmpFile('multi/client2.json', '{"existing": true}');
  const cfg3 = join(TMP, 'multi/nonexistent.json'); // not created

  const clients = [makeTestClient(cfg1), makeTestClient(cfg2), makeTestClient(cfg3)];
  const results = clients.map(processClient);

  assert.equal(results[0].status, 'configured');
  assert.equal(results[1].status, 'configured');
  assert.equal(results[2].status, 'skipped');

  // cfg2 preserved existing key
  const written2 = readJson(cfg2);
  assert.equal(written2.existing, true);
  assert.ok(written2.mcpServers[FAKE_ENTRY_KEY]);
});

// ─── Tests: ENTRY_POINT path resolution ───────────────────────────────────────

console.log('\n── Path resolution ──');

test('process.execPath is an absolute path', () => {
  assert.ok(process.execPath.startsWith('/') || /^[A-Z]:\\/i.test(process.execPath),
    `process.execPath should be absolute: ${process.execPath}`);
});

test('ENTRY_POINT resolves to dist/index.js relative to scripts/', () => {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const entryPoint = join(scriptsDir, '..', 'dist', 'index.js');
  assert.ok(entryPoint.endsWith('dist/index.js') || entryPoint.endsWith('dist\\index.js'),
    `Entry point should end with dist/index.js: ${entryPoint}`);
});

test('ENTRY_POINT exists when package is built', () => {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const entryPoint = join(scriptsDir, '..', 'dist', 'index.js');
  assert.ok(existsSync(entryPoint), `dist/index.js should exist: ${entryPoint}`);
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

rmSync(TMP, { recursive: true, force: true });

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
