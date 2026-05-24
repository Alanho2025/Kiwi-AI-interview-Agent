#!/usr/bin/env node
/**
 * Self-contained simulation test for live ASR fallback acceptance gates.
 *
 * Why this exists:
 * - It does not require Azure credentials.
 * - It does not require Vosk or Sherpa-ONNX model files.
 * - It generates 30s, 60s, and 90s PCM interview-style fixtures locally.
 * - It validates whether the benchmark logic catches good and bad streaming behaviours.
 *
 * This is NOT an accuracy benchmark. It is a harness/gate simulation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const CHANNELS = 1;
const CHUNK_MS = 20;
const HARD_FINAL_DELAY_MS = 1000;
const HARD_AI_AUDIO_WINDOW_MS = 5000;
const OUTPUT_PATH = path.join(__dirname, 'simulation.results.json');

const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    realtime: !args.includes('--fast'),
    output: args.includes('--output') ? args[args.indexOf('--output') + 1] : OUTPUT_PATH,
  };
};

const writeWavHeader = ({ dataSize }) => {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return header;
};

const createSyntheticPcm = ({ durationMs, frequency = 220 }) => {
  const totalSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const buffer = Buffer.alloc(totalSamples * BYTES_PER_SAMPLE);
  for (let i = 0; i < totalSamples; i += 1) {
    // Keep amplitude low. This is only a timing fixture, not real speech.
    const sample = Math.round(Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE) * 3000);
    buffer.writeInt16LE(sample, i * BYTES_PER_SAMPLE);
  }
  return buffer;
};

const createSyntheticWav = ({ durationMs }) => {
  const pcm = createSyntheticPcm({ durationMs });
  return Buffer.concat([writeWavHeader({ dataSize: pcm.length }), pcm]);
};

const splitPcmChunks = ({ pcm, chunkMs = CHUNK_MS }) => {
  const bytesPerChunk = Math.floor((SAMPLE_RATE * BYTES_PER_SAMPLE * chunkMs) / 1000);
  const chunks = [];
  for (let offset = 0; offset < pcm.length; offset += bytesPerChunk) {
    chunks.push(pcm.subarray(offset, Math.min(offset + bytesPerChunk, pcm.length)));
  }
  return chunks;
};

const fixtures = [
  {
    id: 'synthetic-30s',
    durationMs: 30000,
    expectedTranscript: 'I used React Node PostgreSQL WebSocket and latency tracing to improve the interview agent.',
    keywords: ['React', 'Node', 'PostgreSQL', 'WebSocket', 'latency'],
  },
  {
    id: 'synthetic-60s',
    durationMs: 60000,
    expectedTranscript: 'I improved Azure speech recognition, retrieval augmented generation, interview rubric scoring, and STAR feedback.',
    keywords: ['Azure', 'speech recognition', 'retrieval augmented generation', 'rubric', 'STAR'],
  },
  {
    id: 'synthetic-90s',
    durationMs: 90000,
    expectedTranscript: 'I designed Kafka Redis MongoDB authentication and system design checks for a production interview platform.',
    keywords: ['Kafka', 'Redis', 'MongoDB', 'authentication', 'system design'],
  },
];

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

const keywordRecall = ({ expectedKeywords, actual }) => {
  const actualText = String(actual || '').toLowerCase();
  const keywords = expectedKeywords.map((item) => String(item).toLowerCase());
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

const createSimulatedClock = ({ realtime, startedAt }) => ({
  audioMs: 0,
  getEventMs() {
    return realtime ? nowMs() - startedAt : this.audioMs;
  },
  advanceAudioMs(value) {
    this.audioMs += value;
  },
});

const createSimulatedProvider = ({ providerName, fixture, callbacks }) => {
  let audioMsReceived = 0;
  let partialSent = false;
  const bytesPerSecond = SAMPLE_RATE * BYTES_PER_SAMPLE;

  const config = {
    'mock-streaming-fast-pass': {
      firstPartialAtMs: 1200,
      finalDelayAfterSpeechEndMs: 250,
      finalText: fixture.expectedTranscript,
      integrationComplexity: 'low simulation: behaves like a healthy streaming ASR provider',
    },
    'mock-streaming-borderline-pass': {
      firstPartialAtMs: 2500,
      finalDelayAfterSpeechEndMs: 950,
      finalText: fixture.expectedTranscript,
      integrationComplexity: 'medium simulation: barely passes the 1s final transcript gate',
    },
    'mock-streaming-slow-final-fail': {
      firstPartialAtMs: 1400,
      finalDelayAfterSpeechEndMs: 1800,
      finalText: fixture.expectedTranscript,
      integrationComplexity: 'high simulation: partials are fine, but final text arrives too late',
    },
    'mock-no-partial-fail': {
      firstPartialAtMs: null,
      finalDelayAfterSpeechEndMs: 300,
      finalText: fixture.expectedTranscript,
      integrationComplexity: 'bad simulation: final is fast, but no partial transcript is available during speech',
    },
    'mock-low-recall-fail': {
      firstPartialAtMs: 1200,
      finalDelayAfterSpeechEndMs: 300,
      finalText: 'I built a general application with database and cloud features.',
      integrationComplexity: 'bad simulation: timing passes, but technical keyword recall fails',
    },
  }[providerName];

  if (!config) throw new Error(`Unknown simulated provider: ${providerName}`);

  return {
    write: (chunk) => {
      audioMsReceived += (chunk.byteLength / bytesPerSecond) * 1000;
      if (!partialSent && config.firstPartialAtMs !== null && audioMsReceived >= config.firstPartialAtMs) {
        partialSent = true;
        callbacks.onPartial({
          text: config.finalText.split(' ').slice(0, 6).join(' '),
          simulatedAtMs: audioMsReceived,
        });
      }
    },
    finalize: async () => {
      await sleep(config.finalDelayAfterSpeechEndMs);
      callbacks.onFinal({
        text: config.finalText,
        simulatedAtMs: audioMsReceived + config.finalDelayAfterSpeechEndMs,
      });
    },
    integrationComplexity: config.integrationComplexity,
  };
};

const assertBenchmarkOutputSchema = (results) => {
  const invalid = results.filter((result) => (
    !Number.isFinite(result.finalTranscriptDelayAfterSpeechEndMs)
    || !Number.isFinite(result.aiFirstAudioPossibleAfterSpeechEndMs)
    || typeof result.acceptance?.finalReadyWithin1s !== 'boolean'
    || typeof result.acceptance?.aiFirstAudioPossibleWithin3To5s !== 'boolean'
  ));

  if (invalid.length) {
    throw new Error(`Benchmark output schema regression: ${invalid.length} result(s) are missing required timing or acceptance fields.`);
  }
};

const runOne = async ({ providerName, fixture, options }) => {
  const wav = createSyntheticWav({ durationMs: fixture.durationMs });
  const pcm = wav.subarray(44);
  const chunks = splitPcmChunks({ pcm });
  const events = [];
  const startedAt = nowMs();
  const clock = createSimulatedClock({ realtime: options.realtime, startedAt });
  let firstPartialMs = null;
  let finalTranscriptMs = null;
  let speechEndMs;
  let finalTranscriptText = '';

  const callbacks = {
    onPartial: (payload) => {
      const atMs = options.realtime ? nowMs() - startedAt : Math.round(payload.simulatedAtMs ?? clock.getEventMs());
      if (firstPartialMs === null) firstPartialMs = atMs;
      events.push({ type: 'partial', atMs, text: payload.text });
    },
    onFinal: (payload) => {
      const atMs = options.realtime ? nowMs() - startedAt : Math.round(payload.simulatedAtMs ?? clock.getEventMs());
      finalTranscriptMs = atMs;
      finalTranscriptText = payload.text;
      events.push({ type: 'final', atMs, text: payload.text });
    },
  };

  const before = getResourceSnapshot();
  const provider = createSimulatedProvider({ providerName, fixture, callbacks });

  for (const chunk of chunks) {
    provider.write(chunk);
    clock.advanceAudioMs((chunk.byteLength / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000);
    if (options.realtime) await sleep(CHUNK_MS);
  }

  speechEndMs = options.realtime ? nowMs() - startedAt : Math.round(clock.audioMs);
  await provider.finalize();
  const after = getResourceSnapshot();

  const finalTranscriptDelayAfterSpeechEndMs = finalTranscriptMs === null ? null : finalTranscriptMs - speechEndMs;
  const aiFirstAudioPossibleAfterSpeechEndMs = finalTranscriptDelayAfterSpeechEndMs;
  const recall = keywordRecall({ expectedKeywords: fixture.keywords, actual: finalTranscriptText });
  const wer = wordErrorRate({ expected: fixture.expectedTranscript, actual: finalTranscriptText });
  const hasPartial = firstPartialMs !== null && firstPartialMs < speechEndMs;
  const finalReadyPass = Number.isFinite(finalTranscriptDelayAfterSpeechEndMs) && finalTranscriptDelayAfterSpeechEndMs <= HARD_FINAL_DELAY_MS;
  const aiFirstAudioPossiblePass = Number.isFinite(aiFirstAudioPossibleAfterSpeechEndMs) && aiFirstAudioPossibleAfterSpeechEndMs <= HARD_AI_AUDIO_WINDOW_MS;
  const keywordRecallPass = recall.score >= 0.8;
  const pass = hasPartial && finalReadyPass && aiFirstAudioPossiblePass && keywordRecallPass;

  return {
    provider: providerName,
    fixture: fixture.id,
    durationMs: fixture.durationMs,
    firstPartialMs,
    speechEndMs,
    finalTranscriptDelayAfterSpeechEndMs,
    aiFirstAudioPossibleAfterSpeechEndMs,
    finalTranscriptText,
    keywordRecall: recall,
    wer,
    resourceUse: diffResourceSnapshot(before, after),
    eventCounts: {
      partial: events.filter((event) => event.type === 'partial').length,
      final: events.filter((event) => event.type === 'final').length,
    },
    integrationComplexity: provider.integrationComplexity,
    acceptance: {
      hasPartialBeforeSpeechEnd: hasPartial,
      finalReadyWithin1s: finalReadyPass,
      aiFirstAudioPossibleWithin3To5s: aiFirstAudioPossiblePass,
      keywordRecallAtLeast80Percent: keywordRecallPass,
      pass,
      recommendation: pass ? 'candidate behaviour passes harness gate' : 'do not add as live local fallback',
    },
  };
};

const main = async () => {
  const options = parseArgs();
  const providers = [
    'mock-streaming-fast-pass',
    'mock-streaming-borderline-pass',
    'mock-streaming-slow-final-fail',
    'mock-no-partial-fail',
    'mock-low-recall-fail',
  ];

  const results = [];
  for (const providerName of providers) {
    for (const fixture of fixtures) {
      results.push(await runOne({ providerName, fixture, options }));
    }
  }

  assertBenchmarkOutputSchema(results);

  const summary = {
    generatedAt: new Date().toISOString(),
    type: 'simulation-only',
    note: 'This validates benchmark gate logic. It does not measure real ASR accuracy.',
    hardAcceptance: {
      finalTranscriptDelayAfterSpeechEndMs: HARD_FINAL_DELAY_MS,
      aiFirstAudioPossibleAfterSpeechEndMs: HARD_AI_AUDIO_WINDOW_MS,
      keywordRecallMinimum: 0.8,
      partialRequiredBeforeSpeechEnd: true,
    },
    options,
    results,
  };

  await fs.writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));

  const failedUnexpectedly = results.some((result) => {
    if (result.provider.includes('fast-pass') || result.provider.includes('borderline-pass')) {
      return !result.acceptance.pass;
    }
    return false;
  });

  const passedUnexpectedly = results.some((result) => {
    if (result.provider.includes('slow-final-fail') || result.provider.includes('no-partial-fail') || result.provider.includes('low-recall-fail')) {
      return result.acceptance.pass;
    }
    return false;
  });

  if (failedUnexpectedly || passedUnexpectedly) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
