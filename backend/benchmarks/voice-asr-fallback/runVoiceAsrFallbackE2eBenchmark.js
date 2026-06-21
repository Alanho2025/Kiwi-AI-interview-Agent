#!/usr/bin/env node
/**
 * End-to-end benchmark spike for the cloud realtime voice path.
 *
 * Measures the product latency that matters for live interviews:
 * speech_end -> STT final transcript -> first generated sentence -> first assistant audio readiness.
 *
 * The benchmark restores the supplied session after every fixture by default so repeated runs keep fixed state.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createElevenLabsRealtimeSttProvider } from './adapters/elevenlabsRealtimeSttProvider.js';
import {
  createSessionBenchmarkSnapshot,
  restoreSessionBenchmarkSnapshot,
  summarizeBenchmarkSnapshot,
} from './benchmarkSessionState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const BACKEND_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_CHUNK_MS = 20;
const DEFAULT_FIXTURE_MANIFEST = path.join(__dirname, 'fixtures.example.json');
const DEFAULT_PROVIDERS = 'elevenlabs-realtime';
const HARD_FINAL_DELAY_MS = 1000;
const HARD_FIRST_AUDIO_MS = 3000;
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
    output: process.env.ASR_BENCHMARK_OUTPUT || path.join(__dirname, 'results.e2e-cloud-voice.json'),
    sessionId: process.env.ASR_BENCHMARK_SESSION_ID || null,
    userId: process.env.ASR_BENCHMARK_USER_ID || null,
    allowSessionMutation: process.env.ASR_BENCHMARK_ALLOW_SESSION_MUTATION === 'true',
    restoreSession: process.env.ASR_BENCHMARK_RESTORE_SESSION !== 'false',
    ttsProvider: process.env.ASR_BENCHMARK_TTS_PROVIDER || 'azure',
    localTtsCommand: process.env.ASR_BENCHMARK_LOCAL_TTS_COMMAND || process.env.LOCAL_TTS_COMMAND || null,
    localTtsProviderName: process.env.ASR_BENCHMARK_LOCAL_TTS_PROVIDER_NAME || 'local-tts-command',
    localTtsContentType: process.env.ASR_BENCHMARK_LOCAL_TTS_CONTENT_TYPE || 'audio/wav',
    localTtsOutputFormat: process.env.ASR_BENCHMARK_LOCAL_TTS_OUTPUT_FORMAT || 'wav',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--manifest') options.manifest = args[++index];
    if (arg === '--providers') options.providers = parseProviderList(args[++index]);
    if (arg === '--chunk-ms') options.chunkMs = Number(args[++index]);
    if (arg === '--fast') options.realtime = false;
    if (arg === '--output') options.output = args[++index];
    if (arg === '--session-id') options.sessionId = args[++index];
    if (arg === '--user-id') options.userId = args[++index];
    if (arg === '--allow-session-mutation') options.allowSessionMutation = true;
    if (arg === '--no-restore-session') options.restoreSession = false;
    if (arg === '--tts-provider') options.ttsProvider = args[++index];
    if (arg === '--local-tts-command') options.localTtsCommand = args[++index];
    if (arg === '--local-tts-provider-name') options.localTtsProviderName = args[++index];
    if (arg === '--local-tts-content-type') options.localTtsContentType = args[++index];
    if (arg === '--local-tts-output-format') options.localTtsOutputFormat = args[++index];
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

const splitCommand = (value) => String(value || '').trim().split(/\s+/).filter(Boolean);

const synthesizeWithLocalCommand = ({ commandLine, providerName, contentType, outputFormat }) => async ({ text, voiceName } = {}) => {
  const trimmedText = String(text || '').trim();
  if (!trimmedText) throw new Error('Command TTS requires non-empty text.');

  const parts = splitCommand(commandLine);
  if (!parts.length) throw new Error('Set ASR_BENCHMARK_LOCAL_TTS_COMMAND to a command that reads text from stdin and writes audio bytes to stdout.');

  const [command, ...args] = parts;
  const child = spawn(command, args, { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const stdoutChunks = [];
  let stderr = '';

  child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  const closePromise = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`${providerName} exited with code ${code}${signal ? ` signal ${signal}` : ''}${stderr ? `: ${stderr.slice(-1000)}` : ''}`));
        return;
      }
      resolve();
    });
  });

  child.stdin.end(`${trimmedText}\n`);
  await closePromise;

  const audioBuffer = Buffer.concat(stdoutChunks);
  if (!audioBuffer.length) throw new Error(`${providerName} produced empty audio.`);

  return { audioBuffer, contentType, voiceName: voiceName || providerName, outputFormat, provider: providerName };
};

const createNoopArchiveSynthesizer = () => async ({ voiceName } = {}) => ({
  audioBuffer: Buffer.from('benchmark-audio-archive-skipped'),
  contentType: 'text/plain',
  voiceName: voiceName || 'benchmark-noop-archive',
  outputFormat: 'noop',
  provider: 'benchmark-noop-archive',
});

const waitForBackgroundQueueToSettle = async () => {
  const { getBackgroundJobQueueSize } = await import('../../src/jobs/backgroundJobQueue.js');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await sleep(100);
    if (getBackgroundJobQueueSize() === 0) {
      await sleep(100);
      if (getBackgroundJobQueueSize() === 0) return;
    }
  }
};

const providerFactories = {
  azure: createAzureProvider,
  'elevenlabs-realtime': createElevenLabsRealtimeSttProvider,
};

const runAsrFixture = async ({ providerName, fixture, options }) => {
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
  const asrFinishedAtMs = nowMs() - startedAt;
  const after = getResourceSnapshot();

  const finalTranscriptText = finalSegments.join(' ').replace(/\s+/g, ' ').trim();
  const finalTranscriptDelayAfterSpeechEndMs = latestFinalMs === null ? null : Math.max(0, latestFinalMs - speechEndMs);
  const wer = fixture.expectedTranscript ? wordErrorRate({ expected: fixture.expectedTranscript, actual: finalTranscriptText }) : null;
  const recall = keywordRecall({ expectedKeywords: fixture.keywords || [], actual: finalTranscriptText });

  return {
    provider: providerName,
    fixture: fixture.id,
    expectedDurationMs: fixture.expectedDurationMs || audioDurationMs,
    measuredAudioDurationMs: audioDurationMs,
    chunkMs: options.chunkMs,
    realtimeFeed: options.realtime,
    firstPartialMs,
    speechEndMs,
    asrFinishedAtMs,
    finalTranscriptDelayAfterSpeechEndMs,
    finalTranscriptText,
    keywordRecall: recall,
    wer,
    resourceUse: diffResourceSnapshot(before, after),
    eventCounts: { partial: events.filter((event) => event.type === 'partial').length, final: events.filter((event) => event.type === 'final').length },
    errors,
    integrationComplexity: provider.integrationComplexity,
    benchmarkMetadata: provider.benchmarkMetadata || null,
  };
};

const buildSentenceSynthesizer = (options) => {
  if (options.ttsProvider !== 'local-command') return null;
  return synthesizeWithLocalCommand({
    commandLine: options.localTtsCommand,
    providerName: options.localTtsProviderName,
    contentType: options.localTtsContentType,
    outputFormat: options.localTtsOutputFormat,
  });
};

const runRealAiPipeline = async ({ asrResult, options }) => {
  const { getSessionById } = await import('../../src/services/sessionService.js');
  const { processRealtimeVoiceTurn } = await import('../../src/services/voice/realtimeVoiceTurnService.js');

  if (!options.allowSessionMutation) throw new Error('Refusing to run real E2E pipeline without --allow-session-mutation. The benchmark restores session state after each fixture by default.');
  if (!options.sessionId) throw new Error('Missing --session-id or ASR_BENCHMARK_SESSION_ID for E2E benchmark.');
  if (!asrResult.finalTranscriptText) throw new Error('ASR produced empty transcript; refusing to call DeepSeek/RAG pipeline.');

  const sessionBefore = await getSessionById(options.sessionId);
  if (!sessionBefore) throw new Error(`Session not found: ${options.sessionId}`);
  const resolvedUserId = options.userId || sessionBefore.userId || sessionBefore.user_id;
  if (!resolvedUserId) throw new Error('Missing --user-id and session has no userId field.');

  const sentenceSynthesizer = buildSentenceSynthesizer(options);
  const startedAt = nowMs();
  let firstSentenceReadyMs = null;
  let firstAudioReadyMs = null;
  const sentenceEvents = [];

  const result = await processRealtimeVoiceTurn({
    session: sessionBefore,
    userId: resolvedUserId,
    transcriptText: asrResult.finalTranscriptText,
    language: 'en-NZ',
    asrConfidence: null,
    asrSource: `${asrResult.provider}_cloud_benchmark`,
    inputMode: 'cloud_voice_e2e_benchmark',
    vad: {
      isFinal: true,
      final: true,
      speechDurationMs: asrResult.measuredAudioDurationMs || asrResult.speechEndMs,
      durationMs: asrResult.measuredAudioDurationMs || asrResult.speechEndMs,
      sttSegmentCount: asrResult.eventCounts?.final ?? null,
      asrFinishedAtMs: asrResult.asrFinishedAtMs,
      finalTranscriptDelayAfterSpeechEndMs: asrResult.finalTranscriptDelayAfterSpeechEndMs,
      source: 'cloud_voice_e2e_benchmark',
    },
    voiceName: process.env.ASR_BENCHMARK_VOICE_NAME,
    tryGenerateReportForCompletedSession: null,
    req: null,
    synthesizeAssistantSpeech: createNoopArchiveSynthesizer(),
    onSentence: async (text, index) => {
      const sentenceReadyMs = nowMs() - startedAt;
      if (firstSentenceReadyMs === null) firstSentenceReadyMs = sentenceReadyMs;
      let audioReadyMs = null;
      let audioBytes = null;
      if (sentenceSynthesizer) {
        const synthesis = await sentenceSynthesizer({ text, voiceName: process.env.ASR_BENCHMARK_VOICE_NAME });
        audioReadyMs = nowMs() - startedAt;
        audioBytes = synthesis.audioBuffer.length;
        if (firstAudioReadyMs === null) firstAudioReadyMs = audioReadyMs;
      }
      sentenceEvents.push({
        index,
        sentenceReadyMs,
        audioReadyMs,
        audioBytes,
        textLength: String(text || '').length,
        textPreview: String(text || '').slice(0, 160),
      });
    },
  });

  const pipelineDoneMs = nowMs() - startedAt;
  await waitForBackgroundQueueToSettle();
  const assistantText = String(result.agentResult?.displayText || result.agentResult?.interviewerTurn?.displayText || result.agentResult?.nextQuestion || '').trim();

  return {
    mode: `product_like_streaming_${options.ttsProvider}`,
    ttsProvider: options.ttsProvider,
    sessionId: options.sessionId,
    userId: resolvedUserId,
    pipelineDoneMs,
    firstSentenceReadyMs,
    firstAudioReadyMs,
    assistantTextLength: assistantText.length,
    assistantTextPreview: assistantText.slice(0, 240),
    assistantAudioReady: Number.isFinite(firstAudioReadyMs),
    assistantAudioProvider: options.localTtsProviderName || options.ttsProvider,
    sentenceEvents,
    latency: result.latency || null,
  };
};

const buildAcceptance = ({ asrResult, e2eResult }) => {
  const hasPartialBeforeSpeechEnd = Number.isFinite(asrResult.firstPartialMs) && Number.isFinite(asrResult.speechEndMs) && asrResult.firstPartialMs < asrResult.speechEndMs;
  const finalReadyWithin1s = Number.isFinite(asrResult.finalTranscriptDelayAfterSpeechEndMs) && asrResult.finalTranscriptDelayAfterSpeechEndMs <= HARD_FINAL_DELAY_MS;
  const keywordRecallPass = asrResult.keywordRecall === null || asrResult.keywordRecall.score >= MIN_KEYWORD_RECALL;
  const werPass = asrResult.wer === null || asrResult.wer <= MAX_WER;
  const noAsrErrors = !asrResult.errors.length;
  const speechEndToFirstSentenceReadyMs = e2eResult?.firstSentenceReadyMs === null ? null : asrResult.finalTranscriptDelayAfterSpeechEndMs + e2eResult.firstSentenceReadyMs;
  const speechEndToFirstAudioReadyMs = e2eResult?.firstAudioReadyMs === null ? null : asrResult.finalTranscriptDelayAfterSpeechEndMs + e2eResult.firstAudioReadyMs;
  const firstAudioReadyWithin5s = Number.isFinite(speechEndToFirstAudioReadyMs) && speechEndToFirstAudioReadyMs <= HARD_FIRST_AUDIO_MS;
  const aiPipelineProducedOutput = Boolean(e2eResult?.assistantTextLength) && e2eResult.assistantAudioReady === true;
  const pass = hasPartialBeforeSpeechEnd && finalReadyWithin1s && keywordRecallPass && werPass && noAsrErrors && firstAudioReadyWithin5s && aiPipelineProducedOutput;

  return {
    hasPartialBeforeSpeechEnd,
    finalReadyWithin1s,
    keywordRecallAtLeast80Percent: keywordRecallPass,
    werAtMost30Percent: werPass,
    noAsrErrors,
    aiPipelineProducedOutput,
    speechEndToAsrFinalMs: asrResult.finalTranscriptDelayAfterSpeechEndMs,
    speechEndToFirstSentenceReadyMs,
    speechEndToFirstAudioReadyMs,
    firstAudioReadyWithin5s,
    pass,
    recommendation: pass ? 'cloud voice path can continue toward live integration spike' : 'do not add as live STT fallback yet',
  };
};

const runE2eFixtureWithRestore = async ({ providerName, fixture, options }) => {
  const snapshot = options.restoreSession
    ? await createSessionBenchmarkSnapshot(options.sessionId)
    : null;

  try {
    const asr = await runAsrFixture({ providerName, fixture, options });
    const e2e = await runRealAiPipeline({ asrResult: asr, options });
    return {
      provider: providerName,
      fixture: fixture.id,
      asr,
      e2e,
      sessionState: {
        restoredAfterRun: Boolean(snapshot),
        snapshot: snapshot ? summarizeBenchmarkSnapshot(snapshot) : null,
      },
      acceptance: buildAcceptance({ asrResult: asr, e2eResult: e2e }),
    };
  } finally {
    if (snapshot) {
      await restoreSessionBenchmarkSnapshot(snapshot);
    }
  }
};

const main = async () => {
  const options = parseArgs();
  const { bootstrapDatabases } = await import('../../src/db/bootstrap.js');
  const { disconnectMongo } = await import('../../src/db/mongo.js');
  const { closePostgres } = await import('../../src/db/postgres.js');
  await bootstrapDatabases({ mongoRequired: true, postgresRequired: true });

  try {
    const manifest = await readJson(options.manifest);
    const fixtures = manifest.fixtures || [];
    if (!fixtures.length) throw new Error('Benchmark manifest has no fixtures.');

    const results = [];
    for (const providerName of options.providers) {
      for (const fixture of fixtures) {
        try {
          results.push(await runE2eFixtureWithRestore({ providerName, fixture, options }));
        } catch (error) {
          results.push({
            provider: providerName,
            fixture: fixture.id,
            skipped: true,
            error: error?.message || String(error),
            acceptance: { pass: false, recommendation: 'E2E benchmark failed before complete measurement; fix provider config, session id, DB, DeepSeek, RAG, or TTS config' },
          });
        }
      }
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      benchmarkIntent: 'Measure product-like speech_end to first assistant audio readiness for the cloud voice interview path.',
      warning: 'This benchmark mutates the supplied interview session during the run, then restores it by default.',
      hardAcceptance: {
        finalTranscriptDelayAfterSpeechEndMs: HARD_FINAL_DELAY_MS,
        speechEndToFirstAudioReadyMs: HARD_FIRST_AUDIO_MS,
        keywordRecallMinimum: MIN_KEYWORD_RECALL,
        werMaximum: MAX_WER,
        partialRequiredBeforeSpeechEnd: true,
      },
      options: { ...options, userId: options.userId ? '[provided]' : null },
      results,
    };

    await fs.writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await Promise.allSettled([disconnectMongo(), closePostgres()]);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
