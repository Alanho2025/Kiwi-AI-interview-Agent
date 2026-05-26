import { AppError } from '../../utils/appError.js';
import { synthesizeSpeech as synthesizeAzureSpeech } from './azureSpeechService.js';
import {
  synthesizeSpeech as synthesizeElevenLabsSpeech,
  streamSynthesizeSpeech as streamElevenLabsSpeech,
} from './elevenLabsSpeechService.js';

const providerFactories = {
  azure: synthesizeAzureSpeech,
  azure_speech: synthesizeAzureSpeech,
  elevenlabs: synthesizeElevenLabsSpeech,
  elevenlabs_tts: synthesizeElevenLabsSpeech,
  elevenlabs_realtime: synthesizeElevenLabsSpeech,
};

const streamingProviderFactories = {
  elevenlabs: streamElevenLabsSpeech,
  elevenlabs_tts: streamElevenLabsSpeech,
  elevenlabs_realtime: streamElevenLabsSpeech,
};

const normalizeProviderName = (value) => String(value || '').trim().toLowerCase().replace(/-/g, '_');

export const getTtsProviderOrder = () => {
  const configuredOrder = String(process.env.VOICE_TTS_PROVIDER_ORDER || process.env.VOICE_STT_PROVIDER_ORDER || '').trim();
  if (configuredOrder) {
    return Array.from(new Set(configuredOrder.split(',').map(normalizeProviderName).filter(Boolean)));
  }

  const primary = normalizeProviderName(process.env.VOICE_TTS_PROVIDER || process.env.VOICE_STT_PROVIDER || 'azure');
  const fallback = normalizeProviderName(process.env.VOICE_TTS_FALLBACK_PROVIDER || process.env.VOICE_STT_FALLBACK_PROVIDER || 'elevenlabs');
  return Array.from(new Set([primary, fallback].filter(Boolean)));
};

const shouldAttemptFallback = (error) => !error?.statusCode || Number(error.statusCode) >= 500;

export const synthesizeSpeech = async (options = {}) => {
  const providerOrder = getTtsProviderOrder();
  const errors = [];

  for (const providerName of providerOrder) {
    const synthesizeWithProvider = providerFactories[providerName];
    if (!synthesizeWithProvider) {
      errors.push(`${providerName}: unsupported TTS provider`);
      continue;
    }

    try {
      return await synthesizeWithProvider(options);
    } catch (error) {
      errors.push(`${providerName}: ${error?.message || String(error)}`);
      if (!shouldAttemptFallback(error)) throw error;
    }
  }

  throw new AppError('No TTS provider could synthesize speech', {
    statusCode: 502,
    code: 'VOICE_SYNTHESIS_FAILED',
    details: errors.join('; '),
    meta: { providerOrder },
  });
};

export const streamSynthesizeSpeech = async function* (options = {}) {
  const providerOrder = getTtsProviderOrder();
  const errors = [];

  for (const providerName of providerOrder) {
    const streamWithProvider = streamingProviderFactories[providerName];
    if (!streamWithProvider) {
      errors.push(`${providerName}: streaming unsupported`);
      continue;
    }

    try {
      yield* streamWithProvider(options);
      return;
    } catch (error) {
      errors.push(`${providerName}: ${error?.message || String(error)}`);
      if (!shouldAttemptFallback(error)) throw error;
    }
  }

  const synthesis = await synthesizeSpeech(options);
  yield {
    ...synthesis,
    chunkIndex: 0,
    isStreaming: false,
  };
};