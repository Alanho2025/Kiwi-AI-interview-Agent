/**
 * File responsibility: Coordinate bounded server shutdown.
 * Main responsibilities:
 * - Stop accepting new HTTP and WebSocket work.
 * - Drain background workers and active socket cleanup.
 * - Close database connections before exiting.
 */

const CLOSE_CODE_SERVICE_RESTART = 1001;
const CLOSE_REASON_SERVICE_RESTART = 'server-shutdown';

const createTimeout = (timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error(`Graceful shutdown timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  timer.unref?.();
});

const settleWithin = (promise, timeoutMs) =>
  Promise.race([promise, createTimeout(timeoutMs)]);

const closeHttpServer = (httpServer) => new Promise((resolve, reject) => {
  try {
    httpServer.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error);
        return;
      }
      resolve();
    });
  } catch (error) {
    if (error?.code === 'ERR_SERVER_NOT_RUNNING') {
      resolve();
      return;
    }
    reject(error);
  }
});

const requestWebSocketClose = (webSocketServer) => new Promise((resolve, reject) => {
  for (const client of webSocketServer.clients || []) {
    try {
      client.close(CLOSE_CODE_SERVICE_RESTART, CLOSE_REASON_SERVICE_RESTART);
    } catch {
      client.terminate?.();
    }
  }

  try {
    webSocketServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  } catch (error) {
    reject(error);
  }
});

const stopWorker = async (worker) => {
  await worker?.stop?.();
};

const drainRuntime = async ({
  httpServer,
  webSocketServers,
  workers,
}) => {
  const results = await Promise.allSettled([
    closeHttpServer(httpServer),
    ...webSocketServers.map(requestWebSocketClose),
    ...workers.map(stopWorker),
  ]);
  const failures = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);

  if (failures.length > 0) {
    throw new AggregateError(failures, 'One or more runtime resources failed to drain');
  }
};

const forceCloseRuntime = ({ httpServer, webSocketServers }) => {
  httpServer.closeAllConnections?.();
  for (const webSocketServer of webSocketServers) {
    for (const client of webSocketServer.clients || []) {
      client.terminate?.();
    }
  }
};

export const createGracefulShutdown = ({
  closeDatabases = async () => {},
  exit = (code) => process.exit(code),
  httpServer,
  logger,
  timeoutMs = 30000,
  webSocketServers = [],
  workers = [],
}) => {
  let shutdownPromise = null;

  const runShutdown = async (signal) => {
    let exitCode = 0;
    const deadlineAt = Date.now() + timeoutMs;
    const getRemainingTimeoutMs = () => Math.max(1, deadlineAt - Date.now());
    logger.info('Graceful shutdown started', { signal, timeoutMs });

    try {
      await settleWithin(
        drainRuntime({ httpServer, webSocketServers, workers }),
        getRemainingTimeoutMs(),
      );
    } catch (error) {
      exitCode = 1;
      logger.warn('Graceful shutdown drain did not complete', { error, signal });
      forceCloseRuntime({ httpServer, webSocketServers });
    }

    try {
      await settleWithin(
        Promise.resolve(closeDatabases()),
        getRemainingTimeoutMs(),
      );
    } catch (error) {
      exitCode = 1;
      logger.error('Database shutdown did not complete', { error, signal });
    }

    logger.info('Graceful shutdown completed', { exitCode, signal });
    exit(exitCode);
  };

  const shutdown = (signal) => {
    if (!shutdownPromise) {
      shutdownPromise = runShutdown(signal);
    }
    return shutdownPromise;
  };

  return { shutdown };
};

export const registerShutdownSignals = ({
  processRef = process,
  shutdown,
}) => {
  processRef.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  processRef.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
};
