/**
 * File responsibility: Application entry point.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: index should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import http from 'http';

import api from './src/api.js';
import { attachRealtimeVoiceSocketServer } from './src/api/realtimeVoiceSocket.js';
import { attachDuplexVoiceSocketServer } from './src/api/duplexVoiceSocket.js';
import { bootstrapDatabases } from './src/db/bootstrap.js';
import { disconnectMongo } from './src/db/mongo.js';
import { closePostgres } from './src/db/postgres.js';
import { startRecordingConversionWorker } from './src/services/recording/recordingConversionWorker.js';
import { startRetentionWorker } from './src/services/retention/retentionWorker.js';
import {
  createGracefulShutdown,
  registerShutdownSignals,
} from './src/services/serverGracefulShutdownService.js';
import { logger } from './src/utils/logger.js';
import {
  getBooleanEnv,
  getServerPort,
  getShutdownTimeoutMs,
  getTrustedProxyHops,
  loadEnv,
} from './src/config/env.js';

loadEnv();

/**
 * Purpose: Execute the main responsibility for startServer.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
async function startServer() {
  try {
    const startup = await bootstrapDatabases({
      mongoRequired: getBooleanEnv('MONGO_REQUIRED', false),
      postgresRequired: getBooleanEnv('POSTGRES_REQUIRED', false),
    });

    const app = express();
    const PORT = getServerPort();

    const trustedProxyHops = getTrustedProxyHops();
    if (process.env.NODE_ENV === 'production' && trustedProxyHops === 1) {
      app.set('trust proxy', trustedProxyHops);
    }

    app.locals.startupStatus = startup;

    app.get('/', (req, res) => {
      res.json({ ok: true, service: 'kiwi-ai-agent-backend', health: '/api/health' });
    });

    app.get('/health', (req, res) => {
      res.json({ ok: true, service: 'kiwi-ai-agent-backend', health: '/api/health' });
    });

    // Keep the canonical /api routes, and also support legacy frontend builds
    // that still call /auth/... without the /api prefix.
    app.use('/api', api);
    app.use('/', api);

    const server = http.createServer(app);
    const webSocketServers = [
      attachRealtimeVoiceSocketServer(server),
      attachDuplexVoiceSocketServer(server),
    ];
    const workers = [];
    const shutdownController = createGracefulShutdown({
      closeDatabases: async () => {
        const results = await Promise.allSettled([
          closePostgres(),
          disconnectMongo(),
        ]);
        const failures = results
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason);
        if (failures.length > 0) {
          throw new AggregateError(failures, 'Database connections did not close cleanly');
        }
      },
      httpServer: server,
      logger,
      timeoutMs: getShutdownTimeoutMs(),
      webSocketServers,
      workers,
    });
    registerShutdownSignals({ shutdown: shutdownController.shutdown });

    server.listen(PORT, '0.0.0.0', () => {
      logger.info('API server started', { port: PORT, url: `http://localhost:${PORT}` });
      if (!startup.mongo?.ok) {
        logger.warn('Running in degraded mode because Mongo is unavailable', { port: PORT });
      }
      try {
        if (startup.mongo?.ok && startup.postgres?.ok && getBooleanEnv('RETENTION_WORKER_ENABLED', false)) {
          workers.push(startRetentionWorker());
        }
        if (startup.postgres?.ok && getBooleanEnv('RECORDING_WORKER_ENABLED', true)) {
          workers.push(startRecordingConversionWorker());
        }
      } catch (error) {
        logger.error('Background worker failed to start', { error });
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
