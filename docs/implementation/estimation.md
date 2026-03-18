# Browser Control MCP — Estimation
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Effort by Phase

| Phase | Description | Estimated Hours |
|-------|-------------|----------------|
| Docs | Documentation setup (complete) | 3h |
| 1 | MCP Server Skeleton | 4h |
| 2 | WebSocket Bridge + Chrome Extension | 6h |
| 3 | V1 Tools via Extension (screenshot, get_url) | 5h |
| 4 | Headless Mode (Puppeteer + session manager) | 6h |
| 5 | V2 Tools (click, scroll, console logs) | 8h |
| 6 | V3 Tools (DOM, type, navigate, record, diff, test) | 16h |
| **Total** | | **48h** |

---

## Dependencies

| Dependency | Required For | How to Check |
|------------|-------------|-------------|
| Node.js 20.x LTS | Phases 1–6 | `node --version` |
| npm 10.x | Phases 1–6 | `npm --version` |
| Google Chrome (latest) | Phases 2–6 | Open Chrome, check version |
| Claude Code installed in VSCode | Phase 1 | Check VSCode extensions |
| `@modelcontextprotocol/sdk` | Phase 1 | `npm install` |
| `ws` package | Phase 2 | `npm install` |
| `puppeteer` package | Phase 4 | `npm install` |
| `nanoid` package | Phase 4 | `npm install` |

---

## Team Requirements

| Phase | Role Needed | Notes |
|-------|------------|-------|
| 1–4 | Senior TypeScript developer | MCP protocol knowledge helpful |
| 2 | Chrome Extension developer OR TypeScript developer | Manifest V3 knowledge needed for Phase 2 |
| 6 | Full-stack developer | Recording + visual diff require additional research |

*This project is designed for a single AI-enabled senior developer working solo.*

---

## Risk Factors

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| Chrome Extension Manifest V3 service worker limitations | High — service worker can be killed by Chrome | Medium | Use persistent storage to restore state; implement reconnect logic |
| `chrome.tabs.captureVisibleTab` requires user gesture in some contexts | Medium — screenshots may fail silently | Low | Test on multiple tab types; document restrictions |
| Puppeteer version incompatibility with Node 20 | Low | Low | Pin Puppeteer version in package.json |
| MCP SDK breaking changes | Medium | Low | Pin SDK version; read changelog before upgrading |
| WebSocket origin validation blocks legitimate extension | Medium | Low | Log rejected origins for debugging; provide clear config instructions |
| V3 recording API (tabCapture) restricted in MV3 | High — recording may not work as designed | Medium | Research alternative in Phase 6; fallback to Puppeteer screencast only |
| Session recording video size too large for MCP response | Medium | Medium | Add size limit; compress to quality-reduced JPEG frames; or return URL |

---

## Milestones

| Milestone | Deliverable | After Phase |
|-----------|-------------|-------------|
| M1 — First MCP Call | Claude Code lists browser-control server, `browser_status` responds | Phase 1 |
| M2 — First Connection | Extension connected, `browser_status` returns `extensionConnected: true` | Phase 2 |
| M3 — First Screenshot | Claude describes contents of real Chrome tab | Phase 3 |
| M4 — Dual Mode | Claude uses both real Chrome and headless Puppeteer sessions | Phase 4 |
| M5 — V2 Interaction | Claude can click, scroll, and read console errors | Phase 5 |
| M6 — Full Antigravity Parity | All V3 tools working, complete browser automation possible | Phase 6 |
