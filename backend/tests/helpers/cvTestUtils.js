import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.join(__dirname, '..', 'fixtures', 'cv');

export const readCvFixture = (filename) => fs.readFileSync(path.join(fixturesRoot, filename), 'utf8');
