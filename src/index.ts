import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { statusTool } from './tools/status.js';
import type { ITool } from './types.js';

const tools: ITool[] = [
  statusTool
];

async function main(): Promise<void> {
  const server = new McpServer(
    { name: 'browser-control', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.options.description,
        inputSchema: tool.options.inputSchema,
        ...(tool.options.outputSchema !== undefined ? { outputSchema: tool.options.outputSchema } : {})
      },
      tool.handler
    );
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
