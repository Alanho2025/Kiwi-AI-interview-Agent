/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: mongo should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

let listenersRegistered = false;
let connectPromise = null;
let lastMongoError = null;

/**
 * Purpose: Execute the main responsibility for getMongoUri.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const getMongoUri = () => process.env.MongoDB_URI || process.env.MONGODB_URI;

const registerConnectionListeners = () => {
  if (listenersRegistered) {
    return;
  }

  mongoose.connection.on('connected', () => {
    lastMongoError = null;
    console.log('[Mongo] Connected');
  });

  mongoose.connection.on('error', (error) => {
    lastMongoError = error?.message || 'Unknown Mongo connection error';
    console.error('[Mongo] Connection error:', lastMongoError);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Mongo] Disconnected');
  });

  listenersRegistered = true;
};

/**
 * Purpose: Execute the main responsibility for getMongoReadyState.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getMongoReadyState = () => mongoose.connection.readyState;
export const getLastMongoError = () => lastMongoError;

export const connectMongo = async () => {
  const readyState = getMongoReadyState();

  if (readyState === 1) {
    return mongoose.connection;
  }

  if (readyState === 2 && connectPromise) {
    return connectPromise;
  }

  const uri = getMongoUri();
  if (!uri) {
    lastMongoError = 'MongoDB_URI is not configured';
    throw new Error(lastMongoError);
  }

  registerConnectionListeners();

  connectPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
  });

  try {
    await connectPromise;
    lastMongoError = null;
    return mongoose.connection;
  } catch (error) {
    lastMongoError = error?.message || 'Unknown Mongo startup error';
    throw error;
  } finally {
    connectPromise = null;
  }
};

/**
 * Purpose: Execute the main responsibility for checkMongoHealth.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const checkMongoHealth = async () => ({
  ok: getMongoReadyState() === 1,
  readyState: getMongoReadyState(),
  dbName: mongoose.connection?.name || null,
  message: lastMongoError,
});

/**
 * Purpose: Execute the main responsibility for disconnectMongo.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const disconnectMongo = async () => {
  if (getMongoReadyState() !== 0) {
    await mongoose.disconnect();
  }
};
