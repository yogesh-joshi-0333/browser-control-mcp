import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { listProfiles, deleteProfile, isValidProfileName } from '../profiles.js';

export const profilesTool: ITool = {
  name: 'browser_profiles',
  options: {
    title: 'Browser Profiles',
    description:
      'List or delete named persistent browser profiles. A profile is a Chrome user-data directory whose cookies, ' +
      'localStorage, and login state survive across separate MCP server runs — unlike a normal session, which is wiped ' +
      'once it ends. Create one implicitly by passing `profile: "name"` to browser_navigate on a brand-new session ' +
      '(letters, digits, dash, underscore only in the name).',
    inputSchema: z.object({
      action: z.enum(['list', 'delete']).describe('Action to perform'),
      name: z.string().optional().describe('Profile name (required for "delete")')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const { action, name } = args as { action?: string; name?: string };

    try {
      logger.info('browser_profiles', { action, name });

      switch (action) {
        case 'list': {
          const profiles = await listProfiles();
          return { content: [{ type: 'text', text: JSON.stringify({ profiles }) }] };
        }

        case 'delete': {
          if (!name) {
            return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_NAME', message: 'name is required to delete a profile' }) }] };
          }
          if (!isValidProfileName(name)) {
            return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_PROFILE_NAME', message: `Invalid profile name: "${name}"` }) }] };
          }
          await deleteProfile(name);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_ACTION', message: `Unknown action: ${action}` }) }]
          };
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_profiles failed', { error: String(error) });
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
