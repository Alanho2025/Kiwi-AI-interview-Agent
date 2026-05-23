/**
 * File responsibility: ElevenLabs speech provider adapter.
 * Main responsibilities:
 * - Keep ElevenLabs text-to-speech HTTP concerns isolated from voice orchestration.
 * - Match the small synthesis contract used by Azure Speech.
 * - Record measured speech usage without coupling callers to provider-specific details.
 */

import { AppError, badRequest } from '../../utils/appError.js';
import { recordSpeechUsage } from '../aiUsageTrackingService.js';

const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
const DEFAULT_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';

const numberFromEnv = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
};

const booleanFromEnv = (key, fallback) => {
  const value = process.env[key];
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() !== 'false';
};

const getElevenLabsConfig = ({ voiceName } = {}) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const configuredVoiceId = process.env.ELEVENLABS_VOICE_ID;
  const requestedVoice = String(voiceName || '').trim();
  const requestedVoiceId = requestedVoice && !requestedVoice.endsWith('Neural')
    ? requestedVoice.replace(/^elevenlabs:/i, '')
    : '';
  const voiceId = requestedVoiceId || configuredVoiceId;

  if (!apiKey || !voiceId) {
    throw new AppError('ElevenLabs Speech is not configured', {
      statusCode: 500,
      code: 'VOICE_PROVIDER_NOT_CONFIGURED',
      details: 'Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in backend/.env',
    });
  }

  return { apiKey, voiceId };
};

const buildTtsUrl = ({ voiceId, outputFormat }) => {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`);
  url.searchParams.set('output_format', outputFormat);
  return url.toString();
};

const buildVoiceSettings = () => ({
  stability: numberFromEnv('ELEVENLABS_STABILITY', 0.55),
  similarity_boost: numberFromEnv('ELEVENLABS_SIMILARITY_BOOST', 0.8),
  style: numberFromEnv('ELEVENLABS_STYLE', 0.25),
  use_speaker_boost: booleanFromEnv('ELEVENLABS_USE_SPEAKER_BOOST', true),
});

export const synthesizeSpeech = async ({
  text,
  voiceName,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
  usageContext = null,
} = {}) => {
  const trimmedText = String(text || '').trim();
  if (!trimmedText) {
    throw badRequest('Text is required', 'Provide text for speech synthesis');
  }

  const { apiKey, voiceId } = getElevenLabsConfig({ voiceName });
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  const response = await fetch(buildTtsUrl({ voiceId, outputFormat }), {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: trimmedText,
      model_id: modelId,
      voice_settings: buildVoiceSettings(),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new AppError('ElevenLabs Speech synthesis failed', {
      statusCode: 502,
      code: 'VOICE_SYNTHESIS_FAILED',
      details,
      meta: { voiceId, outputFormat, modelId },
    });
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (usageContext?.userId) {
    await recordSpeechUsage({
      userId: usageContext.userId,
      sessionId: usageContext.sessionId || null,
      provider: 'elevenlabs',
      stage: usageContext.stage || 'interview',
      operation: 'text_to_speech',
      textCharacters: trimmedText.length,
      audioBytes: audioBuffer.length,
      requestCount: 1,
      metadata: {
        voiceId,
        outputFormat,
        modelId,
        source: usageContext.source || 'elevenlabs_speech',
      },
    });
  }

  return {
    audioBuffer,
    contentType: response.headers.get('content-type') || 'audio/mpeg',
    voiceName: `elevenlabs:${voiceId}`,
    outputFormat,
    provider: 'elevenlabs',
  };
};
