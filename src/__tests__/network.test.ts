import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../mode-selector.js', () => ({
  selectMode: jest.fn()
}));

jest.unstable_mockModule('../puppeteer-manager.js', () => ({
  getNetworkLog: jest.fn(),
  clearNetworkLog: jest.fn(),
  setBlockedResourceTypes: jest.fn(),
  getBlockedResourceTypes: jest.fn()
}));

const { networkTool } = await import('../tools/network.js');
const { selectMode } = await import('../mode-selector.js');
const manager = await import('../puppeteer-manager.js');

const mockSelectMode = selectMode as jest.MockedFunction<typeof selectMode>;
const mockGetNetworkLog = manager.getNetworkLog as jest.MockedFunction<typeof manager.getNetworkLog>;
const mockClearNetworkLog = manager.clearNetworkLog as jest.MockedFunction<typeof manager.clearNetworkLog>;
const mockSetBlockedResourceTypes = manager.setBlockedResourceTypes as jest.MockedFunction<typeof manager.setBlockedResourceTypes>;

describe('browser_network', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectMode.mockResolvedValue({ mode: 'headless', sessionId: 'session-abc12345' });
  });

  it('action "list" returns the most recent entries, most-recent-last, capped by limit', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ url: `https://x/${i}`, method: 'GET', resourceType: 'document', status: 200, timestamp: '' }));
    mockGetNetworkLog.mockReturnValue(entries);

    const result = await networkTool.handler({ sessionId: 'session-abc12345', action: 'list', limit: 3 });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[2].url).toBe('https://x/9');
    expect(parsed.totalCaptured).toBe(10);
  });

  it('action "clear" empties the network log', async () => {
    const result = await networkTool.handler({ sessionId: 'session-abc12345', action: 'clear' });

    expect(result.isError).toBeFalsy();
    expect(mockClearNetworkLog).toHaveBeenCalledWith('session-abc12345');
  });

  it('action "block" adds resource types to the blocked set', async () => {
    const result = await networkTool.handler({ sessionId: 'session-abc12345', action: 'block', resourceTypes: ['image', 'font'] });

    expect(result.isError).toBeFalsy();
    expect(mockSetBlockedResourceTypes).toHaveBeenCalledWith('session-abc12345', ['image', 'font']);
  });

  it('action "block" requires resourceTypes', async () => {
    const result = await networkTool.handler({ sessionId: 'session-abc12345', action: 'block' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_RESOURCE_TYPES');
  });

  it('action "unblock" clears the blocked set', async () => {
    const result = await networkTool.handler({ sessionId: 'session-abc12345', action: 'unblock' });

    expect(result.isError).toBeFalsy();
    expect(mockSetBlockedResourceTypes).toHaveBeenCalledWith('session-abc12345', []);
  });

  it('rejects "block" in connect mode to avoid interfering with the user\'s live browsing', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'connect', sessionId: 'connect-abc12345' });

    const result = await networkTool.handler({ action: 'block', resourceTypes: ['image'] });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('NOT_SUPPORTED_IN_CONNECT_MODE');
    expect(mockSetBlockedResourceTypes).not.toHaveBeenCalled();
  });

  it('action "list" in connect mode returns an empty log rather than erroring', async () => {
    mockSelectMode.mockResolvedValue({ mode: 'connect', sessionId: 'connect-abc12345' });
    mockGetNetworkLog.mockReturnValue([]);

    const result = await networkTool.handler({ action: 'list' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.entries).toEqual([]);
  });
});
