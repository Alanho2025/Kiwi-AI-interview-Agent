/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: storageService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '../../uploads');

/**
 * Purpose: Execute the main responsibility for ensureDir.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

/**
 * Purpose: Execute the main responsibility for saveBufferToLocalStorage.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for saveTextToLocalStorage.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
