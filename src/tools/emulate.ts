import { z } from 'zod';
import { KnownDevices, PredefinedNetworkConditions } from 'puppeteer-core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ITool } from '../types.js';
import { logger } from '../logger.js';
import { selectMode } from '../mode-selector.js';
import { getSession } from '../puppeteer-manager.js';

const NETWORK_PRESETS = ['Slow 3G', 'Fast 3G', 'Slow 4G', 'Fast 4G'] as const;

export const emulateTool: ITool = {
  name: 'browser_emulate',
  options: {
    title: 'Browser Emulate',
    description:
      'Emulate device/environment conditions on the current page — device presets, dark mode, reduced motion, ' +
      'timezone, locale, geolocation, permissions, network throttling, and CPU throttling. Pass only the options ' +
      'you need; each is applied independently and the response lists what was actually changed. ' +
      'Geolocation and permissions are scoped to the page\'s current origin, so navigate first.',
    inputSchema: z.object({
      device: z.string().optional().describe('A known device name, e.g. "iPhone 15 Pro", "Pixel 7", "iPad Mini". Sets viewport, user agent, and touch support together.'),
      colorScheme: z.enum(['light', 'dark', 'no-preference']).optional().describe('Emulate prefers-color-scheme'),
      reducedMotion: z.enum(['reduce', 'no-preference']).optional().describe('Emulate prefers-reduced-motion'),
      timezone: z.string().optional().describe('IANA timezone id, e.g. "America/New_York", "Asia/Kolkata"'),
      locale: z.string().optional().describe('Locale/language, e.g. "fr-FR" — sent as the Accept-Language header (approximation; does not change navigator.language)'),
      geolocation: z.object({ latitude: z.number(), longitude: z.number() }).optional().describe('Coordinates to report for navigator.geolocation. Automatically grants the geolocation permission for the current origin.'),
      permissions: z.array(z.string()).optional().describe('Permissions to grant for the current origin, e.g. ["notifications", "midi"]. For clipboard-read/clipboard-write specifically, use browser_clipboard instead — this generic path does not reliably grant clipboard permissions in headless Chrome.'),
      networkThrottle: z.enum([...NETWORK_PRESETS, 'offline', 'none']).optional().describe('Named network condition preset, "offline" to disable the network, or "none" to clear throttling'),
      cpuThrottle: z.number().optional().describe('CPU slowdown factor (e.g. 4 = 4x slower). Pass 1 to clear.'),
      sessionId: z.string().optional().describe('Puppeteer session ID for headless mode. Skips mode selection.'),
      mode: z.enum(['headless', 'connect']).optional().describe('Force a specific mode. Defaults to extension.')
    })
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const {
      device, colorScheme, reducedMotion, timezone, locale, geolocation, permissions,
      networkThrottle, cpuThrottle, sessionId, mode
    } = args as {
      device?: string;
      colorScheme?: 'light' | 'dark' | 'no-preference';
      reducedMotion?: 'reduce' | 'no-preference';
      timezone?: string;
      locale?: string;
      geolocation?: { latitude: number; longitude: number };
      permissions?: string[];
      networkThrottle?: (typeof NETWORK_PRESETS)[number] | 'offline' | 'none';
      cpuThrottle?: number;
      sessionId?: string;
      mode?: 'headless' | 'connect';
    };

    if (device && !(device in KnownDevices)) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ code: 'UNKNOWN_DEVICE', message: `Unknown device: "${device}"` }) }]
      };
    }

    try {
      const modeResult = await selectMode({ sessionId, forceMode: mode });
      logger.info('browser_emulate', { mode: modeResult.mode, sessionId: modeResult.sessionId });

      const session = getSession(modeResult.sessionId!);
      const applied: string[] = [];

      if (device) {
        await session.page.emulate(KnownDevices[device as keyof typeof KnownDevices]);
        applied.push('device');
      }

      if (colorScheme || reducedMotion) {
        const features = [];
        if (colorScheme) features.push({ name: 'prefers-color-scheme', value: colorScheme });
        if (reducedMotion) features.push({ name: 'prefers-reduced-motion', value: reducedMotion });
        await session.page.emulateMediaFeatures(features as never);
        applied.push('mediaFeatures');
      }

      if (timezone) {
        await session.page.emulateTimezone(timezone);
        applied.push('timezone');
      }

      if (locale) {
        await session.page.setExtraHTTPHeaders({ 'Accept-Language': locale });
        applied.push('locale');
      }

      if (geolocation) {
        await session.page.browserContext().overridePermissions(session.page.url(), ['geolocation'] as never);
        await session.page.setGeolocation(geolocation);
        applied.push('geolocation');
      }

      if (permissions) {
        await session.page.browserContext().overridePermissions(session.page.url(), permissions as never);
        applied.push('permissions');
      }

      if (networkThrottle) {
        if (networkThrottle === 'offline') {
          await session.page.setOfflineMode(true);
        } else if (networkThrottle === 'none') {
          await session.page.setOfflineMode(false);
          await session.page.emulateNetworkConditions(null);
        } else {
          await session.page.emulateNetworkConditions(PredefinedNetworkConditions[networkThrottle]);
        }
        applied.push('networkThrottle');
      }

      if (cpuThrottle !== undefined) {
        await session.page.emulateCPUThrottling(cpuThrottle === 1 ? null : cpuThrottle);
        applied.push('cpuThrottle');
      }

      return { content: [{ type: 'text', text: JSON.stringify({ success: true, applied }) }] };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('browser_emulate failed', { error: String(error) });
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
