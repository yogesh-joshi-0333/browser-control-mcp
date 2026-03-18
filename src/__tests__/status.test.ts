import { describe, it, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../websocket.js', () => ({
  getConnectionState: jest.fn().mockReturnValue({ connected: false, socketId: null })
}));
jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  listSessions: jest.fn().mockReturnValue([])
}));

const { statusTool } = await import('../tools/status.js');

describe('browser_status tool', () => {
  it('has correct tool name', () => {
    expect(statusTool.name).toBe('browser_status');
  });

  it('returns extensionConnected: false when not connected', async () => {
    const result = await statusTool.handler({});
    const content = result.content[0];
    if (content.type !== 'text') throw new Error('Expected text content');
    const data = JSON.parse(content.text);
    expect(data.extensionConnected).toBe(false);
  });

  it('returns empty headlessSessions array', async () => {
    const result = await statusTool.handler({});
    const content = result.content[0];
    if (content.type !== 'text') throw new Error('Expected text content');
    const data = JSON.parse(content.text);
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
