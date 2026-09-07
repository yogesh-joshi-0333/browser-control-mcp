import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../tool-registry.js', () => ({
  getRegisteredTool: jest.fn()
}));

const { macroTool } = await import('../tools/macro.js');
const { getRegisteredTool } = await import('../tool-registry.js');

const mockGetRegisteredTool = getRegisteredTool as jest.MockedFunction<typeof getRegisteredTool>;

describe('browser_macro', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('action "save" requires a non-empty steps array', async () => {
    const result = await macroTool.handler({ action: 'save', name: 'login', steps: [] });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_STEPS');
  });

  it('action "list" is empty before anything is saved, then contains the saved macro', async () => {
    const before = await macroTool.handler({ action: 'list' });
    expect(JSON.parse((before.content[0] as { text: string }).text).macros).not.toContain('login-test-1');

    await macroTool.handler({
      action: 'save',
      name: 'login-test-1',
      steps: [{ tool: 'browser_click', args: { selector: '#login' } }]
    });

    const after = await macroTool.handler({ action: 'list' });
    expect(JSON.parse((after.content[0] as { text: string }).text).macros).toContain('login-test-1');
  });

  it('action "run" calls each saved step\'s tool handler in order, merging sessionId into every step', async () => {
    const clickHandler = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ content: [{ type: 'text', text: '{"success":true}' }] });
    const typeHandler = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ content: [{ type: 'text', text: '{"success":true}' }] });
    mockGetRegisteredTool.mockImplementation((name: string) => {
      if (name === 'browser_click') return { name, options: {} as never, handler: clickHandler as never };
      if (name === 'browser_type') return { name, options: {} as never, handler: typeHandler as never };
      return undefined;
    });

    await macroTool.handler({
      action: 'save',
      name: 'run-test-1',
      steps: [
        { tool: 'browser_click', args: { selector: '#user' } },
        { tool: 'browser_type', args: { selector: '#user', text: 'bob' } }
      ]
    });

    const result = await macroTool.handler({ action: 'run', name: 'run-test-1', sessionId: 'session-abc12345' });

    expect(result.isError).toBeFalsy();
    expect(clickHandler).toHaveBeenCalledWith({ selector: '#user', sessionId: 'session-abc12345' });
    expect(typeHandler).toHaveBeenCalledWith({ selector: '#user', text: 'bob', sessionId: 'session-abc12345' });
  });

  it('action "run" stops and reports the failing step when a step tool is not registered', async () => {
    mockGetRegisteredTool.mockReturnValue(undefined);

    await macroTool.handler({
      action: 'save',
      name: 'run-test-2',
      steps: [{ tool: 'browser_nonexistent', args: {} }]
    });

    const result = await macroTool.handler({ action: 'run', name: 'run-test-2' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('TOOL_NOT_FOUND');
  });

  it('action "run" errors for an unknown macro name', async () => {
    const result = await macroTool.handler({ action: 'run', name: 'never-saved-xyz' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('MACRO_NOT_FOUND');
  });

  it('action "delete" removes a saved macro', async () => {
    await macroTool.handler({ action: 'save', name: 'delete-test-1', steps: [{ tool: 'x' }] });
    await macroTool.handler({ action: 'delete', name: 'delete-test-1' });

    const result = await macroTool.handler({ action: 'run', name: 'delete-test-1' });
    expect(result.isError).toBe(true);
  });
});
