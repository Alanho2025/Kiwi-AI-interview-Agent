import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo } from '../db/mongo.js';
import { DocumentChunk } from '../db/models/documentChunkModel.js';
import { RagBenchmarkCase } from '../db/models/ragBenchmarkCaseModel.js';
import { NormalizedCvProfile } from '../db/models/normalizedCvProfileModel.js';
import { NormalizedJdRubric } from '../db/models/normalizedJdRubricModel.js';
import { EvaluationGroundTruth } from '../db/models/evaluationGroundTruthModel.js';
import { embedBatch } from '../services/embeddingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultInputDir = path.resolve(__dirname, '../../../../data/resume-score-details-normalized');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const formatPercent = (current, total) => {
  if (!total) return '0%';
  return `${Math.floor((current / total) * 100)}%`;
};

const renderProgressBar = (current, total, label = '', barWidth = 30) => {
  const safeTotal = Math.max(total, 1);
  const percent = current / safeTotal;
  const filled = Math.round(barWidth * percent);
  const empty = barWidth - filled;
  const bar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;

  process.stdout.write(
    `\r${label} [${bar}] ${current}/${total} (${formatPercent(current, total)})`
  );

  if (current >= total) {
    process.stdout.write('\n');
  }
};

const upsertMany = async (Model, items, keyField, label = 'Progress') => {
  const total = items.length;

  if (!total) {
    console.log(`${label}: no items to process`);
    return;
  }

  console.log(`\n${label} started`);
  renderProgressBar(0, total, label);

  for (let i = 0; i < total; i += 1) {
    const item = items[i];
    await Model.findOneAndUpdate(
      { [keyField]: item[keyField] },
      item,
      { upsert: true, setDefaultsOnInsert: true }
    );
    renderProgressBar(i + 1, total, label);
  }

  console.log(`${label} completed`);
};

const run = async ({ inputDir = defaultInputDir } = {}) => {
  console.log('\nConnecting to MongoDB...');
  await connectMongo();
  console.log('MongoDB connected');

  console.log('\nReading input files...');
  const cvProfiles = readJson(path.join(inputDir, 'normalized_cv_profiles.json'));
  const jdRubrics = readJson(path.join(inputDir, 'normalized_jd_rubrics.json'));
  const evaluationRows = readJson(path.join(inputDir, 'normalized_eval_ground_truth.json'));
  const chunks = readJson(path.join(inputDir, 'normalized_rag_chunks.json'));
  const benchmarkCases = readJson(path.join(inputDir, 'normalized_rag_benchmark_cases.json'));
  console.log('Input files loaded');

  console.log('\nGenerating embeddings...');
  const chunkTexts = chunks.map((item) => item.normalizedText || item.text || '');
  const chunkEmbeddings = await embedBatch(chunkTexts);
  console.log(`Embeddings completed: ${chunkEmbeddings.length}/${chunks.length}`);

  const hydratedChunks = chunks.map((item, index) => ({
    ...item,
    embedding: chunkEmbeddings[index] || [],
  }));

  await upsertMany(
    NormalizedCvProfile,
    cvProfiles.map((item) => ({
      caseId: item.caseId,
      candidateName: item.candidateName,
      profile: item,
      schemaVersion: item.schemaVersion || 'v3',
    })),
    'caseId',
    'Importing CV Profiles'
  );

  await upsertMany(
    NormalizedJdRubric,
    jdRubrics.map((item, index) => ({
      caseId: cvProfiles[index]?.caseId || String(index + 1),
      rubric: item,
      schemaVersion: item.schemaVersion || 'v3',
    })),
    'caseId',
    'Importing JD Rubrics'
  );

  await upsertMany(
    EvaluationGroundTruth,
    evaluationRows.map((item) => ({
      caseId: item.caseId,
      evaluation: item,
      schemaVersion: item.schemaVersion || 'v3',
    })),
    'caseId',
    'Importing Evaluation Ground Truth'
  );

  await upsertMany(
    DocumentChunk,
    hydratedChunks,
    'chunkId',
    'Importing Document Chunks'
  );

  await upsertMany(
    RagBenchmarkCase,
    benchmarkCases,
    'caseId',
    'Importing RAG Benchmark Cases'
  );

  console.log(
    `\nImported ${cvProfiles.length} CV profiles, ${jdRubrics.length} JD rubrics, ${evaluationRows.length} evaluation rows, ${hydratedChunks.length} chunks, and ${benchmarkCases.length} benchmark cases from ${inputDir}`
  );
};

if (process.argv[1] === __filename) {
  const inputDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultInputDir;
  run({ inputDir }).catch((error) => {
    console.error('\nImport failed:', error);
    process.exitCode = 1;
  });
}

export { run as importResumeScoreDetails };