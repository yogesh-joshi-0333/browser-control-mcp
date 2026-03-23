import { describe, it, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  isDebugChromeRunning: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
  listSessions: jest.fn().mockReturnValue([])
}));

const { statusTool } = await import('../tools/status.js');

describe('browser_status tool', () => {
  it('has correct tool name', () => {
    expect(statusTool.name).toBe('browser_status');
  });

  it('returns connectAvailable: false when not available', async () => {
    const result = await statusTool.handler({});
    const content = result.content[0];
    if (content.type !== 'text') throw new Error('Expected text content');
    const data = JSON.parse(content.text);
    expect(data.connectAvailable).toBe(false);
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
      connectAvailable: false,
      headlessSessions: []
    });
  });
});
