# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-19

### Added
- 10 MCP browser control tools: `browser_select_mode`, `browser_status`, `browser_navigate`, `browser_screenshot`, `browser_click`, `browser_type`, `browser_scroll`, `browser_get_url`, `browser_get_dom`, `browser_console_logs`
- Dual-mode architecture: headless Puppeteer sessions and real Chrome browser via extension
- Chrome Extension (Manifest V3) with WebSocket bridge for real browser control
- Custom viewport support (width/height) for responsive testing (desktop, tablet, mobile)
- Anti-bot detection bypass (user agent spoofing, webdriver flag disabled)
- DOM stability detection using MutationObserver (300ms quiet window, 3s max)
- Native click dispatch via `page.evaluate()` for JS framework compatibility
- Session management with persistent cookies, login state, and navigation history
- Comprehensive server instructions so AI agents understand all capabilities
- Rich tool descriptions with parameter examples and use cases
- WebSocket heartbeat and origin validation for Chrome Extension security
- Full test suite: 14 test suites, 73 tests
- TypeScript with strict mode, ESLint, declaration files
