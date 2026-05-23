import { createElevenLabsRealtimeSttProvider } from '../../../benchmarks/voice-asr-fallback/adapters/elevenlabsRealtimeSttProvider.js';
import { normalizeTranscript } from './transcriptNormalizer.js';
import { buildConfidenceGate } from './speechConfidenceGate.js';
import { recordAiUsageEvent } from '../aiUsageTrackingService.js';

const DEFAULT_SAMPLE_RATE = 16000;

const mapFinalTranscript = ({ text, language }) => {
  const normalized = normalizeTranscript(text);
  const confidenceGate = buildConfidenceGate(null);
  return {
    type: 'final_transcript',
    rawText: normalized.rawText,
    normalizedText: normalized.normalizedText,
    displayText: normalized.normalizedText || normalized.rawText,
    changed: normalized.changed,
    corrections: normalized.corrections,
    confidence: null,
    confidenceStatus: confidenceGate.status,
    shouldConfirm: confidenceGate.shouldConfirm,
    shouldRecordAgain: confidenceGate.shouldRecordAgain,
    language,
    provider: 'elevenlabs_realtime',
    timestamp: new Date().toISOString(),
  };
};

const recordUsage = ({ usageContext, sampleRate, audioBytesReceived, language, finalSegmentCount }) => {
  if (!usageContext?.userId || audioBytesReceived <= 0) return;
  const audioSeconds = audioBytesReceived / ((Number(sampleRate) || DEFAULT_SAMPLE_RATE) * 2);
  recordAiUsageEvent({
    userId: usageContext.userId,
    sessionId: usageContext.sessionId || null,
    provider: 'elevenlabs',
    modality: 'speech',
    stage: usageContext.stage || 'interview',
    operation: 'speech_to_text',
    metrics: { audioSeconds, audioBytes: audioBytesReceived, requestCount: 1 },
    estimatedCost: 0,
    metadata: {
      language,
      sampleRate,
      finalSegmentCount,
      source: usageContext.source || 'elevenlabs_realtime_speech',
      modelId: process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v2_realtime',
    },
  }).catch((error) => console.warn('Failed to record ElevenLabs STT usage:', error?.message));
};

export function createElevenLabsRealtimeSpeechSession({
  language = 'en-NZ',
  sampleRate = DEFAULT_SAMPLE_RATE,
  extraPhrases = [],
  usageContext = null,
  onPartialTranscript,
  onFinalTranscript,
  onError,
  onSessionStarted,
  onSessionStopped,
} = {}) {
  let provider = null;
  let audioBytesReceived = 0;
  let finalSegmentCount = 0;

  const start = async () => {
    provider = await createElevenLabsRealtimeSttProvider({
      sampleRate,
      language,
      fixture: { keywords: extraPhrases },
      callbacks: {
        onPartial: (payload) => onPartialTranscript?.({
          type: 'partial_transcript',
          text: payload.text,
          language,
          provider: 'elevenlabs_realtime',
          timestamp: new Date().toISOString(),
        }),
        onFinal: (payload) => {
          const mapped = mapFinalTranscript({ text: payload.text || payload.displayText || payload.rawText, language });
          if (!mapped.displayText) return;
          finalSegmentCount += 1;
          onFinalTranscript?.(mapped);
        },
        onError: (payload) => onError?.({
          type: 'speech_error',
          reason: payload?.reason || 'provider_error',
          provider: 'elevenlabs_realtime',
          errorDetails: payload?.errorDetails || payload?.message || String(payload),
          timestamp: new Date().toISOString(),
        }),
      },
    });
    onSessionStarted?.({ type: 'speech_session_started', provider: 'elevenlabs_realtime', timestamp: new Date().toISOString() });
  };

  const writeAudio = (chunk) => {
    if (!provider || !chunk) return;
    audioBytesReceived += Buffer.byteLength(chunk);
    provider.write(chunk);
  };

  const stop = async () => {
    if (!provider) return;
    await provider.finalize();
    recordUsage({ usageContext, sampleRate, audioBytesReceived, language, finalSegmentCount });
    provider = null;
    onSessionStopped?.({ type: 'speech_session_stopped', provider: 'elevenlabs_realtime', timestamp: new Date().toISOString() });
  };

  return { providerName: 'elevenlabs_realtime', start, writeAudio, stop };
}
