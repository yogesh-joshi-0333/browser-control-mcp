import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { getRegisteredTool } from '../tool-registry.js';

interface IMacroStep {
  tool: string;
  args?: Record<string, unknown>;
}

const macros = new Map<string, IMacroStep[]>();

export const macroTool: ITool = {
  name: 'browser_macro',
  options: {
    title: 'Browser Macro',
    description:
      'Save a named sequence of tool calls once, then replay it by name later against any session — collapses a ' +
      'repeated multi-step flow (e.g. "login") into a single tool call instead of N round trips.',
    inputSchema: z.object({
      action: z.enum(['save', 'run', 'list', 'delete']).describe('Action to perform'),
      name: z.string().optional().describe('Macro name (required for "save", "run", "delete")'),
      steps: z.array(z.object({
        tool: z.string().describe('Name of a registered tool, e.g. "browser_click"'),
        args: z.record(z.string(), z.unknown()).optional().describe('Arguments for that tool call')
      })).optional().describe('Steps to save (required for "save")'),
      sessionId: z.string().optional().describe('Merged into every step\'s args when running, so one macro can target any session'),
      mode: z.enum(['headless', 'connect']).optional().describe('Merged into every step\'s args when running')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, name, steps, sessionId, mode } = args as {
      action?: string;
      name?: string;
      steps?: IMacroStep[];
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    try {
      switch (action) {
        case 'save': {
          if (!name || !steps || steps.length === 0) {
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_STEPS', message: 'name and a non-empty steps array are required to save a macro' }) }]
            };
          }
          macros.set(name, steps);
          logger.info('browser_macro saved', { name, stepCount: steps.length });
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, name, stepCount: steps.length }) }] };
        }

        case 'list': {
          return { content: [{ type: 'text', text: JSON.stringify({ macros: Array.from(macros.keys()) }) }] };
        }

        case 'delete': {
          if (!name) {
            return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_NAME', message: 'name is required to delete a macro' }) }] };
          }
          macros.delete(name);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        case 'run': {
          if (!name) {
            return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_NAME', message: 'name is required to run a macro' }) }] };
          }
          const savedSteps = macros.get(name);
          if (!savedSteps) {
            return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'MACRO_NOT_FOUND', message: `No macro saved as "${name}"` }) }] };
          }

          logger.info('browser_macro run', { name, stepCount: savedSteps.length, sessionId });
          const results: unknown[] = [];
          for (let i = 0; i < savedSteps.length; i++) {
            const step = savedSteps[i];
            const stepTool = getRegisteredTool(step.tool);
            if (!stepTool) {
              return {
                isError: true,
                content: [{ type: 'text', text: JSON.stringify({ code: 'TOOL_NOT_FOUND', message: `Step ${i} references unknown tool "${step.tool}"`, failedAtStep: i, results }) }]
              };
            }
            const mergedArgs = {
              ...step.args,
              ...(sessionId ? { sessionId } : {}),
              ...(mode ? { mode } : {})
            };
            const stepResult = await stepTool.handler(mergedArgs);
            results.push(stepResult);
            if (stepResult.isError) {
              return {
                isError: true,
                content: [{ type: 'text', text: JSON.stringify({ code: 'STEP_FAILED', message: `Step ${i} ("${step.tool}") failed`, failedAtStep: i, results }) }]
              };
            }
          }
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, results }) }] };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` }) }]
          };
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_macro failed', { error: String(error) });
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: err.code ?? 'UNKNOWN_ERROR', message: err.message ?? String(error) })
        }]
      };
    }
  }
};
