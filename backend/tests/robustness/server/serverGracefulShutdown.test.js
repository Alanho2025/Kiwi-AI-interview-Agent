import { describe, expect, it, vi } from 'vitest';

import { createGracefulShutdown } from '../../../src/services/serverGracefulShutdownService.js';

const createLogger = () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
});

const createServer = (events) => ({
  close: vi.fn((callback) => {
    events.push('http-close');
    callback();
  }),
  closeAllConnections: vi.fn(() => {
    events.push('http-force-close');
  }),
});

const createWebSocketServer = (events, { closeCompletes = true } = {}) => {
  const client = {
    close: vi.fn(() => {
      events.push('websocket-client-close');
    }),
    terminate: vi.fn(() => {
      events.push('websocket-client-terminate');
    }),
  };
  return {
    client,
    server: {
      clients: new Set([client]),
      close: vi.fn((callback) => {
        events.push('websocket-close');
        if (closeCompletes) callback();
      }),
    },
  };
};

describe('server graceful shutdown', () => {
  it('stops ingress, drains workers and sockets, closes databases, then exits cleanly', async () => {
    const events = [];
    const httpServer = createServer(events);
    const websocket = createWebSocketServer(events);
    const worker = {
      stop: vi.fn(async () => {
        events.push('worker-stop');
      }),
    };
    const closeDatabases = vi.fn(async () => {
      events.push('database-close');
    });
    const exit = vi.fn((code) => {
      events.push(`exit-${code}`);
    });
    const controller = createGracefulShutdown({
      closeDatabases,
      exit,
      httpServer,
      logger: createLogger(),
      timeoutMs: 100,
      webSocketServers: [websocket.server],
      workers: [worker],
    });

    await controller.shutdown('SIGTERM');

    expect(httpServer.close).toHaveBeenCalledOnce();
    expect(websocket.server.close).toHaveBeenCalledOnce();
    expect(websocket.client.close).toHaveBeenCalledWith(1001, 'server-shutdown');
    expect(worker.stop).toHaveBeenCalledOnce();
    expect(closeDatabases).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
    expect(events.indexOf('http-close')).toBeLessThan(events.indexOf('worker-stop'));
    expect(events.indexOf('database-close')).toBeLessThan(events.indexOf('exit-0'));
  });

  it('coalesces repeated shutdown signals into one shutdown run', async () => {
    const events = [];
    const exit = vi.fn();
    const controller = createGracefulShutdown({
      closeDatabases: vi.fn(),
      exit,
      httpServer: createServer(events),
      logger: createLogger(),
      timeoutMs: 100,
      webSocketServers: [],
      workers: [],
    });

    await Promise.all([
      controller.shutdown('SIGTERM'),
      controller.shutdown('SIGINT'),
    ]);

    expect(exit).toHaveBeenCalledOnce();
  });

  it('forces lingering connections closed after the shutdown timeout', async () => {
    const events = [];
    const httpServer = createServer(events);
    const websocket = createWebSocketServer(events, { closeCompletes: false });
    const neverSettles = new Promise(() => {});
    const closeDatabases = vi.fn();
    const exit = vi.fn();
    const controller = createGracefulShutdown({
      closeDatabases,
      exit,
      httpServer,
      logger: createLogger(),
      timeoutMs: 5,
      webSocketServers: [websocket.server],
      workers: [{ stop: vi.fn(() => neverSettles) }],
    });

    await controller.shutdown('SIGTERM');

    expect(httpServer.closeAllConnections).toHaveBeenCalledOnce();
    expect(websocket.client.terminate).toHaveBeenCalledOnce();
    expect(closeDatabases).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
