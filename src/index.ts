#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { statusTool } from './tools/status.js';
import { screenshotTool } from './tools/screenshot.js';
import { getUrlTool } from './tools/get-url.js';
import { navigateTool } from './tools/navigate.js';
import { clickTool } from './tools/click.js';
import { scrollTool } from './tools/scroll.js';
import { typeTool } from './tools/type.js';
import { getDomTool } from './tools/get-dom.js';
import { consoleLogsTool } from './tools/console-logs.js';
import { selectModeTool } from './tools/select-mode.js';
import { startWebSocketServer, stopWebSocketServer } from './websocket.js';
import { destroyAll } from './puppeteer-manager.js';
import { WS_PORT } from './config.js';
import type { ITool } from './types.js';

const tools: ITool[] = [
  statusTool,
  selectModeTool,
  screenshotTool,
  getUrlTool,
  navigateTool,
  clickTool,
  scrollTool,
  typeTool,
  getDomTool,
  consoleLogsTool
];

async function shutdown(): Promise<void> {
  logger.info('Shutting down browser-control MCP server...');
  await stopWebSocketServer();
  await destroyAll();
  process.exit(0);
}

async function main(): Promise<void> {
  await startWebSocketServer(WS_PORT);

  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT', () => { void shutdown(); });

  const server = new McpServer(
    { name: 'browser-control', version: '1.0.0' },
    {
      capabilities: { logging: {} },
      instructions: [
        'You have FULL BROWSER CONTROL through this MCP server. You CAN and SHOULD open browsers, navigate to any website, interact with web pages, and see what is on screen. You are NOT limited to fetching data — you have a real browser that renders pages, runs JavaScript, and lets you interact just like a human user.',
        '',
        '=== CAPABILITIES ===',
        'You can do ALL of the following:',
        '- Open a browser (headless background browser OR the user\'s real Chrome via extension)',
        '- Navigate to ANY URL: public websites, localhost, web apps, admin panels, any page',
        '- Take screenshots and visually analyze what you see (layout, design, content, errors)',
        '- Click ANY element: buttons, links, menus, dropdowns, tabs, checkboxes, radio buttons',
        '- Fill out forms: type into text inputs, search bars, textareas, login fields, any input',
        '- Submit forms: fill fields then click submit/send/login buttons',
        '- Scroll pages: up, down, left, right by any pixel amount',
        '- Read the full HTML/DOM source of any page for structural analysis',
        '- Check JavaScript console logs, errors, warnings for debugging',
        '- Open pages at any viewport size (desktop, tablet, mobile) with custom width/height',
        '- Maintain browser sessions: navigate multiple pages, stay logged in, keep cookies',
        '- Run multi-step flows: login → navigate → fill form → submit → verify result',
        '',
        '=== TWO BROWSER MODES ===',
        '1. HEADLESS MODE (mode="headless"): Opens an invisible background browser (Puppeteer).',
        '   - Best for: automated tasks, testing, checking websites, form submission, screenshots',
        '   - Supports custom viewport sizes via width/height params on browser_navigate',
        '   - Default viewport: 1024x768 pixels',
        '   - Has anti-bot detection bypass (spoofed user agent, no webdriver flag)',
        '   - Sessions persist: the sessionId returned lets you reuse the same browser across calls',
        '',
        '2. EXTENSION MODE (mode="extension"): Controls the user\'s real Chrome browser.',
        '   - Best for: seeing what the user sees, debugging their actual browser tab',
        '   - Requires Chrome Extension to be installed and connected',
        '   - Works on whatever tab the user has open',
        '',
        '=== HOW TO USE — STEP BY STEP ===',
        'Step 1: Call browser_select_mode to check what modes are available and set a default.',
        '  - If extension is connected: ask user which mode they prefer',
        '  - If extension is NOT connected: headless is auto-selected',
        'Step 2: Call browser_navigate with a URL to open the page.',
        '  - Pass width and height to set viewport size (e.g. width=375, height=812 for mobile)',
        '  - The sessionId returned must be passed to ALL subsequent calls for this browser session',
        'Step 3: Call browser_screenshot to see what the page looks like.',
        '  - You will receive the actual rendered screenshot as an image — describe what you see',
        'Step 4: Interact with the page using browser_click, browser_type, browser_scroll.',
        'Step 5: Take more screenshots to verify the result of your interactions.',
        'Step 6: Use browser_get_dom to read HTML structure, browser_console_logs to check for JS errors.',
        '',
        '=== TOOL REFERENCE WITH ALL PARAMETERS ===',
        '',
        'browser_select_mode — Choose browser mode for the session',
        '  Params: mode (optional, "extension" or "headless") — set the session default',
        '  Call with no params to query available modes. Call with mode to set default.',
        '  Returns: extensionConnected, available options, currentMode, message',
        '',
        'browser_status — Check connection status',
        '  Params: none',
        '  Returns: extensionConnected (boolean), headlessSessions (list of active session IDs)',
        '',
        'browser_navigate — Open any URL in the browser',
        '  Params:',
        '    url (REQUIRED, string) — the URL to navigate to',
        '    width (optional, number) — viewport width in pixels (headless only, default 1024)',
        '    height (optional, number) — viewport height in pixels (headless only, default 768)',
        '    sessionId (optional, string) — reuse an existing headless session',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: url (final URL after navigation), sessionId',
        '  IMPORTANT: Save the returned sessionId and pass it to all subsequent tool calls!',
        '  Viewport examples: desktop=1920x1080, laptop=1366x768, tablet=768x1024, mobile=375x812',
        '',
        'browser_screenshot — Capture what the page looks like right now',
        '  Params:',
        '    sessionId (optional, string) — the headless session to screenshot',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: PNG image as base64 (rendered as an image you can see and describe)',
        '',
        'browser_click — Click any element on the page',
        '  Params:',
        '    selector (REQUIRED, string) — CSS selector of the element to click',
        '    sessionId (optional, string) — headless session ID',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: { success: true }',
        '  Selector examples: "#submit-btn", ".nav-link", "button[type=submit]", "a.login", "input[name=email]"',
        '  After clicking, the tool automatically waits for the page to stabilize (DOM mutations settle)',
        '',
        'browser_type — Type text into any input field',
        '  Params:',
        '    selector (REQUIRED, string) — CSS selector of the input/textarea to type into',
        '    text (REQUIRED, string) — the text to type',
        '    sessionId (optional, string) — headless session ID',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: { success: true }',
        '  Works with: text inputs, password fields, search bars, textareas, contenteditable elements',
        '',
        'browser_scroll — Scroll the page in any direction',
        '  Params:',
        '    x (optional, number, default 0) — horizontal scroll in pixels (positive=right, negative=left)',
        '    y (optional, number, default 0) — vertical scroll in pixels (positive=down, negative=up)',
        '    sessionId (optional, string) — headless session ID',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: { scrollX, scrollY } — final scroll position',
        '  Examples: scroll down 500px → y=500, scroll up → y=-500, scroll to bottom → y=99999',
        '',
        'browser_get_url — Get the current page URL',
        '  Params:',
        '    sessionId (optional, string) — headless session ID',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: { url } — the current page URL',
        '',
        'browser_get_dom — Get full HTML source of the current page',
        '  Params:',
        '    sessionId (optional, string) — headless session ID',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: { dom } — complete HTML content of the page',
        '  Useful for: finding CSS selectors, understanding page structure, checking element attributes',
        '',
        'browser_console_logs — Read JavaScript console output',
        '  Params:',
        '    sessionId (optional, string) — headless session ID',
        '    mode (optional, "extension" or "headless") — override session default',
        '  Returns: { logs: [{ type, text, timestamp }] } — array of console messages',
        '  Log types: "log", "warn", "error", "info", "debug"',
        '  Useful for: debugging JS errors, checking API responses, finding runtime issues',
        '',
        '=== COMMON USE CASES ===',
        '',
        'CHECK A WEBSITE:',
        '  browser_navigate({url: "https://example.com"}) → browser_screenshot()',
        '',
        'CHECK MOBILE LAYOUT:',
        '  browser_navigate({url: "https://example.com", width: 375, height: 812}) → browser_screenshot()',
        '',
        'FILL AND SUBMIT A FORM:',
        '  browser_navigate({url: "https://example.com/contact"})',
        '  browser_type({selector: "input[name=email]", text: "user@example.com"})',
        '  browser_type({selector: "textarea[name=message]", text: "Hello!"})',
        '  browser_click({selector: "button[type=submit]"})',
        '  browser_screenshot()  // verify form was submitted',
        '',
        'LOGIN TO A SITE:',
        '  browser_navigate({url: "https://example.com/login"})',
        '  browser_type({selector: "#username", text: "myuser"})',
        '  browser_type({selector: "#password", text: "mypass"})',
        '  browser_click({selector: "#login-btn"})',
        '  browser_screenshot()  // verify logged in',
        '',
        'DEBUG A JS ERROR:',
        '  browser_navigate({url: "https://example.com"}) → browser_console_logs()',
        '',
        'INSPECT PAGE STRUCTURE:',
        '  browser_navigate({url: "https://example.com"}) → browser_get_dom()',
        '',
        'MULTI-STEP FLOW:',
        '  browser_navigate({url: "https://shop.example.com"})',
        '  browser_click({selector: ".product-card:first-child .add-to-cart"})',
        '  browser_click({selector: ".cart-icon"})',
        '  browser_screenshot()  // verify cart',
        '  browser_click({selector: "#checkout-btn"})',
        '  browser_type({selector: "#email", text: "buyer@example.com"})',
        '  browser_click({selector: "#place-order"})',
        '  browser_screenshot()  // verify order confirmation',
        '',
        'SCROLL AND CAPTURE LONG PAGE:',
        '  browser_navigate({url: "https://example.com"}) → browser_screenshot()',
        '  browser_scroll({y: 800}) → browser_screenshot()  // see below the fold',
        '  browser_scroll({y: 800}) → browser_screenshot()  // see even further down',
        '',
        '=== SESSION MANAGEMENT ===',
        'When you call browser_navigate in headless mode, it returns a sessionId (e.g. "session-a1b2c3d4").',
        'You MUST pass this sessionId to all subsequent tool calls to use the same browser.',
        'The session persists: cookies, login state, navigation history are all maintained.',
        'Multiple sessions can exist simultaneously — each is an independent browser.',
        '',
        '=== IMPORTANT REMINDERS ===',
        '- You are NOT limited to fetching data. You have a REAL browser that renders pages.',
        '- Always use browser_navigate FIRST to open a page before using other tools.',
        '- Always pass the sessionId from browser_navigate to subsequent calls.',
        '- Take screenshots frequently to verify what happened after interactions.',
        '- Use browser_get_dom to find CSS selectors when you don\'t know them.',
        '- Check browser_console_logs when something seems broken on a page.',
        '- You can open any URL: public sites, localhost:3000, 127.0.0.1:8080, any web app.',
        '- The browser handles JavaScript, CSS, AJAX — pages render exactly like a real browser.',
      ].join('\n')
    }
  );

  for (const tool of tools) {
    server.registerTool(tool.name, tool.options, tool.handler);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('browser-control MCP server started', { tools: tools.map(t => t.name) });
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({
    level: 'error',
    message: 'Fatal startup error',
    error: String(error)
  }) + '\n');
  process.exit(1);
});
