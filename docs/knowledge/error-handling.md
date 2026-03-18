# Browser Control MCP — Error Handling
**Version:** 1.0.0 | **Date:** 2026-03-18

---

## Core Principle

Every tool call that fails MUST return a structured error object — the MCP Server process must never crash due to a tool error.

---

## Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE_SCREAMING_SNAKE_CASE",
    "message": "Exact human-readable message string"
  }
}
```

No stack traces. No file paths. No system internals.

---

## Standard Error Messages

| Code | Exact Message |
|------|--------------|
| `EXTENSION_NOT_CONNECTED` | "Chrome Extension is not connected. Open Chrome and ensure the extension is installed and enabled." |
| `SESSION_NOT_FOUND` | "Headless session '{sessionId}' does not exist. Call browser_screenshot with mode=headless to create a new session." |
| `TIMEOUT_ERROR` | "Extension did not respond within 10 seconds." |
| `TAB_CAPTURE_FAILED` | "Failed to capture visible tab. Ensure the active tab is a regular web page." |
| `ELEMENT_NOT_FOUND` | "No element found matching selector '{selector}'." |
| `CLICK_FAILED` | "Could not click element '{selector}'. Element may be hidden or disabled." |
| `WS_SEND_FAILED` | "Failed to send command to extension. Connection may have dropped." |
| `MODE_REQUIRED` | "Tool requires 'mode' parameter: 'extension' or 'headless'." |
| `INVALID_MODE` | "Invalid mode '{mode}'. Must be 'extension' or 'headless'." |
| `PUPPETEER_LAUNCH_FAILED` | "Failed to launch headless browser. Ensure Puppeteer is installed correctly." |
| `NAVIGATE_FAILED` | "Navigation to '{url}' failed. URL may be invalid or unreachable." |
| `RECORDING_NOT_STARTED` | "No active recording found for session '{sessionId}'." |

---

## Error Handling Layers

### Layer 1 — Tool Level (each tool file)

Every tool function wraps its logic in try/catch:

```typescript
export async function browserScreenshot(params: IScreenshotParams): Promise<IToolResult> {
  try {
    // tool logic here
    return { image: base64, url, mode, timestamp };
  } catch (error: unknown) {
    logger.error('screenshot', 'Tool execution failed', { error });
    return {
      error: {
        code: 'TAB_CAPTURE_FAILED',
        message: 'Failed to capture visible tab. Ensure the active tab is a regular web page.'
      }
    };
  }
}
```

### Layer 2 — WebSocket Level (websocket.ts)

WebSocket sends are wrapped for connection errors:

```typescript
async function sendToExtension(request: IWsRequest): Promise<IWsResponse> {
  if (!this.client || !this.connected) {
    return {
      id: request.id,
      success: false,
      error: { code: 'EXTENSION_NOT_CONNECTED', message: '...' }
    };
  }
  try {
    this.client.send(JSON.stringify(request));
    return await this.waitForResponse(request.id, 10_000);
  } catch (error: unknown) {
    return {
      id: request.id,
      success: false,
      error: { code: 'WS_SEND_FAILED', message: '...' }
    };
  }
}
```

### Layer 3 — Timeout Level (websocket.ts)

Every pending request has a 10-second timeout:

```typescript
private waitForResponse(id: string, timeoutMs: number): Promise<IWsResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      this.pending.delete(id);
      resolve({
        id,
        success: false,
        error: { code: 'TIMEOUT_ERROR', message: 'Extension did not respond within 10 seconds.' }
      });
    }, timeoutMs);

    this.pending.set(id, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}
```

### Layer 4 — Process Level (index.ts)

Uncaught exceptions and unhandled rejections are caught at the top level — log and continue, never crash:

```typescript
process.on('uncaughtException', (error) => {
  logger.error('process', 'Uncaught exception', { error: error.message });
});

process.on('unhandledRejection', (reason) => {
  logger.error('process', 'Unhandled rejection', { reason });
});
```

---

## What NOT To Do

- Do NOT use `throw` in tool functions — return structured errors instead
- Do NOT expose stack traces in any response
- Do NOT silently swallow errors — every caught error must be logged
- Do NOT re-throw after logging — handle at each layer
- Do NOT use generic message like "Something went wrong" — use exact messages from the standard table
