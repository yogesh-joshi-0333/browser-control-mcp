import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { statusTool } from './tools/status.js';
import { screenshotTool } from './tools/screenshot.js';
import { getUrlTool } from './tools/get-url.js';
import { startWebSocketServer, stopWebSocketServer } from './websocket.js';
import { destroyAll } from './puppeteer-manager.js';
import { WS_PORT } from './config.js';
import type { ITool } from './types.js';

const tools: ITool[] = [
  statusTool,
  screenshotTool,
  getUrlTool
];

async function shutdown(): Promise<void> {
  logger.info('Shutting down browser-control MCP server...');
  await stopWebSocketServer();
  await destroyAll();
  process.exit(0);
}

async function main(): Promise<void> {
  await startWebSocketServer(WS_PORT);

  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT', () => { void shutdown(); });

  const server = new McpServer(
    { name: 'browser-control', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );

  for (const tool of tools) {
    server.registerTool(tool.name, tool.options, tool.handler);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('browser-control MCP server started', { tools: tools.map(t => t.name) });
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({
    level: 'error',
    message: 'Fatal startup error',
    error: String(error)
  }) + '\n');
  process.exit(1);
});
