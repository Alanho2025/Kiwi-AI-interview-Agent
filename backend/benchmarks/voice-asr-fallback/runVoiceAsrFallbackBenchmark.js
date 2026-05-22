#!/usr/bin/env node
/**
 * Benchmark-only spike for live interview ASR fallback choices.
 *
 * This file is intentionally not imported by production code.
 * It feeds 16 kHz mono PCM chunks into candidate ASR providers and records:
 * - first partial transcript availability
 * - final transcript readiness after speech_end
 * - keyword recall
 * - WER when expected transcript exists
 * - CPU/memory use
 * - integration complexity with existing PCM WebSocket chunks
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '../..');

// The benchmark is executed directly, outside backend/index.js, so it must load
// backend/.env itself before importing Azure/Vosk/Sherpa provider adapters.
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
dotenv.config({ path: path.join(BACKEND_ROOT, '.env.local'), override: true });

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_CHUNK_MS = 20;
const DEFAULT_FIXTURE_MANIFEST = path.join(__dirname, 'fixtures.example.json');
const HARD_FINAL_DELAY_MS = 1000;
const HARD_AI_AUDIO_WINDOW_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const unwrapDefaultExport = (moduleNamespace) => moduleNamespace?.default || moduleNamespace;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    manifest: process.env.ASR_BENCHMARK_MANIFEST || DEFAULT_FIXTURE_MANIFEST,
    providers: (process.env.ASR_BENCHMARK_PROVIDERS || 'azure,vosk,sherpa-onnx')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    chunkMs: Number(process.env.ASR_BENCHMARK_CHUNK_MS || DEFAULT_CHUNK_MS),
    realtime: process.env.ASR_BENCHMARK_REALTIME !== 'false',
    output: process.env.ASR_BENCHMARK_OUTPUT || path.join(__dirname, 'results.latest.json'),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--manifest') options.manifest = args[++index];
    if (arg === '--providers') options.providers = args[++index].split(',').map((item) => item.trim()).filter(Boolean);
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
    return {
      pcm: buffer,
      sampleRate: DEFAULT_SAMPLE_RATE,
      channels: 1,
      bitsPerSample: 16,
      sourceFormat: 'raw-pcm',
    };
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

  if (!fmt || !data) {
    throw new Error(`Invalid WAV fixture: ${audioPath}`);
  }
  if (fmt.audioFormat !== 1 || fmt.channels !== 1 || fmt.sampleRate !== DEFAULT_SAMPLE_RATE || fmt.bitsPerSample !== 16) {
    throw new Error(`Fixture must be PCM 16 kHz mono 16-bit WAV: ${audioPath}`);
  }

  return {
    pcm: data,
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    bitsPerSample: fmt.bitsPerSample,
    sourceFormat: 'wav-pcm',
  };
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
  return {
    score: hits.length / keywords.length,
    hits,
    misses: keywords.filter((keyword) => !hits.includes(keyword)),
  };
};

const getResourceSnapshot = () => ({
  rssBytes: process.memoryUsage().rss,
  heapUsedBytes: process.memoryUsage().heapUsed,
  cpuUsage: process.cpuUsage(),
});

const diffResourceSnapshot = (before, after) => ({
  rssDeltaMb: Number(((after.rssBytes - before.rssBytes) / 1024 / 1024).toFixed(2)),
  heapDeltaMb: Number(((after.heapUsedBytes - before.heapUsedBytes) / 1024 / 1024).toFixed(2)),
  cpuUserMs: Number(((after.cpuUsage.user - before.cpuUsage.user) / 1000).toFixed(2)),
  cpuSystemMs: Number(((after.cpuUsage.system - before.cpuUsage.system) / 1000).toFixed(2)),
});

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
    integrationComplexity: 'low: already matches existing PCM WebSocket chunks through createRealtimeSpeechSession()',
  };
};

const createVoskProvider = async ({ sampleRate, callbacks }) => {
  const modelPath = process.env.VOSK_MODEL_PATH;
  if (!modelPath) throw new Error('Set VOSK_MODEL_PATH to a local Vosk model directory.');
  const vosk = unwrapDefaultExport(await import('vosk'));
  vosk.setLogLevel?.(-1);
  const model = new vosk.Model(modelPath);
  const recognizer = new vosk.Recognizer({ model, sampleRate });
  recognizer.setWords?.(true);
  let lastPartial = '';

  return {
    name: 'vosk',
    write: (chunk) => {
      const accepted = recognizer.acceptWaveform(chunk);
      if (accepted) {
        const result = recognizer.result();
        if (result?.text) callbacks.onFinal({ displayText: result.text, rawText: result.text, provider: 'vosk' });
        return;
      }
      const partial = recognizer.partialResult?.();
      if (partial?.partial && partial.partial !== lastPartial) {
        lastPartial = partial.partial;
        callbacks.onPartial({ text: partial.partial, provider: 'vosk' });
      }
    },
    finalize: async () => {
      const result = recognizer.finalResult();
      if (result?.text) callbacks.onFinal({ displayText: result.text, rawText: result.text, provider: 'vosk' });
      recognizer.free?.();
      model.free?.();
    },
    integrationComplexity: 'medium: consumes the same PCM chunks, but needs native Vosk model download and server image support',
  };
};

const createSherpaOnnxProvider = async ({ sampleRate, callbacks }) => {
  const moduleName = process.env.SHERPA_ONNX_NODE_MODULE || 'sherpa-onnx-node';
  const factoryName = process.env.SHERPA_ONNX_STREAMING_FACTORY || 'createOnlineRecognizer';
  const sherpa = unwrapDefaultExport(await import(moduleName));
  const factory = sherpa[factoryName];
  if (typeof factory !== 'function') {
    throw new Error(`Sherpa-ONNX module ${moduleName} does not export ${factoryName}. Set SHERPA_ONNX_NODE_MODULE and SHERPA_ONNX_STREAMING_FACTORY.`);
  }

  const recognizer = factory({
    sampleRate,
    tokens: process.env.SHERPA_ONNX_TOKENS,
    encoder: process.env.SHERPA_ONNX_ENCODER,
    decoder: process.env.SHERPA_ONNX_DECODER,
    joiner: process.env.SHERPA_ONNX_JOINER,
    model: process.env.SHERPA_ONNX_MODEL,
  });

  let lastPartial = '';
  return {
    name: 'sherpa-onnx',
    write: (chunk) => {
      const int16 = new Int16Array(chunk.buffer, chunk.byteOffset, Math.floor(chunk.byteLength / 2));
      const float32 = Float32Array.from(int16, (sample) => sample / 32768);
      recognizer.acceptWaveform?.(sampleRate, float32);
      const text = String(recognizer.text || recognizer.getResult?.()?.text || '').trim();
      if (text && text !== lastPartial) {
        lastPartial = text;
        callbacks.onPartial({ text, provider: 'sherpa-onnx' });
      }
    },
    finalize: async () => {
      recognizer.inputFinished?.();
      const text = String(recognizer.text || recognizer.getResult?.()?.text || '').trim();
      if (text) callbacks.onFinal({ displayText: text, rawText: text, provider: 'sherpa-onnx' });
      recognizer.free?.();
    },
    integrationComplexity: 'medium-high: likely compatible with PCM chunks, but exact Node API and model files must be pinned before production use',
  };
};

const providerFactories = {
  azure: createAzureProvider,
  vosk: createVoskProvider,
  'sherpa-onnx': createSherpaOnnxProvider,
};

const runProviderFixture = async ({ providerName, fixture, options }) => {
  const audioPath = path.resolve(path.dirname(options.manifest), fixture.audioPath);
  const wav = await readWavAsPcm(audioPath);
  const chunks = splitPcmChunks({ pcm: wav.pcm, sampleRate: wav.sampleRate, chunkMs: options.chunkMs });
  const audioDurationMs = Math.round((wav.pcm.length / (wav.sampleRate * 2)) * 1000);
  const events = [];
  const errors = [];
  const startedAt = nowMs();
  let firstPartialMs = null;
  let latestFinalMs = null;
  let latestFinalText = '';
  let speechEndMs = null;

  const callbacks = {
    onPartial: (payload) => {
      const eventTime = nowMs() - startedAt;
      if (firstPartialMs === null) firstPartialMs = eventTime;
      events.push({ type: 'partial', atMs: eventTime, text: payload.text || payload.displayText || '' });
    },
    onFinal: (payload) => {
      const eventTime = nowMs() - startedAt;
      latestFinalMs = eventTime;
      latestFinalText = String(payload.displayText || payload.normalizedText || payload.rawText || payload.text || '').trim();
      events.push({ type: 'final', atMs: eventTime, text: latestFinalText });
    },
    onError: (payload) => {
      errors.push(payload?.errorDetails || payload?.message || payload?.reason || String(payload));
    },
  };

  const factory = providerFactories[providerName];
  if (!factory) throw new Error(`Unknown provider: ${providerName}`);

  const before = getResourceSnapshot();
  const provider = await factory({ sampleRate: wav.sampleRate, language: fixture.language || 'en-NZ', callbacks });

  for (const chunk of chunks) {
    provider.write(chunk);
    if (options.realtime) await sleep(options.chunkMs);
  }

  speechEndMs = nowMs() - startedAt;
  await provider.finalize();
  const finishedAt = nowMs() - startedAt;
  const after = getResourceSnapshot();

  const finalDelayAfterSpeechEndMs = latestFinalMs === null ? null : Math.max(0, latestFinalMs - speechEndMs);
  const wer = fixture.expectedTranscript
    ? wordErrorRate({ expected: fixture.expectedTranscript, actual: latestFinalText })
    : null;
  const recall = keywordRecall({ expectedKeywords: fixture.keywords || [], actual: latestFinalText });

  const finalReadyPass = finalDelayAfterSpeechEndMs !== null && finalDelayAfterSpeechEndMs <= HARD_FINAL_DELAY_MS;
  const aiFirstAudioPossiblePass = finalReadyPass && finalDelayAfterSpeechEndMs <= HARD_AI_AUDIO_WINDOW_MS;

  return {
    provider: providerName,
    fixture: fixture.id,
    expectedDurationMs: fixture.expectedDurationMs || audioDurationMs,
    measuredAudioDurationMs: audioDurationMs,
    chunkMs: options.chunkMs,
    realtimeFeed: options.realtime,
    firstPartialMs,
    finalTranscriptDelayAfterSpeechEndMs,
    totalWallTimeMs: finishedAt,
    finalTranscriptText: latestFinalText,
    keywordRecall: recall,
    wer,
    resourceUse: diffResourceSnapshot(before, after),
    eventCounts: {
      partial: events.filter((event) => event.type === 'partial').length,
      final: events.filter((event) => event.type === 'final').length,
    },
    errors,
    integrationComplexity: provider.integrationComplexity,
    acceptance: {
      finalReadyWithin1s: finalReadyPass,
      aiFirstAudioPossibleWithin3To5s: aiFirstAudioPossiblePass,
      recommendation: finalReadyPass ? 'candidate can continue to deeper live test' : 'do not add as live local fallback',
    },
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
        // Keep one provider-fixture failure from hiding the rest of the matrix.
        results.push(await runProviderFixture({ providerName, fixture, options }));
      } catch (error) {
        results.push({
          provider: providerName,
          fixture: fixture.id,
          skipped: true,
          error: error?.message || String(error),
          acceptance: {
            finalReadyWithin1s: false,
            aiFirstAudioPossibleWithin3To5s: false,
            recommendation: 'not benchmarked, do not add as live local fallback',
          },
        });
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    hardAcceptance: {
      finalTranscriptDelayAfterSpeechEndMs: HARD_FINAL_DELAY_MS,
      aiFirstAudioPossibleAfterSpeechEndMs: HARD_AI_AUDIO_WINDOW_MS,
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
