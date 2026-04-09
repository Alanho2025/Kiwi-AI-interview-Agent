import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import api from './src/api.js';
import { bootstrapDatabases } from './src/db/bootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

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
      console.log(`API server running on http://localhost:${PORT}`);
      if (!startup.mongo?.ok) {
        console.warn('[Startup] Running in degraded mode: Mongo is unavailable. Postgres-backed routes can still work.');
      }
    });
  } catch (error) {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
