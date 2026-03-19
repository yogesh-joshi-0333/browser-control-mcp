# browser-control-mcp-server

MCP server that gives AI agents full browser control — navigate to any website, click, type, scroll, take screenshots, inspect DOM, and read console logs.

Works with **any MCP-compatible client**: Claude, Cursor, Windsurf, Cline, and more.

## Features

- **Navigate** to any URL — public sites, localhost, web apps
- **Screenshot** pages and get visual feedback as PNG images
- **Click** buttons, links, menus, dropdowns by CSS selector
- **Type** into inputs, search bars, textareas, password fields
- **Scroll** in any direction by pixel amount
- **Read DOM** — get full HTML source for structural analysis
- **Console logs** — read JS errors, warnings, and debug output
- **Custom viewports** — test at desktop (1920x1080), tablet (768x1024), or mobile (375x812)
- **Session persistence** — cookies, login state, history maintained across calls
- **Two modes**: headless Puppeteer (background) or real Chrome browser (via extension)
- **Anti-bot bypass** — spoofed user agent, no webdriver flag

## Quick Start

### 1. Install

```bash
npm install -g browser-control-mcp-server
```

Or run directly with npx:

```bash
npx browser-control-mcp-server
```

### 2. Configure Your MCP Client

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "npx",
      "args": ["browser-control-mcp-server"]
    }
  }
}
```

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

**Cursor / Windsurf / Cline** — add to your MCP settings file

### 3. Use It

Tell your AI agent:

> "Open https://example.com and take a screenshot"

> "Fill out the contact form on my site and submit it"

> "Check my website on mobile viewport and show me how it looks"

The agent will use the browser tools automatically.

## Tools

| Tool | Description |
|------|-------------|
| `browser_select_mode` | Choose headless or Chrome extension mode |
| `browser_status` | Check connection status and active sessions |
| `browser_navigate` | Open any URL with optional viewport size |
| `browser_screenshot` | Capture page as PNG image |
| `browser_click` | Click element by CSS selector |
| `browser_type` | Type text into input fields |
| `browser_scroll` | Scroll page by pixel amount |
| `browser_get_url` | Get current page URL |
| `browser_get_dom` | Get full HTML source |
| `browser_console_logs` | Read JS console output |

## Browser Modes

### Headless Mode (Default)

Opens an invisible background browser using Puppeteer. No setup required.

- Default viewport: 1024x768
- Custom viewport: pass `width` and `height` to `browser_navigate`
- Anti-bot detection bypass included
- Sessions identified by `sessionId` — pass to all subsequent calls

### Extension Mode (Optional)

Controls your real Chrome browser. Requires the Chrome Extension.

**Setup:**

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `chrome-extension/` folder from this package
4. The extension connects automatically via WebSocket on `localhost:9999`

## Examples

### Check a website
```
browser_navigate({ url: "https://example.com" })
browser_screenshot()
```

### Test mobile layout
```
browser_navigate({ url: "https://example.com", width: 375, height: 812 })
browser_screenshot()
```

### Fill and submit a form
```
browser_navigate({ url: "https://example.com/contact" })
browser_type({ selector: "input[name=email]", text: "user@example.com" })
browser_type({ selector: "textarea[name=message]", text: "Hello!" })
browser_click({ selector: "button[type=submit]" })
browser_screenshot()
```

### Login to a site
```
browser_navigate({ url: "https://example.com/login" })
browser_type({ selector: "#username", text: "myuser" })
browser_type({ selector: "#password", text: "mypass" })
browser_click({ selector: "#login-btn" })
browser_screenshot()
```

### Debug JavaScript errors
```
browser_navigate({ url: "https://example.com" })
browser_console_logs()
```

## Tool Parameters

### browser_navigate
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | — | URL to navigate to |
| `width` | number | No | 1024 | Viewport width in pixels (headless only) |
| `height` | number | No | 768 | Viewport height in pixels (headless only) |
| `sessionId` | string | No | — | Reuse existing headless session |
| `mode` | string | No | — | `"extension"` or `"headless"` |

### browser_click
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | Yes | CSS selector (e.g. `"#btn"`, `"button[type=submit]"`, `".nav-link"`) |
| `sessionId` | string | No | Headless session ID |
| `mode` | string | No | `"extension"` or `"headless"` |

### browser_type
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | Yes | CSS selector of input element |
| `text` | string | Yes | Text to type |
| `sessionId` | string | No | Headless session ID |
| `mode` | string | No | `"extension"` or `"headless"` |

### browser_scroll
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 0 | Horizontal scroll (positive=right) |
| `y` | number | No | 0 | Vertical scroll (positive=down) |
| `sessionId` | string | No | — | Headless session ID |
| `mode` | string | No | — | `"extension"` or `"headless"` |

### browser_screenshot, browser_get_url, browser_get_dom, browser_console_logs
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | No | Headless session ID |
| `mode` | string | No | `"extension"` or `"headless"` |

### browser_select_mode
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mode` | string | No | `"extension"` or `"headless"` — sets session default |

### browser_status
No parameters.

## Viewport Presets

| Device | Width | Height |
|--------|-------|--------|
| Mobile (iPhone) | 375 | 812 |
| Mobile (Android) | 360 | 800 |
| Tablet (iPad) | 768 | 1024 |
| Laptop | 1366 | 768 |
| Desktop | 1920 | 1080 |
| 4K | 3840 | 2160 |

## Requirements

- Node.js >= 18.0.0
- Chrome/Chromium (auto-downloaded by Puppeteer for headless mode)
- Chrome browser + extension (for extension mode only)

## Development

```bash
git clone https://github.com/yogesh-joshi-0333/browser-control-mcp-server.git
cd browser-control-mcp-server
npm install
npm run build
npm test
```

## License

[MIT](LICENSE) — Yogesh Joshi
