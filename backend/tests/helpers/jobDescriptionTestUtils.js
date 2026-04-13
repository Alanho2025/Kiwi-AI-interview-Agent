import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureRoot = path.resolve(__dirname, '../fixtures/jobDescription');

export const loadJdFixture = async (name) => {
  const filePath = path.join(fixtureRoot, name);
  return fs.readFile(filePath, 'utf8');
};

export const withDisabledAiEnhancement = () => {
  const previous = process.env.DISABLE_AI_JD_ENHANCEMENT;
  process.env.DISABLE_AI_JD_ENHANCEMENT = 'true';
  return () => {
    if (previous === undefined) delete process.env.DISABLE_AI_JD_ENHANCEMENT;
    else process.env.DISABLE_AI_JD_ENHANCEMENT = previous;
  };
};
