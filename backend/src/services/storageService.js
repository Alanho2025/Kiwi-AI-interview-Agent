import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '../../uploads');

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const saveBufferToLocalStorage = async ({ buffer, originalFilename, folder }) => {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const relativePath = path.join(folder, fileName);
  const absolutePath = path.join(uploadsRoot, relativePath);

  await ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, buffer);

  return {
    storageProvider: 'local',
    storageKey: relativePath.replace(/\\/g, '/'),
    absolutePath,
  };
};

export const saveTextToLocalStorage = async ({ text, suggestedFilename, folder }) => {
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${suggestedFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const relativePath = path.join(folder, fileName);
  const absolutePath = path.join(uploadsRoot, relativePath);

  await ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, text, 'utf8');

  return {
    storageProvider: 'local',
    storageKey: relativePath.replace(/\\/g, '/'),
    absolutePath,
  };
};
