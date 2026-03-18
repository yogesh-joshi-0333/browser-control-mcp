import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';
import type { IWsRequest, IWsResponse, IErrorResponse } from './types.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

interface IPendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: IErrorResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

let wss: WebSocketServer | null = null;
let extensionSocket: WebSocket | null = null;
let socketId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const pendingRequests = new Map<string, IPendingRequest>();

function isValidOrigin(origin: string | undefined): boolean {
  return typeof origin === 'string' && origin.startsWith('chrome-extension://');
}

export function getConnectionState(): { connected: boolean; socketId: string | null } {
  return { connected: extensionSocket !== null, socketId };
}

export async function sendToExtension(
  request: Omit<IWsRequest, 'id'>,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Record<string, unknown>> {
  if (!extensionSocket) {
    return Promise.reject({ code: 'EXTENSION_NOT_CONNECTED', message: 'Chrome Extension is not connected' } satisfies IErrorResponse);
  }

  const id = randomUUID();
  const message: IWsRequest = { id, ...request };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject({ code: 'TIMEOUT_ERROR', message: `Request timed out after ${timeoutMs}ms` } satisfies IErrorResponse);
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });

    try {
      extensionSocket!.send(JSON.stringify(message));
    } catch {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject({ code: 'WS_SEND_FAILED', message: 'Failed to send message to extension' } satisfies IErrorResponse);
    }
  });
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!extensionSocket) return;
    let alive = false;
    extensionSocket.ping();
    const timeout = setTimeout(() => {
      if (!alive && extensionSocket) {
        logger.warn('Extension heartbeat timeout — disconnecting');
        extensionSocket.terminate();
        extensionSocket = null;
        socketId = null;
      }
    }, HEARTBEAT_TIMEOUT_MS);
    extensionSocket.once('pong', () => {
      alive = true;
      clearTimeout(timeout);
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export async function startWebSocketServer(port = 9999): Promise<void> {
  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({ host: '127.0.0.1', port });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const origin = req.headers.origin;

      if (!isValidOrigin(origin)) {
        logger.warn('Rejected WebSocket connection from invalid origin', { origin });
        ws.close(1008, 'Invalid origin');
        return;
      }

      if (extensionSocket) {
        logger.warn('New extension connected — replacing existing connection');
        extensionSocket.terminate();
      }

      extensionSocket = ws;
      socketId = randomUUID();
      logger.info('Chrome Extension connected', { socketId, origin });
      startHeartbeat();

      ws.on('message', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString()) as IWsResponse;
          const pending = pendingRequests.get(response.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          pendingRequests.delete(response.id);
          if (response.success && response.data) {
            pending.resolve(response.data);
          } else {
            pending.reject(response.error ?? { code: 'WS_SEND_FAILED', message: 'Unknown error' });
          }
        } catch (error) {
          logger.error('Failed to parse extension message', { error: String(error) });
        }
      });

      ws.on('close', () => {
        if (extensionSocket === ws) {
          extensionSocket = null;
          socketId = null;
          stopHeartbeat();
          logger.info('Chrome Extension disconnected');
        }
      });

      ws.on('error', (error: Error) => {
        logger.error('Extension WebSocket error', { error: error.message });
      });
    });

    wss.on('listening', () => {
      logger.info('WebSocket server started', { port });
      resolve();
    });

    wss.on('error', reject);
  });
}

export async function stopWebSocketServer(): Promise<void> {
  stopHeartbeat();
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject({ code: 'WS_SEND_FAILED', message: 'Server shutting down' });
    pendingRequests.delete(id);
  }
  if (extensionSocket) {
    extensionSocket.terminate();
    extensionSocket = null;
    socketId = null;
  }
  return new Promise((resolve) => {
    if (!wss) { resolve(); return; }
    wss.close(() => { wss = null; resolve(); });
  });
}
