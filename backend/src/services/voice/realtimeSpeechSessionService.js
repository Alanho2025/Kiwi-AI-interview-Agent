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

const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_BITS_PER_SAMPLE = 16;
const DEFAULT_CHANNELS = 1;

const getAzureSpeechConfig = ({ language = DEFAULT_LANGUAGE }) => {
  const key = process.env.AZURE_SPEECH_KEY || process.env.AZURE_SPEECH_SUBSCRIPTION_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error('Azure Speech credentials are missing. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
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
  let isStopping = false;
  console.log(`[STT-TRACE] Created Azure Speech Recognizer for ${language}`);
  const phraseGrammar = speechSdk.PhraseListGrammar.fromRecognizer(recognizer);

  for (const phrase of buildSpeechPhraseList(extraPhrases)) {
    phraseGrammar.addPhrase(phrase);
  }
  phraseGrammar.setWeight?.(1.5);

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
    // Azure can emit a cancellation while we are deliberately closing the push stream.
    // That is a normal shutdown signal after VAD speech_end, not a user-facing STT failure.
    if (isStopping) {
      console.log(`[STT-TRACE] Ignoring canceled event during intentional speech-session stop.`);
      return;
    }
    // Ignore 1006 timeout errors from Azure which happen normally when no audio is sent for 20s
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
    recognizer.startContinuousRecognitionAsync(resolve, reject);
  });

  let chunksReceived = 0;
  const writeAudio = (chunk) => {
    if (!chunk) return;
    if (chunksReceived === 0) console.log(`[STT-TRACE] First audio chunk written to push stream.`);
    chunksReceived++;
    pushStream.write(chunk);
  };

  const stop = () => new Promise((resolve) => {
    console.log(`[STT-TRACE] Stop called. Closing pushStream. Waiting 800ms before stopContinuousRecognitionAsync.`);
    isStopping = true;
    try {
      pushStream.close();
      // Wait for Azure to process the remaining audio before stopping
      setTimeout(() => {
        try {
          recognizer.stopContinuousRecognitionAsync(() => {
            recognizer.close();
            resolve();
          }, () => {
            recognizer.close();
            resolve();
          });
        } catch {
          try { recognizer.close(); } catch {}
          resolve();
        }
      }, 800);
    } catch {
      try { recognizer.close(); } catch {}
      resolve();
    }
  });

  return { start, writeAudio, stop };
}
