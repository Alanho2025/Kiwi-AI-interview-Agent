import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

let isConnected = false;

export const connectMongo = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  const uri = process.env.MongoDB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MongoDB_URI is not configured');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  isConnected = true;
  return mongoose.connection;
};

export const disconnectMongo = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
};
