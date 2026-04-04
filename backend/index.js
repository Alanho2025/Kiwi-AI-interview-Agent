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
  await bootstrapDatabases();

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Mount API routes
  app.use('/api', api);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

startServer();
