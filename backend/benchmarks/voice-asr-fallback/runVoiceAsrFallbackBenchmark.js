#!/usr/bin/env node
/**
 * Benchmark-only spike for live interview cloud STT choices.
 *
 * Purpose:
 * - Azure remains the current primary streaming STT baseline.
 * - ElevenLabs realtime STT is the cloud fallback candidate when network access is available.
 * - This file is intentionally not imported by production code.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createElevenLabsRealtimeSttProvider } from './adapters/elevenlabsRealtimeSttProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const BACKEND_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_CHUNK_MS = 20;
const DEFAULT_FIXTURE_MANIFEST = path.join(__dirname, 'fixtures.example.json');
const DEFAULT_PROVIDERS = 'elevenlabs-realtime';
const HARD_FINAL_DELAY_MS = 1000;
const HARD_AI_AUDIO_WINDOW_MS = 3000;
const MIN_KEYWORD_RECALL = 0.8;
const MAX_WER = 0.3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

const loadBenchmarkEnv = () => {
  const candidatePaths = [
    process.env.ASR_BENCHMARK_ENV_FILE,
    path.join(BACKEND_ROOT, '.env'),
    path.join(BACKEND_ROOT, '.env.local'),
    path.join(REPO_ROOT, '.env'),
    path.join(REPO_ROOT, '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
  ].filter(Boolean);

  const seen = new Set();
  for (const envPath of candidatePaths) {
    const resolvedPath = path.resolve(envPath);
    if (seen.has(resolvedPath)) continue;
    seen.add(resolvedPath);
    if (fsSync.existsSync(resolvedPath)) dotenv.config({ path: resolvedPath, override: false, quiet: true });
  }
};

loadBenchmarkEnv();

const parseProviderList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    manifest: process.env.ASR_BENCHMARK_MANIFEST || DEFAULT_FIXTURE_MANIFEST,
    providers: parseProviderList(process.env.ASR_BENCHMARK_PROVIDERS || DEFAULT_PROVIDERS),
    chunkMs: Number(process.env.ASR_BENCHMARK_CHUNK_MS || DEFAULT_CHUNK_MS),
    realtime: process.env.ASR_BENCHMARK_REALTIME !== 'false',
    output: process.env.ASR_BENCHMARK_OUTPUT || path.join(__dirname, 'results.cloud-stt.json'),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--manifest') options.manifest = args[++index];
    if (arg === '--providers') options.providers = parseProviderList(args[++index]);
    if (arg === '--chunk-ms') options.chunkMs = Number(args[++index]);
    if (arg === '--fast') options.realtime = false;
    if (arg === '--output') options.output = args[++index];
  }
  return options;
};

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const readWavAsPcm = async (audioPath) => {
  const buffer = await fs.readFile(audioPath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return { pcm: buffer, sampleRate: DEFAULT_SAMPLE_RATE, channels: 1, bitsPerSample: 16, sourceFormat: 'raw-pcm' };
  }

  let offset = 12;
  let fmt = null;
  let data = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === 'fmt ') {
      fmt = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    }
    if (chunkId === 'data') {
      data = buffer.subarray(chunkStart, chunkStart + chunkSize);
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!fmt || !data) throw new Error(`Invalid WAV fixture: ${audioPath}`);
  if (fmt.audioFormat !== 1 || fmt.channels !== 1 || fmt.sampleRate !== DEFAULT_SAMPLE_RATE || fmt.bitsPerSample !== 16) {
    throw new Error(`Fixture must be PCM 16 kHz mono 16-bit WAV: ${audioPath}`);
  }

  return { pcm: data, sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bitsPerSample, sourceFormat: 'wav-pcm' };
};

const splitPcmChunks = ({ pcm, sampleRate, chunkMs }) => {
  const bytesPerSample = 2;
  const bytesPerChunk = Math.max(2, Math.floor((sampleRate * bytesPerSample * chunkMs) / 1000));
  const chunks = [];
  for (let offset = 0; offset < pcm.length; offset += bytesPerChunk) {
    chunks.push(pcm.subarray(offset, Math.min(offset + bytesPerChunk, pcm.length)));
  }
  return chunks;
};

const tokenize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9+#.\s-]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

const levenshtein = (a, b) => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
};

const wordErrorRate = ({ expected, actual }) => {
  const expectedWords = tokenize(expected);
  const actualWords = tokenize(actual);
  if (!expectedWords.length) return null;
  return levenshtein(expectedWords, actualWords) / expectedWords.length;
};

const keywordRecall = ({ expectedKeywords = [], actual }) => {
  const actualText = String(actual || '').toLowerCase();
  const keywords = expectedKeywords.map((item) => String(item).toLowerCase()).filter(Boolean);
  if (!keywords.length) return null;
  const hits = keywords.filter((keyword) => actualText.includes(keyword));
  return { score: hits.length / keywords.length, hits, misses: keywords.filter((keyword) => !hits.includes(keyword)) };
};

const getResourceSnapshot = () => ({ rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed, cpuUsage: process.cpuUsage() });

const diffResourceSnapshot = (before, after) => ({
  rssDeltaMb: Number(((after.rssBytes - before.rssBytes) / 1024 / 1024).toFixed(2)),
  heapDeltaMb: Number(((after.heapUsedBytes - before.heapUsedBytes) / 1024 / 1024).toFixed(2)),
  cpuUserMs: Number(((after.cpuUsage.user - before.cpuUsage.user) / 1000).toFixed(2)),
  cpuSystemMs: Number(((after.cpuUsage.system - before.cpuUsage.system) / 1000).toFixed(2)),
});

const buildAcceptance = ({ firstPartialMs, speechEndMs, finalTranscriptDelayAfterSpeechEndMs, aiFirstAudioPossibleAfterSpeechEndMs, keywordRecallResult, wer, errors }) => {
  const hasPartialBeforeSpeechEnd = Number.isFinite(firstPartialMs) && Number.isFinite(speechEndMs) && firstPartialMs < speechEndMs;
  const finalReadyWithin1s = Number.isFinite(finalTranscriptDelayAfterSpeechEndMs) && finalTranscriptDelayAfterSpeechEndMs <= HARD_FINAL_DELAY_MS;
  const aiFirstAudioPossibleWithin5s = Number.isFinite(aiFirstAudioPossibleAfterSpeechEndMs) && aiFirstAudioPossibleAfterSpeechEndMs <= HARD_AI_AUDIO_WINDOW_MS;
  const keywordRecallPass = keywordRecallResult === null || keywordRecallResult.score >= MIN_KEYWORD_RECALL;
  const werPass = wer === null || wer <= MAX_WER;
  const noProviderErrors = !errors.length;
  const pass = hasPartialBeforeSpeechEnd && finalReadyWithin1s && aiFirstAudioPossibleWithin5s && keywordRecallPass && werPass && noProviderErrors;

  return {
    hasPartialBeforeSpeechEnd,
    finalReadyWithin1s,
    aiFirstAudioPossibleWithin5s,
    keywordRecallAtLeast80Percent: keywordRecallPass,
    werAtMost30Percent: werPass,
    noProviderErrors,
    pass,
    recommendation: pass ? 'cloud STT fallback candidate can continue to E2E test' : 'do not add as live STT fallback yet',
  };
};

const createAzureProvider = async ({ sampleRate, language = 'en-NZ', callbacks }) => {
  const { createRealtimeSpeechSession } = await import('../../src/services/voice/realtimeSpeechSessionService.js');
  const session = createRealtimeSpeechSession({
    language,
    sampleRate,
    onPartialTranscript: callbacks.onPartial,
    onFinalTranscript: callbacks.onFinal,
    onError: callbacks.onError,
  });
  await session.start();
  return {
    name: 'azure',
    write: (chunk) => session.writeAudio(chunk),
    finalize: () => session.stop(),
    integrationComplexity: 'baseline: existing Azure streaming STT path',
  };
};

const providerFactories = {
  azure: createAzureProvider,
  'elevenlabs-realtime': createElevenLabsRealtimeSttProvider,
};

const runProviderFixture = async ({ providerName, fixture, options }) => {
  const audioPath = path.resolve(path.dirname(options.manifest), fixture.audioPath);
  const wav = await readWavAsPcm(audioPath);
  const chunks = splitPcmChunks({ pcm: wav.pcm, sampleRate: wav.sampleRate, chunkMs: options.chunkMs });
  const audioDurationMs = Math.round((wav.pcm.length / (wav.sampleRate * 2)) * 1000);
  const events = [];
  const errors = [];
  const finalSegments = [];
  const startedAt = nowMs();
  let firstPartialMs = null;
  let latestFinalMs = null;
  let speechEndMs;

  const callbacks = {
    onPartial: (payload) => {
      const eventTime = nowMs() - startedAt;
      const text = String(payload.text || payload.displayText || '').trim();
      if (firstPartialMs === null) firstPartialMs = eventTime;
      events.push({ type: 'partial', atMs: eventTime, text });
    },
    onFinal: (payload) => {
      const eventTime = nowMs() - startedAt;
      const text = String(payload.displayText || payload.normalizedText || payload.rawText || payload.text || '').trim();
      latestFinalMs = eventTime;
      if (text) finalSegments.push(text);
      events.push({ type: 'final', atMs: eventTime, text });
    },
    onError: (payload) => errors.push(payload?.errorDetails || payload?.message || payload?.reason || String(payload)),
  };

  const factory = providerFactories[providerName];
  if (!factory) throw new Error(`Unknown cloud STT provider: ${providerName}`);

  const before = getResourceSnapshot();
  const provider = await factory({ sampleRate: wav.sampleRate, language: fixture.language || 'en-NZ', callbacks, fixture });

  for (const chunk of chunks) {
    provider.write(chunk);
    if (options.realtime) await sleep(options.chunkMs);
  }

  speechEndMs = nowMs() - startedAt;
  await provider.finalize();
  const finishedAt = nowMs() - startedAt;
  const after = getResourceSnapshot();

  const finalTranscriptText = finalSegments.join(' ').replace(/\s+/g, ' ').trim();
  const finalTranscriptDelayAfterSpeechEndMs = latestFinalMs === null ? null : Math.max(0, latestFinalMs - speechEndMs);
  const aiFirstAudioPossibleAfterSpeechEndMs = finalTranscriptDelayAfterSpeechEndMs;
  const wer = fixture.expectedTranscript ? wordErrorRate({ expected: fixture.expectedTranscript, actual: finalTranscriptText }) : null;
  const recall = keywordRecall({ expectedKeywords: fixture.keywords || [], actual: finalTranscriptText });
  const acceptance = buildAcceptance({
    firstPartialMs,
    speechEndMs,
    finalTranscriptDelayAfterSpeechEndMs,
    aiFirstAudioPossibleAfterSpeechEndMs,
    keywordRecallResult: recall,
    wer,
    errors,
  });

  return {
    provider: providerName,
    fixture: fixture.id,
    expectedDurationMs: fixture.expectedDurationMs || audioDurationMs,
    measuredAudioDurationMs: audioDurationMs,
    chunkMs: options.chunkMs,
    realtimeFeed: options.realtime,
    firstPartialMs,
    speechEndMs,
    finalTranscriptDelayAfterSpeechEndMs,
    aiFirstAudioPossibleAfterSpeechEndMs,
    totalWallTimeMs: finishedAt,
    finalTranscriptText,
    keywordRecall: recall,
    wer,
    resourceUse: diffResourceSnapshot(before, after),
    eventCounts: { partial: events.filter((event) => event.type === 'partial').length, final: events.filter((event) => event.type === 'final').length },
    errors,
    integrationComplexity: provider.integrationComplexity,
    benchmarkMetadata: provider.benchmarkMetadata || null,
    acceptance,
  };
};

const main = async () => {
  const options = parseArgs();
  const manifest = await readJson(options.manifest);
  const fixtures = manifest.fixtures || [];
  if (!fixtures.length) throw new Error('Benchmark manifest has no fixtures.');

  const results = [];
  for (const providerName of options.providers) {
    for (const fixture of fixtures) {
      try {
        results.push(await runProviderFixture({ providerName, fixture, options }));
      } catch (error) {
        results.push({
          provider: providerName,
          fixture: fixture.id,
          skipped: true,
          error: error?.message || String(error),
          acceptance: {
            hasPartialBeforeSpeechEnd: false,
            finalReadyWithin1s: false,
            aiFirstAudioPossibleWithin5s: false,
            keywordRecallAtLeast80Percent: false,
            werAtMost30Percent: false,
            noProviderErrors: false,
            pass: false,
            recommendation: 'benchmark failed before metrics were collected; check provider credentials, fixture loading, or API availability',
          },
        });
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    benchmarkIntent: 'Evaluate Azure baseline and ElevenLabs realtime STT as a cloud fallback candidate.',
    hardAcceptance: {
      finalTranscriptDelayAfterSpeechEndMs: HARD_FINAL_DELAY_MS,
      aiFirstAudioPossibleAfterSpeechEndMs: HARD_AI_AUDIO_WINDOW_MS,
      keywordRecallMinimum: MIN_KEYWORD_RECALL,
      werMaximum: MAX_WER,
      partialRequiredBeforeSpeechEnd: true,
    },
    options,
    results,
  };

  await fs.writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
