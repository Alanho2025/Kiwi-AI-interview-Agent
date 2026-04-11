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
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import api from './src/api.js';
import { bootstrapDatabases } from './src/db/bootstrap.js';
import { logger } from './src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

/**
 * Purpose: Execute the main responsibility for startServer.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
async function startServer() {
  try {
    const startup = await bootstrapDatabases({
      mongoRequired: String(process.env.MONGO_REQUIRED || '').toLowerCase() === 'true',
    });

    const app = express();
    const PORT = process.env.PORT || 3000;

    app.locals.startupStatus = startup;
    app.use('/api', api);

    app.listen(PORT, '0.0.0.0', () => {
      logger.info('API server started', { port: PORT, url: `http://localhost:${PORT}` });
      if (!startup.mongo?.ok) {
        logger.warn('Running in degraded mode because Mongo is unavailable', { port: PORT });
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
