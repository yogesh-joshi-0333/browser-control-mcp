import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

export const executeTool: ITool = {
  name: 'browser_execute',
  options: {
    title: 'Execute JavaScript',
    description:
      'Execute arbitrary JavaScript code on the current page and return the result. ' +
      'Use this for complex interactions that other tools cannot handle: ' +
      'jQuery/Select2 dropdowns (e.g. jQuery("#select").val("value").trigger("change")), ' +
      'reading JavaScript variables, calling page functions, manipulating complex widgets, ' +
      'dispatching custom events, or any DOM manipulation. ' +
      'The code runs in the page context with full access to window, document, jQuery, etc. ' +
      'Return a value from your code and it will be sent back as the result. ' +
      'Examples: ' +
      'Set Select2 dropdown: \'jQuery("#project").val("123").trigger("change")\' | ' +
      'Read a value: \'document.querySelector("#total").textContent\' | ' +
      'Fill multiple fields: \'jQuery("#name").val("John"); jQuery("#email").val("john@example.com"); "done"\' | ' +
      'Trigger form submit: \'document.querySelector("form").submit()\' | ' +
      'Check if element exists: \'!!document.querySelector(".success-message")\'',
    inputSchema: z.object({
      code: z.string().describe(
        'JavaScript code to execute in the page context. Has full access to window, document, jQuery ($), and all page globals. ' +
        'The return value of the last expression is sent back as the result. ' +
        'For async operations, return a Promise.'
      ),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { code, sessionId, mode } = args as {
      code?: string;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (!code) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'INVALID_CODE', message: 'code is required' })
        }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_execute', { mode: modeResult.mode, sessionId: modeResult.sessionId, codeLength: code.length });

      const session = getSession(modeResult.sessionId!);
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const result = await session.page.evaluate(`(async () => { ${code} })()`);

      const resultStr = result === undefined ? 'undefined' : JSON.stringify(result);

      return {
        content: [{ type: 'text', text: JSON.stringify({ result: resultStr, sessionId: modeResult.sessionId }) }]
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_execute failed', { error: String(error) });
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: err.code ?? 'EXECUTION_ERROR', message: err.message ?? String(error) })
        }]
      };
    }
  }
};
