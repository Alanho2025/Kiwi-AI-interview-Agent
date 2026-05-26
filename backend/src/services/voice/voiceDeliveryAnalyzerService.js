import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';

const FILLER_PATTERNS = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\ber+\b/gi,
  /\bah+\b/gi,
  /\blike\b/gi,
  /\byou know\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
];

const normalizeText = (value = '') => String(value || '').trim();
const words = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean);
const countMatches = (text = '', pattern) => (String(text || '').match(pattern) || []).length;

const countRepeatedCorrections = (text = '') => {
  const lower = String(text || '').toLowerCase();
  return ['sorry', 'i mean', 'actually', 'let me rephrase', 'no wait'].reduce((sum, phrase) => (
    sum + (lower.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  ), 0);
};

export const analyzeVoiceDelivery = ({ transcriptText = '', vad = null, asrConfidence = null } = {}) => {
  const text = normalizeText(transcriptText);
  const wordCount = words(text).length;
  const speakingDurationMs = Number(vad?.speechDurationMs ?? vad?.durationMs ?? 0);
  const speakingDurationSeconds = speakingDurationMs > 0 ? Number((speakingDurationMs / 1000).toFixed(2)) : null;
  const wordsPerMinute = speakingDurationSeconds
    ? Math.round((wordCount / Math.max(speakingDurationSeconds, 1)) * 60)
    : null;
  const fillerCount = FILLER_PATTERNS.reduce((sum, pattern) => sum + countMatches(text, pattern), 0);
  const longPauseCount = Number(vad?.longPauseCount || vad?.pauseCount || (Number(vad?.silenceDurationMs || 0) >= 1800 ? 1 : 0));
  const unclearSpeechSegments = Number(vad?.unclearSpeechSegments || (Number(asrConfidence) > 0 && Number(asrConfidence) < 0.55 ? 1 : 0));
  const repeatedCorrections = countRepeatedCorrections(text);

  const pace = wordsPerMinute == null
    ? 'unknown'
    : wordsPerMinute > 180
      ? 'fast'
      : wordsPerMinute < 85
        ? 'slow'
        : 'steady';
  const answerLength = wordCount < 18 ? 'short' : wordCount > 120 ? 'long' : 'balanced';
  const fillerLevel = fillerCount >= 6 ? 'high' : fillerCount >= 2 ? 'medium' : 'low';
  const deliveryConfidence = unclearSpeechSegments > 0 || asrConfidence === 'low'
    ? 'low'
    : fillerLevel === 'high' || pace !== 'steady'
      ? 'medium'
      : 'high';

  const feedback = [];
  if (pace === 'fast') feedback.push('Slow down slightly so examples are easier to follow.');
  if (pace === 'slow') feedback.push('Keep pauses purposeful so answers stay concise.');
  if (fillerLevel !== 'low') feedback.push('Replace filler words with short pauses.');
  if (answerLength === 'short') feedback.push('Give the listener one more concrete detail before stopping.');
  if (answerLength === 'long') feedback.push('Tighten the answer so the main point is easier to follow.');
  if (unclearSpeechSegments > 0) feedback.push('Check microphone clarity or repeat key terms more distinctly.');

  return {
    speakingDurationSeconds,
    wordCount,
    wordsPerMinute,
    longPauseCount,
    fillerCount,
    answerLength,
    repeatedCorrections,
    unclearSpeechSegments,
    pace,
    fillerLevel,
    deliveryConfidence,
    feedback,
  };
};

const summarizeVoiceDelivery = (items = []) => {
  const metrics = items.filter(Boolean);
  if (!metrics.length) return null;
  const average = (key) => {
    const values = metrics.map((item) => Number(item[key])).filter((value) => Number.isFinite(value));
    return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
  };
  const total = (key) => metrics.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  const feedback = [...new Set(metrics.flatMap((item) => item.feedback || []))].slice(0, 5);
  return {
    turnCount: metrics.length,
    averageWordsPerMinute: average('wordsPerMinute'),
    averageSpeakingDurationSeconds: average('speakingDurationSeconds'),
    totalFillerCount: total('fillerCount'),
    totalLongPauseCount: total('longPauseCount'),
    totalRepeatedCorrections: total('repeatedCorrections'),
    totalUnclearSpeechSegments: total('unclearSpeechSegments'),
    deliveryConfidence: metrics.some((item) => item.deliveryConfidence === 'low')
      ? 'low'
      : metrics.some((item) => item.deliveryConfidence === 'medium')
        ? 'medium'
        : 'high',
    feedback,
  };
};

export const persistVoiceDeliveryMetrics = async ({ sessionId, metrics = {} } = {}) => {
  if (!sessionId || !metrics) return null;
  const current = await SessionAnalysis.findOne({ sessionId }).lean();
  const nextMetrics = [...(current?.voiceDeliveryMetrics || []), { ...metrics, createdAt: new Date().toISOString() }];
  const latestVoiceDeliverySummary = summarizeVoiceDelivery(nextMetrics);
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: { voiceDeliveryMetrics: { ...metrics, createdAt: new Date().toISOString() } },
      $set: { latestVoiceDeliverySummary },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return latestVoiceDeliverySummary;
};

export const buildVoiceDeliverySummaryFromTranscript = (transcript = [], analysisRecord = null) => {
  if (analysisRecord?.latestVoiceDeliverySummary) return analysisRecord.latestVoiceDeliverySummary;
  const metrics = transcript
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.metadata?.voiceDelivery)
    .filter(Boolean);
  return summarizeVoiceDelivery(metrics);
};
