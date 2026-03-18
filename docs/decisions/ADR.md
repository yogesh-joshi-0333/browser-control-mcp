# Browser Control MCP — Architectural Decision Records
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## ADR-001: MCP Protocol for Claude Integration

**Date:** 2026-03-18
**Status:** Accepted

**Decision:**
Use the Model Context Protocol (MCP) with stdio transport to integrate browser tools into Claude Code.

**Reason:**
MCP is the native extension mechanism for Claude Code. It provides a standardized tool registration system, handles schema validation, and is the only officially supported way to add capabilities to Claude Code. Alternatives like a REST API or custom plugin system would not integrate natively with Claude's tool-calling mechanism.

**Consequences:**
- Tools must follow MCP schema format
- Communication is via stdio (not HTTP) — no network port needed for Claude integration
- Must use `@modelcontextprotocol/sdk` — tied to its versioning and breaking changes
- Single-process design (no microservices needed)

---

## ADR-002: Chrome Extension + WebSocket Bridge for Real Browser Access

**Date:** 2026-03-18
**Status:** Accepted

**Decision:**
Use a Chrome Extension (Manifest V3) as the bridge to the user's real browser tabs, communicating with the MCP Server via a local WebSocket on `127.0.0.1:9999`.

**Reason:**
The only way to access a user's real Chrome tabs (with their actual state, cookies, and rendered content) is through a Chrome Extension. Playwright/Puppeteer can only control a separate browser instance, not an existing user session. The WebSocket bridge provides a reliable, bidirectional communication channel between the MCP Server process and the extension's service worker.

**Consequences:**
- Developer must manually load the extension in Chrome (no automatic install)
- Extension ID must be configured in `config.json`
- Manifest V3 service workers can be killed by Chrome after inactivity — reconnect logic is mandatory
- Limited to Google Chrome (no Firefox/Safari support)

---

## ADR-003: Dual-Mode Browser Strategy (Extension + Headless)

**Date:** 2026-03-18
**Status:** Accepted

**Decision:**
Every browser tool supports two modes: Extension mode (user's real Chrome tab) and Headless mode (isolated Puppeteer session). The user selects the mode per tool call via a prompt. If a `sessionId` is provided, the mode is automatically Headless (no prompt).

**Reason:**
Different tasks need different modes. UI work and visual inspection need real Chrome (Extension mode) so Claude sees what the user sees. Automated testing and background tasks should not disturb the user's active tabs (Headless mode). Prompting the user per call gives maximum flexibility. Antigravity makes this decision automatically, but for a developer tool where the user is always present, explicit control is safer and more predictable.

**Consequences:**
- Every tool must implement two execution branches
- Mode selection adds one interaction per tool call (acceptable for developer workflow)
- Session IDs must be passed through multi-step headless workflows
- Code complexity approximately doubles compared to single-mode design

---

## ADR-004: Phased V1/V2/V3 Feature Rollout

**Date:** 2026-03-18
**Status:** Accepted

**Decision:**
Features are split into three versions: V1 (screenshot, URL, status), V2 (click, scroll, console), V3 (DOM, type, navigate, record, diff, test). Each version is implemented in a dedicated phase.

**Reason:**
Full Antigravity parity is ~13 tools and significant complexity. Building incrementally allows the system to deliver value at each milestone (M3: first screenshot; M5: full interaction) while managing risk. V1 alone provides Claude with visual feedback — the single most impactful capability. V2 adds interaction. V3 adds automation. This sequencing matches the risk profile: V1 is low-risk/high-value, V3 includes uncharted territory (recording, visual diff) that may require research.

**Consequences:**
- V2 and V3 features cannot be used until their phases are complete
- Phase discipline must be enforced — no V2 code in Phase 3
- Risk of recording API limitations in V3 (Manifest V3 `tabCapture` restrictions)

---

## ADR-005: Node.js/TypeScript for MCP Server

**Date:** 2026-03-18
**Status:** Accepted

**Decision:**
The MCP Server is built in Node.js 20.x LTS with TypeScript 5.x in strict mode.

**Reason:**
The MCP SDK has its best support in Node.js/TypeScript. Chrome Extensions are JavaScript — sharing the same ecosystem (npm, ws, JSON schemas) simplifies development and reduces context switching. TypeScript strict mode catches type errors at build time, critical for a system where wrong message shapes would cause silent failures. Python was considered but the MCP SDK has less mature Python support and the Chrome Extension ecosystem is JS-native.

**Consequences:**
- Single language ecosystem across MCP Server and Chrome Extension
- Strict TypeScript prevents `any` types — slightly more verbose but much safer
- Node.js 20.x LTS provides long-term stability

---

## ADR-006: Security — localhost-only WebSocket with Extension Origin Validation

**Date:** 2026-03-18
**Status:** Accepted

**Decision:**
The WebSocket server binds exclusively to `127.0.0.1` (not `0.0.0.0`) and validates every incoming connection's `Origin` header against the registered Chrome Extension ID. Connections from any other origin are immediately terminated.

**Reason:**
The WebSocket server, if accessible from the network or from arbitrary browser tabs, would allow any website to take screenshots, click elements, and read DOM content of the user's browser — a critical security vulnerability. Binding to localhost prevents network access. Origin validation ensures only the registered extension can connect. This is a defense-in-depth approach for a tool that controls a browser on the user's machine.

**Consequences:**
- Developer must configure the extension ID in `config.json` before the extension can connect
- If extension ID changes (reinstall), `config.json` must be updated
- Two layers of security: network binding + origin validation
