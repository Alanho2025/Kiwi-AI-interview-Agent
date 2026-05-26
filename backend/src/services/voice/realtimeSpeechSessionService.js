/**
 * File responsibility: Azure continuous speech recognition session.
 * Main responsibilities:
 * - Bridge browser PCM audio chunks into Azure Speech SDK push streams.
 * - Emit partial and final transcripts for real-time interview captions.
 * - Apply phrase hints, transcript normalization, and confidence gating.
 */

import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
import { buildSpeechPhraseList } from '../../config/speechPhraseList.js';
import { normalizeTranscript } from './transcriptNormalizer.js';
import { buildConfidenceGate } from './speechConfidenceGate.js';
import { recordSpeechUsage } from '../aiUsageTrackingService.js';

const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_BITS_PER_SAMPLE = 16;
const DEFAULT_CHANNELS = 1;
const DEFAULT_AZURE_STT_START_TIMEOUT_MS = 5000;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildStartTimeoutError = (timeoutMs) => {
  const error = new Error(`Azure realtime STT did not start within ${timeoutMs}ms.`);
  error.code = 'AZURE_STT_START_TIMEOUT';
  error.isProviderUnavailable = true;
  return error;
};

const getAzureSpeechConfig = ({ language = DEFAULT_LANGUAGE }) => {
  const key = process.env.AZURE_SPEECH_KEY || process.env.AZURE_SPEECH_SUBSCRIPTION_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    const error = new Error('Azure Speech credentials are missing. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
    error.code = 'AZURE_STT_CREDENTIALS_MISSING';
    error.isProviderUnavailable = true;
    throw error;
  }

  const speechConfig = speechSdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechRecognitionLanguage = language;
  speechConfig.setProperty(speechSdk.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, 'true');
  speechConfig.setProperty(speechSdk.PropertyId.SpeechServiceResponse_PostProcessingOption, 'TrueText');
  return speechConfig;
};

const extractConfidence = (result) => {
  try {
    const jsonResult = result?.properties?.getProperty?.(speechSdk.PropertyId.SpeechServiceResponse_JsonResult);
    if (!jsonResult) return null;
    const parsed = JSON.parse(jsonResult);
    const confidence = parsed?.NBest?.[0]?.Confidence;
    return typeof confidence === 'number' ? confidence : null;
  } catch {
    return null;
  }
};

