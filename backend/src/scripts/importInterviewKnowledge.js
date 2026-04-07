import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo } from '../db/mongo.js';
import { DocumentChunk } from '../db/models/documentChunkModel.js';
import { embedBatch } from '../services/embeddingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultInputDir = path.resolve(__dirname, '../../../data/interview-knowledge');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const upsertMany = async (items) => {
  for (const item of items) {
    await DocumentChunk.findOneAndUpdate({ chunkId: item.chunkId }, item, { upsert: true, setDefaultsOnInsert: true });
  }
};

const run = async ({ inputDir = defaultInputDir } = {}) => {
  await connectMongo();
  const chunks = readJson(path.join(inputDir, 'normalized_interview_chunks.json'));
  const embeddings = await embedBatch(chunks.map((item) => item.normalizedText || item.text || ''));
  const hydrated = chunks.map((item, index) => ({ ...item, embedding: embeddings[index] || [] }));
  await upsertMany(hydrated);
  console.log(`Imported ${hydrated.length} interview knowledge chunks from ${inputDir}`);
};

if (process.argv[1] === __filename) {
  const inputDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultInputDir;
  run({ inputDir }).catch((error) => {
    console.error('Interview knowledge import failed:', error);
    process.exitCode = 1;
  });
}

export { run as importInterviewKnowledge };
