#!/usr/bin/env node

/**
 * Post-install script:
 * 1. Checks if Chrome/Chromium is available for puppeteer-core.
 * 2. Auto-configures browser-control MCP entry in all detected AI clients.
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { setupClients } from './setup.js';

const CANDIDATES = {
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
};

function findChrome() {
  const os = platform();
  const paths = CANDIDATES[os] || CANDIDATES.linux;

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  // Try which command on unix
  if (os !== 'win32') {
    try {
      const result = execSync('which google-chrome || which chromium || which chromium-browser 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      if (result) return result;
    } catch {
      // not found
    }
  }

  // Check CHROME_PATH env
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  return null;
}

function main() {
  const chromePath = findChrome();

  if (chromePath) {
    console.log(`[browser-control-mcp] Chrome found at: ${chromePath}`);
    return;
  }

  const os = platform();

  console.warn('\n[browser-control-mcp] Chrome/Chromium not found on this system.');
  console.warn('The browser-control MCP server requires Chrome or Chromium to run.\n');

  if (os === 'linux') {
    console.warn('Install Chrome with one of these commands:');
    console.warn('  Ubuntu/Debian:  sudo apt-get install -y chromium-browser');
    console.warn('  Fedora/RHEL:    sudo dnf install -y chromium');
    console.warn('  Arch:           sudo pacman -S chromium');
    console.warn('  Alpine:         sudo apk add chromium');
  } else if (os === 'darwin') {
    console.warn('Install Chrome:');
    console.warn('  Download: https://www.google.com/chrome/');
    console.warn('  Homebrew: brew install --cask google-chrome');
  } else if (os === 'win32') {
    console.warn('Install Chrome:');
    console.warn('  Download: https://www.google.com/chrome/');
  }

  console.warn('\nOr set CHROME_PATH environment variable to your Chrome executable path.\n');
}

main();

// Auto-configure all detected AI clients
try {
  setupClients();
} catch (err) {
  // Never fail npm install due to setup errors
  console.warn('[browser-control-mcp] Client setup encountered an error:', err.message);
}
