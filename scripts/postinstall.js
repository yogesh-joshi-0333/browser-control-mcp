#!/usr/bin/env node

/**
 * Post-install script: ensures Chrome/Chromium is available for puppeteer-core.
 * - On Linux: installs chromium-browser via apt if not found
 * - On macOS/Windows: shows a helpful message if Chrome is missing
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';

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

function autoInstallLinux() {
  console.log('\n[browser-control-mcp] Chrome/Chromium not found. Attempting auto-install...\n');

  const managers = [
    { check: 'which apt-get', install: 'sudo apt-get update -qq && sudo apt-get install -y -qq chromium-browser || sudo apt-get install -y -qq chromium' },
    { check: 'which dnf', install: 'sudo dnf install -y chromium' },
    { check: 'which yum', install: 'sudo yum install -y chromium' },
    { check: 'which pacman', install: 'sudo pacman -S --noconfirm chromium' },
    { check: 'which apk', install: 'sudo apk add chromium' },
  ];

  for (const mgr of managers) {
    try {
      execSync(mgr.check, { stdio: 'pipe' });
      console.log(`[browser-control-mcp] Installing Chromium via ${mgr.check.split(' ')[1]}...`);
      execSync(mgr.install, { stdio: 'inherit' });

      // Verify it worked
      const found = findChrome();
      if (found) {
        console.log(`[browser-control-mcp] Chromium installed successfully at: ${found}\n`);
        return true;
      }
    } catch {
      // try next package manager
    }
  }

  return false;
}

function main() {
  const chromePath = findChrome();

  if (chromePath) {
    console.log(`[browser-control-mcp] Chrome found at: ${chromePath}`);
    return;
  }

  const os = platform();

  if (os === 'linux') {
    const installed = autoInstallLinux();
    if (installed) return;

    console.error('\n[browser-control-mcp] Could not auto-install Chromium.');
    console.error('Please install manually:');
    console.error('  Ubuntu/Debian: sudo apt-get install -y chromium-browser');
    console.error('  Fedora:        sudo dnf install -y chromium');
    console.error('  Arch:          sudo pacman -S chromium');
    console.error('  Or set CHROME_PATH=/path/to/chrome\n');
  } else if (os === 'darwin') {
    console.error('\n[browser-control-mcp] Chrome not found.');
    console.error('Please install Google Chrome from: https://www.google.com/chrome/');
    console.error('Or install via Homebrew: brew install --cask google-chrome');
    console.error('Or set CHROME_PATH=/path/to/chrome\n');
  } else if (os === 'win32') {
    console.error('\n[browser-control-mcp] Chrome not found.');
    console.error('Please install Google Chrome from: https://www.google.com/chrome/');
    console.error('Or set CHROME_PATH=C:\\path\\to\\chrome.exe\n');
  }
}

main();