export function createRealtimeSpeechSession({
  language = DEFAULT_LANGUAGE,
  sampleRate = DEFAULT_SAMPLE_RATE,
  extraPhrases = [],
  usageContext = null,
  onPartialTranscript,
  onFinalTranscript,
  onError,
  onSessionStarted,
  onSessionStopped,
} = {}) {
  const speechConfig = getAzureSpeechConfig({ language });
  const audioFormat = speechSdk.AudioStreamFormat.getWaveFormatPCM(
    Number(sampleRate) || DEFAULT_SAMPLE_RATE,
    DEFAULT_BITS_PER_SAMPLE,
    DEFAULT_CHANNELS,
  );
  const pushStream = speechSdk.AudioInputStream.createPushStream(audioFormat);
  const audioConfig = speechSdk.AudioConfig.fromStreamInput(pushStream);
  const recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);
  const azureStartTimeoutMs = parsePositiveInteger(process.env.AZURE_STT_START_TIMEOUT_MS, DEFAULT_AZURE_STT_START_TIMEOUT_MS);
  let isStopping = false;
  let isClosed = false;
  let audioBytesReceived = 0;
  let finalSegmentCount = 0;
  console.log(`[STT-TRACE] Created Azure Speech Recognizer for ${language}`);
  const phraseGrammar = speechSdk.PhraseListGrammar.fromRecognizer(recognizer);

  for (const phrase of buildSpeechPhraseList(extraPhrases)) {
    phraseGrammar.addPhrase(phrase);
  }
  phraseGrammar.setWeight?.(1.5);

  const closeRecognizerSafely = () => {
    if (isClosed) return;
    isClosed = true;
    try { pushStream.close(); } catch {}
    try { recognizer.close(); } catch {}
  };

  recognizer.recognizing = (_, event) => {
    const text = String(event?.result?.text || '').trim();
    if (!text) return;
    console.log(`[STT-TRACE] Partial transcript: "${text}"`);
    onPartialTranscript?.({
      type: 'partial_transcript',
      text,
      language,
      timestamp: new Date().toISOString(),
    });
  };

  recognizer.recognized = (_, event) => {
    if (event?.result?.reason !== speechSdk.ResultReason.RecognizedSpeech) {
      console.log(`[STT-TRACE] Recognized event skipped, reason: ${event?.result?.reason}`);
      return;
    }
    const rawText = String(event?.result?.text || '').trim();
    if (!rawText) {
      console.log(`[STT-TRACE] Recognized event had empty text.`);
      return;
    }
    console.log(`[STT-TRACE] Final transcript: "${rawText}"`);
    const normalized = normalizeTranscript(rawText);
    finalSegmentCount += 1;
    const confidence = extractConfidence(event.result);
    const confidenceGate = buildConfidenceGate(confidence);
    onFinalTranscript?.({
      type: 'final_transcript',
      rawText: normalized.rawText,
      normalizedText: normalized.normalizedText,
      displayText: normalized.normalizedText || normalized.rawText,
      changed: normalized.changed,
      corrections: normalized.corrections,
      confidence,
      confidenceStatus: confidenceGate.status,
      shouldConfirm: confidenceGate.shouldConfirm,
      shouldRecordAgain: confidenceGate.shouldRecordAgain,
      language,
      timestamp: new Date().toISOString(),
    });
  };

  recognizer.canceled = (_, event) => {
    const errorDetails = String(event?.errorDetails || '');
    console.log(`[STT-TRACE] Canceled event. Reason: ${event?.reason}, Details: ${errorDetails}`);
    if (isStopping) {
      console.log(`[STT-TRACE] Ignoring canceled event during intentional speech-session stop.`);
      return;
    }
    if (errorDetails.includes('1006')) {
      console.log(`[STT-TRACE] Ignoring 1006 timeout error.`);
      return;
    }
    onError?.({
      type: 'speech_error',
      reason: String(event?.reason || 'canceled'),
      errorDetails: errorDetails || 'Azure Speech recognition was canceled.',
      timestamp: new Date().toISOString(),
    });
  };

  recognizer.sessionStarted = () => {
    console.log(`[STT-TRACE] Session started on Azure backend.`);
    onSessionStarted?.({ type: 'speech_session_started', timestamp: new Date().toISOString() });
  };

  recognizer.sessionStopped = () => {
    console.log(`[STT-TRACE] Session stopped on Azure backend.`);
    onSessionStopped?.({ type: 'speech_session_stopped', timestamp: new Date().toISOString() });
  };

  const start = () => new Promise((resolve, reject) => {
    console.log(`[STT-TRACE] Starting continuous recognition async...`);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = buildStartTimeoutError(azureStartTimeoutMs);
      console.warn(`[STT-TRACE] ${error.code}: ${error.message}`);
      closeRecognizerSafely();
      onError?.({
        type: 'speech_error',
        reason: error.code,
        errorDetails: 'Azure Speech is unavailable or the subscription/quota is not active.',
        timestamp: new Date().toISOString(),
      });
      reject(error);
    }, azureStartTimeoutMs);

    recognizer.startContinuousRecognitionAsync(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      },
      (errorDetails) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(String(errorDetails || 'Azure realtime STT failed to start.'));
        error.code = 'AZURE_STT_START_FAILED';
        error.isProviderUnavailable = true;
        console.warn(`[STT-TRACE] ${error.code}: ${error.message}`);
        closeRecognizerSafely();
        onError?.({
          type: 'speech_error',
          reason: error.code,
          errorDetails: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      },
    );
  });

  let chunksReceived = 0;
  const writeAudio = (chunk) => {
    if (!chunk || isClosed) return;
    if (chunksReceived === 0) console.log(`[STT-TRACE] First audio chunk written to push stream.`);
    chunksReceived++;
    audioBytesReceived += Buffer.byteLength(chunk);
    pushStream.write(chunk);
  };

  const stop = () => new Promise((resolve) => {
    console.log(`[STT-TRACE] Stop called. Closing pushStream. Waiting 800ms before stopContinuousRecognitionAsync.`);
    isStopping = true;
    try {
      pushStream.close();
      setTimeout(() => {
        try {
          if (isClosed) {
            resolve();
            return;
          }
          recognizer.stopContinuousRecognitionAsync(() => {
            if (usageContext?.userId && audioBytesReceived > 0) {
              const audioSeconds = audioBytesReceived / ((Number(sampleRate) || DEFAULT_SAMPLE_RATE) * 2);
              recordSpeechUsage({
                userId: usageContext.userId,
                sessionId: usageContext.sessionId || null,
                stage: usageContext.stage || 'interview',
                operation: 'speech_to_text',
                audioSeconds,
                audioBytes: audioBytesReceived,
                requestCount: 1,
                metadata: {
                  language,
                  sampleRate,
                  finalSegmentCount,
                  source: usageContext.source || 'azure_realtime_speech',
                },
              }).catch((error) => console.warn('Failed to record realtime STT usage:', error?.message));
            }
            closeRecognizerSafely();
            resolve();
          }, () => {
            closeRecognizerSafely();
            resolve();
          });
        } catch {
          closeRecognizerSafely();
          resolve();
        }
      }, 800);
    } catch {
      closeRecognizerSafely();
      resolve();
    }
  });

  return { start, writeAudio, stop, providerName: 'azure' };
}
