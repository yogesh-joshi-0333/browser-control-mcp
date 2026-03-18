import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// MCP tool registry interface — used by index.ts to register tools
export interface ITool {
  name: string;
  options: {
    title?: string;
    description: string;
    inputSchema: ReturnType<typeof z.object>;
    outputSchema?: ReturnType<typeof z.object>;
  };
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

// WebSocket message interfaces — used from Phase 2 onward
export interface IWsRequest {
  id: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface IErrorResponse {
  code: string;
  message: string;
}

export interface IWsResponse {
  id: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: IErrorResponse;
}
