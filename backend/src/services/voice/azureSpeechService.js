/**
 * File responsibility: Voice provider adapter.
 * Main responsibilities:
 * - Keep Azure Speech REST concerns isolated from controllers and routes.
 * - Expose small functions for speech synthesis and short-audio transcription.
 * - Keep request formatting, token exchange, and response parsing in one place.
 */

import { AppError, badRequest } from '../../utils/appError.js';

const DEFAULT_TTS_VOICE = process.env.AZURE_SPEECH_TTS_VOICE || 'en-NZ-MollyNeural';
const DEFAULT_STT_LANGUAGE = process.env.AZURE_SPEECH_STT_LANGUAGE || 'en-NZ';
const DEFAULT_OUTPUT_FORMAT = process.env.AZURE_SPEECH_TTS_OUTPUT_FORMAT || 'audio-24khz-48kbitrate-mono-mp3';
const TOKEN_TTL_MS = 9 * 60 * 1000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

const getSpeechConfig = () => {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const endpoint = process.env.AZURE_SPEECH_ENDPOINT || '';

  if (!key || !region) {
    throw new AppError('Azure Speech is not configured', {
      statusCode: 500,
      code: 'VOICE_PROVIDER_NOT_CONFIGURED',
      details: 'Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in backend/.env',
    });
  }

  return { key, region, endpoint };
};

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const buildSsml = ({ text, voiceName }) => {
  const safeText = escapeXml(text);
  const safeVoice = escapeXml(voiceName);
  const safeLang = escapeXml(String(voiceName).split('-').slice(0, 2).join('-') || 'en-NZ');

  return `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xml:lang="${safeLang}">
  <voice name="${safeVoice}">${safeText}</voice>
</speak>`;
};

const issueAccessToken = async () => {
  const { key, region } = getSpeechConfig();

  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': '0',
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new AppError('Failed to get Azure Speech token', {
      statusCode: 502,
      code: 'VOICE_PROVIDER_AUTH_FAILED',
      details,
    });
  }

  cachedToken = await response.text();
  cachedTokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return cachedToken;
};

const getTtsUrl = () => {
  const { region, endpoint } = getSpeechConfig();

  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      return `${parsed.origin}/cognitiveservices/v1`;
    } catch {
      // fall back to region host when endpoint is malformed
    }
  }

  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
};

const getSttUrl = ({ language, format = 'simple', profanity = 'masked' }) => {
  const { region } = getSpeechConfig();
  const query = new URLSearchParams({ language, format, profanity });
  return `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?${query.toString()}`;
};

const validateAudioFile = ({ buffer, mimetype, originalname }) => {
  if (!buffer?.length) {
    throw badRequest('No audio uploaded', 'Please upload a WAV file in the audio field');
  }

  const name = String(originalname || '').toLowerCase();
  const type = String(mimetype || '').toLowerCase();
  const isWav = name.endsWith('.wav') || type.includes('audio/wav') || type.includes('audio/x-wav');

  if (!isWav) {
    throw badRequest('Unsupported audio file', 'For this phase, upload a mono 16 kHz WAV file');
  }
};

export const synthesizeSpeech = async ({ text, voiceName = DEFAULT_TTS_VOICE, outputFormat = DEFAULT_OUTPUT_FORMAT }) => {
  const trimmedText = String(text || '').trim();
  if (!trimmedText) {
    throw badRequest('Text is required', 'Provide text for speech synthesis');
  }

  const token = await issueAccessToken();
  const ssml = buildSsml({ text: trimmedText, voiceName });
  const response = await fetch(getTtsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': outputFormat,
      'User-Agent': 'KiwiAgentVoiceSession',
    },
    body: ssml,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new AppError('Azure Speech synthesis failed', {
      statusCode: 502,
      code: 'VOICE_SYNTHESIS_FAILED',
      details,
      meta: { voiceName, outputFormat },
    });
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return {
    audioBuffer,
    contentType: 'audio/mpeg',
    voiceName,
    outputFormat,
    provider: 'azure-speech-rest',
  };
};

export const transcribeShortAudio = async ({ buffer, mimetype, originalname, language = DEFAULT_STT_LANGUAGE }) => {
  validateAudioFile({ buffer, mimetype, originalname });
  const token = await issueAccessToken();
  const response = await fetch(getSttUrl({ language, format: 'detailed', profanity: 'raw' }), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
    },
    body: buffer,
  });

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new AppError('Azure Speech transcription failed', {
      statusCode: 502,
      code: 'VOICE_TRANSCRIPTION_FAILED',
      details: parsed || rawText,
      meta: { language },
    });
  }

  const bestN = Array.isArray(parsed?.NBest) ? parsed.NBest : [];
  const primaryResult = bestN[0] || null;
  const text = primaryResult?.Display || parsed?.DisplayText || '';

  return {
    text,
    language,
    provider: 'azure-speech-rest',
    confidence: Number.isFinite(primaryResult?.Confidence) ? Number(primaryResult.Confidence) : null,
    raw: parsed,
  };
};
