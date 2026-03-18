import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebSocket as WsClient } from 'ws';
import { startWebSocketServer, stopWebSocketServer, getConnectionState, sendToExtension } from '../websocket.js';

const TEST_PORT = 9998;

describe('WebSocket server', () => {
  beforeEach(async () => {
    await startWebSocketServer(TEST_PORT);
  });

  afterEach(async () => {
    await stopWebSocketServer();
  });

  it('starts and reports disconnected state initially', () => {
    const state = getConnectionState();
    expect(state.connected).toBe(false);
    expect(state.socketId).toBeNull();
  });

  it('accepts connection from chrome-extension:// origin', (done) => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'chrome-extension://abcdefghijklmnop' }
    });
    client.on('open', () => {
      setTimeout(() => {
        const state = getConnectionState();
        expect(state.connected).toBe(true);
        client.close();
        done();
      }, 50);
    });
  });

  it('rejects connection from non-extension origin', (done) => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'http://localhost:3000' }
    });
    client.on('close', (code) => {
      expect(code).toBe(1008);
      done();
    });
    client.on('error', () => done());
  });

  it('reports disconnected after client closes', (done) => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'chrome-extension://abcdefghijklmnop' }
    });
    client.on('open', () => {
      client.close();
      setTimeout(() => {
        expect(getConnectionState().connected).toBe(false);
        done();
      }, 100);
    });
  });

  it('returns TIMEOUT_ERROR if no response within timeout', async () => {
    const client = new WsClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { origin: 'chrome-extension://abcdefghijklmnop' }
    });
    await new Promise<void>(resolve => client.on('open', () => resolve()));

    await expect(
      sendToExtension({ action: 'take_screenshot', payload: {} }, 500)
    ).rejects.toMatchObject({ code: 'TIMEOUT_ERROR' });

    client.close();
  });
});
