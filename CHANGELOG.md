# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-09-07

### Added
- `browser_auth` — set/clear HTTP Basic/Digest Auth credentials for password-protected sites.
- `browser_emulate` — device presets, dark mode/reduced-motion, timezone, locale, geolocation, permissions, network throttling presets, and CPU throttling, all in one tool.
- `browser_frames` — list iframes on the page; `browser_click`/`browser_type`/`browser_get_dom` gained a `frameIndex` param to target one directly.
- Shadow DOM support across all existing selector-based tools, for free: prefix any selector with `pierce/` (Puppeteer's built-in shadow-piercing query handler) — no code change needed, just documented.
- `browser_navigate` gained a `proxyServer` param to route a new headless session through a proxy.
- `browser_form_fill` — fill multiple form fields (text inputs, `<select>`, checkboxes/radios) in one call, with an optional submit click.

## [1.3.0] - 2026-09-07

### Added
- `browser_stats` — cheap pre-check (DOM node count, approx HTML/text length, title/url) so an agent can decide whether a full `browser_get_dom` call is safe before making it.
- `browser_snapshot` gained a `diff` option — returns only elements added/removed since the last snapshot in that session (diffed by role/name/state/depth, not by ref, since refs are reassigned every call), instead of the full tree.
- `browser_tabs` gained a `screenshot` action — captures a specific tab by index without switching the active tab, for comparing tabs or peeking at a background one.
- `browser_macro` — save a named sequence of `{tool, args}` steps once, replay it by name against any session later, collapsing a repeated flow (e.g. login) into one tool call. Backed by a new shared tool registry so macro can invoke any other registered tool's handler directly.

## [1.2.0] - 2026-09-07

### Added
- `browser_snapshot` — compact accessibility-tree view of interactive/semantic elements, each tagged with a stable `[ref=eN]` reusable as a CSS selector by `browser_click`/`type`/`hover`/`select_option`. Far cheaper than a full DOM dump for exploring an unfamiliar page.
- `browser_get_dom` gained `selector` (scope to a subtree), `format: "html"|"text"`, and `maxLength` (with a `truncated`/`totalLength` response) — all optional and off by default, fully backward compatible.
- `browser_cookies` — get/set/delete/clear cookies.
- `browser_storage` — get/set/clear localStorage and sessionStorage.
- `browser_extract` — visible page text, or text/attribute extraction scoped to a selector, without dumping raw HTML.
- `browser_pdf` — render the current page to a PDF file on disk.
- `browser_network` — list captured requests (url/method/resourceType/status) and block by resource type (headless mode only).
- `browser_downloads` — configure a download directory and list files that land there.
- Stronger anti-bot-detection hardening: launches now go through `puppeteer-extra` + `puppeteer-extra-plugin-stealth` instead of a single manual `navigator.webdriver` patch.

### Changed
- Server instructions text documents all new tools and steers agents toward `browser_snapshot`/`browser_extract` over a full `browser_get_dom` dump.

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
