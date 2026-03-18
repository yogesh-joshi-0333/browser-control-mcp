import { describe, it, expect } from '@jest/globals';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { statusTool } from '../tools/status.js';

function getTextContent(result: CallToolResult): string {
  const item = result.content[0];
  if (item.type !== 'text') throw new Error('Expected text content');
  return item.text;
}

describe('browser_status tool', () => {
  it('has correct tool name', () => {
    expect(statusTool.name).toBe('browser_status');
  });

  it('returns extensionConnected: false', async () => {
    const result = await statusTool.handler({});
    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    const data = JSON.parse(text);
    expect(data.extensionConnected).toBe(false);
  });

  it('returns empty headlessSessions array', async () => {
    const result = await statusTool.handler({});
    const data = JSON.parse(getTextContent(result));
    expect(data.headlessSessions).toEqual([]);
  });

  it('returns content with type text', async () => {
    const result = await statusTool.handler({});
    expect(result.content[0].type).toBe('text');
  });

  it('returns structuredContent with correct shape', async () => {
    const result = await statusTool.handler({});
    expect(result.structuredContent).toEqual({
      extensionConnected: false,
      headlessSessions: []
    });
  });
});
