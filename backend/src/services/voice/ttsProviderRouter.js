/**
 * File responsibility: Text-to-speech provider routing.
 * Main responsibilities:
 * - Select Azure or ElevenLabs TTS from environment configuration.
 * - Keep fallback policy outside WebSocket and controller code.
 * - Preserve the synthesis contract used by the voice orchestration layer.
 */

import { AppError } from '../../utils/appError.js';
import { synthesizeSpeech as synthesizeAzureSpeech } from './azureSpeechService.js';
import { synthesizeSpeech as synthesizeElevenLabsSpeech } from './elevenLabsSpeechService.js';

const providerFactories = {
  azure: synthesizeAzureSpeech,
  azure_speech: synthesizeAzureSpeech,
  elevenlabs: synthesizeElevenLabsSpeech,
  elevenlabs_tts: synthesizeElevenLabsSpeech,
  elevenlabs_realtime: synthesizeElevenLabsSpeech,
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
