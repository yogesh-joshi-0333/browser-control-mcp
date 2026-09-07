import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerTool, getRegisteredTool } from '../tool-registry.js';
import type { ITool } from '../types.js';
import { z } from 'zod';

function makeTool(name: string): ITool {
  return {
    name,
    options: { description: 'test tool', inputSchema: z.object({}) },
    handler: async () => ({ content: [{ type: 'text', text: '{}' }] })
  };
}

describe('tool-registry', () => {
  beforeEach(() => {
    // no reset needed — each test uses a uniquely named tool
  });

  it('returns undefined for a name that was never registered', () => {
    expect(getRegisteredTool('nonexistent_tool_xyz')).toBeUndefined();
  });

  it('returns the same tool object that was registered', () => {
    const tool = makeTool('test_tool_abc');
    registerTool(tool);
    expect(getRegisteredTool('test_tool_abc')).toBe(tool);
  });
});
