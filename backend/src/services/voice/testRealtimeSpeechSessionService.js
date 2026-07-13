/**
 * File responsibility: Deterministic realtime STT provider for automated voice tests.
 * Main responsibilities:
 * - Exercise the real duplex voice orchestration without external STT services.
 * - Accept PCM chunks and emit predictable partial/final transcripts on stop.
 * - Support optional delays so robustness tests can verify timeout and UI states.
 */

import { buildConfidenceGate } from './speechConfidenceGate.js';
import {
  calibrateTranscript,
  mergeStaticNormalizationIntoCalibration,
  normalizeNBestCandidates,
} from './transcriptCalibrationService.js';
import { normalizeTranscript } from './transcriptNormalizer.js';

const DEFAULT_TRANSCRIPT = 'I built a duplex voice interview agent and measured latency from speech end to first audio.';
const DEFAULT_CONFIDENCE = 0.92;

const numberFromEnv = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseNBestCandidates = () => {
  const raw = String(process.env.TEST_REALTIME_STT_NBEST_JSON || process.env.TEST_REALTIME_STT_NBEST || '').trim();
  if (!raw) return [];
  try {
    return normalizeNBestCandidates(JSON.parse(raw));
  } catch {
    return [];
  }
};

const hasAudiblePcm = (buffer = Buffer.alloc(0)) => {
  if (!buffer?.length) return false;
  const view = Buffer.from(buffer);
  for (let index = 0; index + 1 < view.length; index += 2) {
    const sample = view.readInt16LE(index);
    if (Math.abs(sample) > 128) return true;
  }
  return false;
};

export const createTestRealtimeSpeechSession = ({
  language = 'en-NZ',
  contextualGlossary = [],
  onPartialTranscript,
  onFinalTranscript,
  onSessionStarted,
  onSessionStopped,
} = {}) => {
  let started = false;
  let stopped = false;
  let chunks = [];
  let partialSent = false;

  const transcript = process.env.TEST_REALTIME_STT_TRANSCRIPT || DEFAULT_TRANSCRIPT;
  const confidence = Number(process.env.TEST_REALTIME_STT_CONFIDENCE || DEFAULT_CONFIDENCE);
  const startDelayMs = numberFromEnv('TEST_REALTIME_STT_START_DELAY_MS', 0);
  const stopDelayMs = numberFromEnv('TEST_REALTIME_STT_STOP_DELAY_MS', 0);
  const partialDelayMs = numberFromEnv('TEST_REALTIME_STT_PARTIAL_DELAY_MS', 0);
  const finalDelayMs = numberFromEnv('TEST_REALTIME_STT_FINAL_DELAY_MS', 0);

  const buildFinalTranscriptPayload = () => {
    const calibration = calibrateTranscript({
      rawText: transcript,
      nBestCandidates: parseNBestCandidates(),
      glossaryItems: contextualGlossary,
    });
    const normalized = normalizeTranscript(calibration.selectedTranscript);
    const selectedConfidence = calibration.confidence.stt ?? confidence;
    const confidenceGate = buildConfidenceGate(selectedConfidence);

    return {
      type: 'final_transcript',
      displayText: normalized.normalizedText || normalized.rawText,
      normalizedText: normalized.normalizedText,
      rawText: calibration.rawTranscript,
      changed: normalized.changed || calibration.decisionType !== 'no_change',
      corrections: normalized.corrections,
      transcriptCalibration: mergeStaticNormalizationIntoCalibration({ calibration, normalized }),
      nbest: calibration.nbest,
      confidence: selectedConfidence,
      confidenceStatus: confidenceGate.status,
      shouldConfirm: confidenceGate.shouldConfirm,
      shouldRecordAgain: confidenceGate.shouldRecordAgain,
      provider: 'test_realtime_stt',
      language,
      timestamp: new Date().toISOString(),
    };
  };

  return {
    async start() {
      await sleep(startDelayMs);
      started = true;
      stopped = false;
      chunks = [];
      partialSent = false;
      onSessionStarted?.({
        type: 'speech_session_started',
        provider: 'test_realtime_stt',
        timestamp: new Date().toISOString(),
      });
    },

    writeAudio(chunk) {
      if (!started || stopped) return;
      const buffer = Buffer.from(chunk || []);
      chunks.push(buffer);
      if (!partialSent && hasAudiblePcm(buffer)) {
        partialSent = true;
        setTimeout(() => {
          onPartialTranscript?.({
            type: 'partial_transcript',
            text: transcript.split(/\s+/).slice(0, 8).join(' '),
            normalizedText: transcript.split(/\s+/).slice(0, 8).join(' '),
            rawText: transcript.split(/\s+/).slice(0, 8).join(' '),
            confidence,
            provider: 'test_realtime_stt',
            timestamp: new Date().toISOString(),
          });
        }, partialDelayMs);
      }
    },

    async stop() {
      await sleep(stopDelayMs);
      stopped = true;
      const audible = chunks.some((chunk) => hasAudiblePcm(chunk));
      if (audible && transcript.trim()) {
        await sleep(finalDelayMs);
        onFinalTranscript?.(buildFinalTranscriptPayload());
      }
      onSessionStopped?.({
        type: 'speech_session_stopped',
        provider: 'test_realtime_stt',
        audioChunks: chunks.length,
        audible,
        timestamp: new Date().toISOString(),
      });
    },
  };
};
