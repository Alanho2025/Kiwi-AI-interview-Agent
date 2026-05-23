#!/usr/bin/env node
/**
 * Generate a self-introduction audio fixture with ElevenLabs TTS.
 *
 * This creates a realistic interview answer fixture for measuring:
 * speech_end -> STT final transcript -> adaptive AI response -> assistant audio readiness.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(__dirname, 'scripts', 'self-introduction.txt');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const MANIFEST_PATH = path.join(__dirname, 'fixtures.local.json');
const OUTPUT_WAV_PATH = path.join(FIXTURE_DIR, 'self-introduction.wav');
const OUTPUT_MP3_PATH = path.join(FIXTURE_DIR, 'self-introduction.source.mp3');
const DEFAULT_EXPECTED_DURATION_MS = 45000;

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

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const buildTtsRequest = ({ text }) => {
  const voiceId = requireEnv('ELEVENLABS_VOICE_ID');
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  url.searchParams.set('output_format', process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128');

  return {
    url,
    body: {
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
      voice_settings: {
        stability: Number(process.env.ELEVENLABS_STABILITY || 0.55),
        similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST || 0.8),
        style: Number(process.env.ELEVENLABS_STYLE || 0.25),
        use_speaker_boost: process.env.ELEVENLABS_USE_SPEAKER_BOOST !== 'false',
      },
    },
  };
};

const synthesizeSelfIntroduction = async ({ text }) => {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');
  const { url, body } = buildTtsRequest({ text });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ElevenLabs TTS fixture generation failed with HTTP ${response.status}: ${details}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const convertToBenchmarkWav = async ({ inputPath, outputPath }) => {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide an ffmpeg binary path. Run npm install in backend first.');

  await execFileAsync(ffmpegPath, [
    '-y',
    '-i', inputPath,
    '-ac', '1',
    '-ar', '16000',
    '-sample_fmt', 's16',
    outputPath,
  ], { maxBuffer: 1024 * 1024 * 20 });
};

const writeManifest = async ({ expectedTranscript }) => {
  const manifest = {
    description: 'Generated self-introduction fixture for realtime STT and E2E voice latency benchmarking. Do not commit generated audio.',
    generatedAt: new Date().toISOString(),
    generatedBy: 'generateSelfIntroductionAudioFixture.js',
    voiceProvider: 'elevenlabs',
    voiceIdProvided: Boolean(process.env.ELEVENLABS_VOICE_ID),
    fixtures: [
      {
        id: 'self-introduction',
        audioPath: 'fixtures/self-introduction.wav',
        expectedDurationMs: Number(process.env.SELF_INTRO_EXPECTED_DURATION_MS || DEFAULT_EXPECTED_DURATION_MS),
        language: 'en-NZ',
        expectedTranscript,
        keywords: [
          'Alan',
          'Master of Information Technology',
          'AI agents',
          'backend development',
          'database design',
          'data mining',
          'electrical engineer',
          'Apple',
          'React',
          'Node.js',
          'PostgreSQL',
          'MongoDB',
          'WebSocket',
          'speech services',
          'AI-native product engineer'
        ],
      },
    ],
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

const main = async () => {
  loadBenchmarkEnv();
  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  const text = (await fs.readFile(SCRIPT_PATH, 'utf8')).trim();
  if (!text) throw new Error(`Self-introduction script is empty: ${SCRIPT_PATH}`);

  const audio = await synthesizeSelfIntroduction({ text });
  await fs.writeFile(OUTPUT_MP3_PATH, audio);
  await convertToBenchmarkWav({ inputPath: OUTPUT_MP3_PATH, outputPath: OUTPUT_WAV_PATH });
  await fs.rm(OUTPUT_MP3_PATH, { force: true });
  await writeManifest({ expectedTranscript: text });

  console.log(`[self-intro] wrote ${path.relative(process.cwd(), OUTPUT_WAV_PATH)}`);
  console.log(`[self-intro] wrote ${path.relative(process.cwd(), MANIFEST_PATH)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
