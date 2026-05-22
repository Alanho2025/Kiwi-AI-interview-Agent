#!/usr/bin/env node
/**
 * Generate local interview-style ASR benchmark fixtures.
 *
 * This script is designed for local benchmark use only.
 * On macOS it uses the built-in `say` command to create spoken interview answers,
 * then uses ffmpeg-static to convert them into 16 kHz mono 16-bit PCM WAV files.
 *
 * It writes:
 * - backend/benchmarks/voice-asr-fallback/fixtures/interview-answer-30s.wav
 * - backend/benchmarks/voice-asr-fallback/fixtures/interview-answer-60s.wav
 * - backend/benchmarks/voice-asr-fallback/fixtures/interview-answer-90s.wav
 * - backend/benchmarks/voice-asr-fallback/fixtures.local.json
 *
 * Do not commit generated audio files. They are local benchmark fixtures.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const MANIFEST_PATH = path.join(__dirname, 'fixtures.local.json');
const SAY_VOICE = process.env.ASR_FIXTURE_SAY_VOICE || 'Daniel';
const SAY_RATE = process.env.ASR_FIXTURE_SAY_RATE || '150';

const fixtures = [
  {
    id: 'interview-answer-30s',
    filename: 'interview-answer-30s.wav',
    expectedDurationMs: 30000,
    language: 'en-NZ',
    expectedTranscript: 'In my recent project, I used React, Node, PostgreSQL, WebSocket streaming, and latency tracing to improve the interview agent. The main challenge was keeping the voice interaction responsive while still producing useful feedback. I focused on the speech end event, the partial transcript, and the final transcript delay because these directly affect the user experience.',
    keywords: ['React', 'Node', 'PostgreSQL', 'WebSocket', 'latency', 'partial transcript', 'final transcript'],
  },
  {
    id: 'interview-answer-60s',
    filename: 'interview-answer-60s.wav',
    expectedDurationMs: 60000,
    language: 'en-NZ',
    expectedTranscript: 'One technical improvement I made was the voice interview pipeline. I used Azure speech recognition for streaming transcription, then connected the transcript to the interview controller. The system can use retrieval augmented generation to collect evidence from the CV, the job description, the rubric, and the previous conversation. After that, the agent can ask a better follow up question using the STAR method. I also added latency tracing so I could measure the time from speech end to the first assistant audio. This helped me separate speech recognition delay from language model delay and text to speech delay.',
    keywords: ['Azure', 'speech recognition', 'retrieval augmented generation', 'rubric', 'STAR', 'latency tracing', 'speech end'],
  },
  {
    id: 'interview-answer-90s',
    filename: 'interview-answer-90s.wav',
    expectedDurationMs: 90000,
    language: 'en-NZ',
    expectedTranscript: 'If I were scaling this interview platform, I would separate the real time voice path from the post interview analysis path. The live path should stay lightweight. It should handle WebSocket audio chunks, streaming speech recognition, authentication, barge in control, and fast text to speech. The slower path can handle transcript cleanup, report generation, and deeper scoring. For the data layer, MongoDB can store sessions and transcripts, while PostgreSQL can support structured reporting if needed. Redis could help with short lived session state, and Kafka could support event based processing when the traffic becomes larger. The key design goal is not adding every tool. The key goal is keeping speech end to first audio within three to five seconds while still giving useful interview feedback.',
    keywords: ['WebSocket', 'speech recognition', 'authentication', 'MongoDB', 'PostgreSQL', 'Redis', 'Kafka', 'system design', 'speech end'],
  },
];

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const ensureMacSayAvailable = async () => {
  try {
    await execFileAsync('say', ['--version']);
  } catch {
    throw new Error('The macOS `say` command is required to generate spoken fixtures. Run this on macOS, or manually place 16 kHz mono PCM WAV files in the fixtures directory.');
  }
};

const generateAiffWithSay = async ({ text, outputPath }) => {
  await execFileAsync('say', [
    '-v', SAY_VOICE,
    '-r', SAY_RATE,
    '-o', outputPath,
    text,
  ], { maxBuffer: 1024 * 1024 * 20 });
};

const convertToBenchmarkWav = async ({ inputPath, outputPath }) => {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not provide an ffmpeg binary path. Run npm install in backend first.');
  }

  await execFileAsync(ffmpegPath, [
    '-y',
    '-i', inputPath,
    '-ac', '1',
    '-ar', '16000',
    '-sample_fmt', 's16',
    outputPath,
  ], { maxBuffer: 1024 * 1024 * 20 });
};

const estimateWavDurationMs = async (wavPath) => {
  const buffer = await fs.readFile(wavPath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null;

  let offset = 12;
  let sampleRate = null;
  let channels = null;
  let bitsPerSample = null;
  let dataSize = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === 'fmt ') {
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    }
    if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!sampleRate || !channels || !bitsPerSample || !dataSize) return null;
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
  return Math.round((dataSize / bytesPerSecond) * 1000);
};

const writeManifest = async () => {
  const manifest = {
    description: 'Generated local interview-style speech fixtures for ASR fallback benchmarking. Do not commit generated audio.',
    generatedAt: new Date().toISOString(),
    generatedBy: 'generateInterviewAudioFixtures.js',
    voice: SAY_VOICE,
    rate: SAY_RATE,
    fixtures: fixtures.map((fixture) => ({
      id: fixture.id,
      audioPath: `fixtures/${fixture.filename}`,
      expectedDurationMs: fixture.expectedDurationMs,
      language: fixture.language,
      expectedTranscript: fixture.expectedTranscript,
      keywords: fixture.keywords,
    })),
  };
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

const main = async () => {
  await ensureMacSayAvailable();
  await fs.mkdir(FIXTURE_DIR, { recursive: true });

  for (const fixture of fixtures) {
    const aiffPath = path.join(FIXTURE_DIR, `${fixture.id}.aiff`);
    const wavPath = path.join(FIXTURE_DIR, fixture.filename);

    if (await fileExists(wavPath)) {
      const durationMs = await estimateWavDurationMs(wavPath);
      console.log(`[fixtures] exists ${path.relative(process.cwd(), wavPath)} duration=${durationMs ?? 'unknown'}ms`);
      continue;
    }

    console.log(`[fixtures] generating ${fixture.id} with macOS say voice=${SAY_VOICE} rate=${SAY_RATE}`);
    await generateAiffWithSay({ text: fixture.expectedTranscript, outputPath: aiffPath });
    await convertToBenchmarkWav({ inputPath: aiffPath, outputPath: wavPath });
    await fs.rm(aiffPath, { force: true });
    const durationMs = await estimateWavDurationMs(wavPath);
    console.log(`[fixtures] wrote ${path.relative(process.cwd(), wavPath)} duration=${durationMs ?? 'unknown'}ms`);
  }

  await writeManifest();
  console.log(`[fixtures] wrote ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  console.log('[fixtures] next: node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js --manifest benchmarks/voice-asr-fallback/fixtures.local.json --providers azure --output benchmarks/voice-asr-fallback/results.azure.local.json');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
