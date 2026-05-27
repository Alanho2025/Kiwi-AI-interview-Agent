/**
 * File responsibility: Deterministic TTS provider for automated voice tests.
 * Main responsibilities:
 * - Exercise real duplex TTS orchestration without external provider calls.
 * - Return a tiny valid WAV payload so browser playback can proceed in E2E.
 * - Support streaming chunks and optional first-byte delays for latency gates.
 */

const numberFromEnv = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSilentWavBuffer = ({ sampleRate = 8000, durationMs = 120 } = {}) => {
  const samples = Math.max(1, Math.round((sampleRate * durationMs) / 1000));
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
};

export const synthesizeSpeech = async ({ text, voiceName = 'test-voice' } = {}) => {
  const delayMs = numberFromEnv('TEST_TTS_DELAY_MS', 0);
  await sleep(delayMs);
  return {
    audioBuffer: buildSilentWavBuffer(),
    contentType: 'audio/wav',
    voiceName,
    outputFormat: 'riff-8khz-16bit-mono-pcm',
    provider: 'test_tts',
    text: String(text || ''),
  };
};

export const streamSynthesizeSpeech = async function* ({ text, voiceName = 'test-voice' } = {}) {
  const firstByteDelayMs = numberFromEnv('TEST_TTS_FIRST_BYTE_DELAY_MS', 0);
  const chunkDelayMs = numberFromEnv('TEST_TTS_CHUNK_DELAY_MS', 0);
  const startedAt = Date.now();
  await sleep(firstByteDelayMs);
  yield {
    audioBuffer: buildSilentWavBuffer({ durationMs: 80 }),
    contentType: 'audio/wav',
    voiceName,
    outputFormat: 'riff-8khz-16bit-mono-pcm',
    provider: 'test_tts',
    chunkIndex: 0,
    firstByteMs: Date.now() - startedAt,
    isStreaming: false,
    text: String(text || ''),
  };
  await sleep(chunkDelayMs);
};
