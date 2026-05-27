#!/usr/bin/env node
/**
 * Generates a deterministic mono 16 kHz WAV fixture for voice E2E tests.
 * The fixture contains silence, synthetic speech-like tones, then silence.
 * It avoids committing binary blobs while still giving Playwright a stable mic source.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'voice-answer.wav');

const sampleRate = 16000;
const channels = 1;
const bytesPerSample = 2;
const segments = [
  { durationMs: 1200, frequency: 0, amplitude: 0 },
  { durationMs: 3600, frequency: 220, amplitude: 0.35 },
  { durationMs: 2600, frequency: 0, amplitude: 0 },
];

const samples = segments.flatMap((segment) => {
  const count = Math.round((sampleRate * segment.durationMs) / 1000);
  return Array.from({ length: count }, (_, index) => {
    if (!segment.frequency || !segment.amplitude) return 0;
    const carrier = Math.sin((2 * Math.PI * segment.frequency * index) / sampleRate);
    const envelope = 0.65 + 0.35 * Math.sin((2 * Math.PI * 4 * index) / sampleRate);
    return Math.round(32767 * segment.amplitude * envelope * carrier);
  });
});

const dataBytes = samples.length * bytesPerSample;
const buffer = Buffer.alloc(44 + dataBytes);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataBytes, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
buffer.writeUInt16LE(channels * bytesPerSample, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataBytes, 40);

samples.forEach((sample, index) => {
  buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), 44 + index * bytesPerSample);
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buffer);
console.log(`[voice-fixture] generated ${outputPath} (${samples.length} samples)`);
