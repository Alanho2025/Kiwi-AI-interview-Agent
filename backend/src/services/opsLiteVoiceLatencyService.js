import { ensureArray } from '../utils/commonHelpers.js';
const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const average = (values = []) => {
  const nums = values.map(toNumber).filter((value) => value != null);
  return nums.length ? Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2)) : null;
};

const percentile = (values = [], p = 0.95) => {
  const nums = values.map(toNumber).filter((value) => value != null).sort((a, b) => a - b);
  if (!nums.length) return null;
  const index = Math.min(nums.length - 1, Math.max(0, Math.ceil(nums.length * p) - 1));
  return Number(nums[index].toFixed(2));
};

const min = (values = []) => {
  const nums = values.map(toNumber).filter((value) => value != null);
  return nums.length ? Number(Math.min(...nums).toFixed(2)) : null;
};

const max = (values = []) => {
  const nums = values.map(toNumber).filter((value) => value != null);
  return nums.length ? Number(Math.max(...nums).toFixed(2)) : null;
};

const getMarkerMs = (backendLatency = null, markerName = '') => {
  if (!backendLatency) return null;
  const directMarker = backendLatency?.markers?.[markerName];
  const directMs = toNumber(directMarker?.msFromStart ?? directMarker);
  if (directMs != null) return directMs;
  const step = ensureArray(backendLatency?.steps).find((item) => item?.step === markerName || item?.name === markerName);
  return toNumber(step?.msFromStart);
};

const getTargetLatency = (record = {}) => {
  const derived = record.derived || record.trace?.derived || record.latency?.derived || {};
  const candidates = [
    record.targetSpeechEndToAiSpeechStartMs,
    record.speechEndToAiSpeechStartMs,
    record.voiceLatency?.targetSpeechEndToAiSpeechStartMs,
    record.voiceLatency?.speechEndToAiSpeechStartMs,
    record.latency?.targetSpeechEndToAiSpeechStartMs,
    record.latency?.speechEndToAiSpeechStartMs,
    derived.speechEndToAiSpeechStartMs,
    derived.vadToPlaybackMs,
    derived.stopToNextAudioMs,
  ];
  return candidates.map(toNumber).find((value) => value != null) ?? null;
};

const getBackendFirstAudio = (record = {}) => {
  const backendLatency = record.backendLatency || record.latency?.backendLatency || record.backend || null;
  return getMarkerMs(backendLatency, 'first_audio_sent');
};

const looksLikeVoiceLatencyRecord = (record = {}) => {
  if (!record || typeof record !== 'object') return false;
  if (getTargetLatency(record) != null) return true;
  if (getBackendFirstAudio(record) != null) return true;
  return String(record.mode || record.phase || record.type || '').toLowerCase().includes('voice')
    && Boolean(record.derived || record.latency || record.backendLatency);
};

const collectCandidateRecords = (analysis = {}) => [
  ...ensureArray(analysis.voiceDeliveryMetrics),
  ...ensureArray(analysis.voiceLatencyTraces),
  ...ensureArray(analysis.voiceLatencyRecords),
  ...ensureArray(analysis.agentTraceEvents).filter((event) => (
    String(event?.mode || event?.phase || event?.type || '').toLowerCase().includes('voice')
    || looksLikeVoiceLatencyRecord(event)
  )),
  analysis.latestVoiceDeliverySummary,
  analysis.latestVoiceLatencySummary,
].filter(Boolean);

export const buildVoiceSessionLatencySummary = (analyses = []) => {
  const records = analyses.flatMap(collectCandidateRecords).filter(looksLikeVoiceLatencyRecord);
  const targetValues = records.map(getTargetLatency).filter((value) => value != null);
  const backendFirstAudioValues = records.map(getBackendFirstAudio).filter((value) => value != null);
  const valuesForPrimary = targetValues.length ? targetValues : backendFirstAudioValues;

  return {
    measurement: 'actual_voice_interview_session_trace',
    note: targetValues.length
      ? 'Measured from stored voice interview turn traces, using speech-end to AI speech start when available.'
      : 'No speech-end to AI speech-start trace was found. Backend first-audio markers are shown only when available.',
    hasVoiceLatencyTrace: targetValues.length > 0,
    traceSampleCount: records.length,
    targetSampleCount: targetValues.length,
    backendFirstAudioSampleCount: backendFirstAudioValues.length,
    averageSpeechEndToAiSpeechStartMs: average(targetValues),
    p95SpeechEndToAiSpeechStartMs: percentile(targetValues, 0.95),
    fastestSpeechEndToAiSpeechStartMs: min(targetValues),
    slowestSpeechEndToAiSpeechStartMs: max(targetValues),
    averageBackendFirstAudioSentMs: average(backendFirstAudioValues),
    primaryAverageMs: average(valuesForPrimary),
  };
};
