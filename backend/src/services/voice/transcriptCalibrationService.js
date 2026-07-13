/**
 * File responsibility: Conservative realtime transcript calibration.
 * Main responsibilities:
 * - Keep ASR correction bounded to term-level evidence from provider candidates.
 * - Preserve raw transcript text and expose auditable calibration metadata.
 * - Prevent CV/JD context from becoming candidate spoken evidence.
 */

import { collapseSpacing } from '../../utils/textNormalizers.js';

const DEFAULT_MAX_CONFIDENCE_DELTA = 0.15;
const MIN_RERANK_SIMILARITY = 0.62;
const MAX_COMPARISON_LENGTH = 320;
const WORD_COUNT_DELTA_LIMIT = 4;

const cleanText = (value = '') => collapseSpacing(String(value || ''));

const normalizeForSearch = (value = '') => cleanText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const countWords = (value = '') => normalizeForSearch(value).split(/\s+/).filter(Boolean).length;

const confidenceOrNull = (value) => {
  const confidence = Number(value);
  return Number.isFinite(confidence) ? confidence : null;
};

const resolveCandidateText = (candidate = {}) => cleanText(
  candidate.text
  || candidate.displayText
  || candidate.Display
  || candidate.DisplayText
  || candidate.ITN
  || candidate.MaskedITN
  || candidate.Lexical
  || ''
);

export const normalizeNBestCandidates = (nBestCandidates = []) => {
  if (!Array.isArray(nBestCandidates)) return [];
  return nBestCandidates
    .map((candidate, index) => ({
      index,
      text: resolveCandidateText(candidate),
      confidence: confidenceOrNull(candidate?.confidence ?? candidate?.Confidence),
    }))
    .filter((candidate) => candidate.text)
    .slice(0, 5);
};

export const extractNBestCandidatesFromAzureJson = (azureJsonResult = null) => {
  const nbest = Array.isArray(azureJsonResult?.NBest) ? azureJsonResult.NBest : [];
  return normalizeNBestCandidates(nbest);
};

const textContainsTerm = (text = '', term = '') => {
  const normalizedText = ` ${normalizeForSearch(text)} `;
  const normalizedTerm = normalizeForSearch(term);
  return Boolean(normalizedTerm && normalizedText.includes(` ${normalizedTerm} `));
};

const isUsableGlossaryItem = (item = {}) => {
  if (!item?.term || item.safeForAutoCorrection === false) return false;
  return item.priority === 'high' || item.priority === 'medium';
};

const findMatchedGlossaryItem = ({ candidateText, rawText, glossaryItems = [] }) => {
  const usableItems = glossaryItems.filter(isUsableGlossaryItem);
  return usableItems.find((item) => (
    textContainsTerm(candidateText, item.term)
    && !textContainsTerm(rawText, item.term)
  )) || null;
};

const levenshteinDistance = (leftValue = '', rightValue = '') => {
  const left = leftValue.slice(0, MAX_COMPARISON_LENGTH);
  const right = rightValue.slice(0, MAX_COMPARISON_LENGTH);
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    for (let index = 0; index <= right.length; index += 1) previous[index] = current[index];
  }

  return previous[right.length];
};

const textSimilarity = (left = '', right = '') => {
  const normalizedLeft = normalizeForSearch(left);
  const normalizedRight = normalizeForSearch(right);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  if (!maxLength) return 1;
  const distance = levenshteinDistance(normalizedLeft, normalizedRight);
  return Math.max(0, 1 - (distance / maxLength));
};

const isBoundedTranscriptAlternative = ({ rawText, candidateText }) => {
  const similarity = textSimilarity(rawText, candidateText);
  const wordDelta = Math.abs(countWords(rawText) - countWords(candidateText));
  return similarity >= MIN_RERANK_SIMILARITY && wordDelta <= WORD_COUNT_DELTA_LIMIT;
};

const buildBaseDecision = ({ rawTranscript, candidates, selectedTranscript, selectedIndex, startedAt }) => ({
  rawTranscript,
  selectedTranscript,
  normalizedTranscript: selectedTranscript,
  calibratedTranscript: selectedTranscript,
  decisionType: 'no_change',
  corrections: [],
  confidence: {
    stt: candidates[selectedIndex]?.confidence ?? candidates[0]?.confidence ?? null,
    calibration: null,
  },
  nbest: {
    retained: candidates.length > 0,
    candidateCount: candidates.length,
    selectedIndex,
  },
  latency: {
    extractionMs: 0,
    rerankMs: Math.max(0, Date.now() - startedAt),
    correctionMs: 0,
    totalCalibrationMs: Math.max(0, Date.now() - startedAt),
  },
  guardrail: {
    answerQualityChanged: false,
    usedCvJdAsSpokenEvidence: false,
  },
});

export const calibrateTranscript = ({
  rawText = '',
  nBestCandidates = [],
  glossaryItems = [],
  maxConfidenceDelta = DEFAULT_MAX_CONFIDENCE_DELTA,
} = {}) => {
  const startedAt = Date.now();
  const candidates = normalizeNBestCandidates(nBestCandidates);
  const rawTranscript = cleanText(rawText || candidates[0]?.text || '');
  const baseCandidates = candidates.length
    ? candidates
    : [{ index: 0, text: rawTranscript, confidence: null }];
  const topCandidate = baseCandidates[0];
  const topText = rawTranscript || topCandidate.text;
  const topConfidence = topCandidate.confidence;

  for (const candidate of baseCandidates.slice(1)) {
    const candidateConfidence = candidate.confidence;
    if (!Number.isFinite(topConfidence) || !Number.isFinite(candidateConfidence)) continue;
    if ((topConfidence - candidateConfidence) > maxConfidenceDelta) continue;

    const matchedTerm = findMatchedGlossaryItem({
      candidateText: candidate.text,
      rawText: topText,
      glossaryItems,
    });
    if (!matchedTerm) continue;
    if (!isBoundedTranscriptAlternative({ rawText: topText, candidateText: candidate.text })) continue;

    const decision = buildBaseDecision({
      rawTranscript: topText,
      candidates: baseCandidates,
      selectedTranscript: candidate.text,
      selectedIndex: candidate.index,
      startedAt,
    });
    decision.decisionType = 'nbest_rerank';
    decision.confidence.calibration = textSimilarity(topText, candidate.text);
    decision.corrections = [{
      rawSpan: topText,
      correctedSpan: candidate.text,
      glossaryTerm: matchedTerm.term,
      source: matchedTerm.source,
      reason: matchedTerm.reason,
      confidence: candidateConfidence,
      scoringImpacting: true,
      userConfirmed: false,
    }];
    return decision;
  }

  return buildBaseDecision({
    rawTranscript: topText,
    candidates,
    selectedTranscript: topText,
    selectedIndex: 0,
    startedAt,
  });
};

export const mergeStaticNormalizationIntoCalibration = ({ calibration, normalized }) => {
  const staticCorrections = Array.isArray(normalized?.corrections) ? normalized.corrections : [];
  const staticNormalizationChanged = Boolean(normalized?.changed);
  const decisionType = calibration?.decisionType === 'no_change' && staticNormalizationChanged
    ? 'static_normalization'
    : (calibration?.decisionType || (staticNormalizationChanged ? 'static_normalization' : 'no_change'));

  return {
    ...calibration,
    normalizedTranscript: normalized?.normalizedText
      || normalized?.rawText
      || calibration?.selectedTranscript
      || calibration?.rawTranscript
      || '',
    calibratedTranscript: normalized?.normalizedText
      || normalized?.rawText
      || calibration?.selectedTranscript
      || calibration?.rawTranscript
      || '',
    decisionType,
    staticCorrections,
  };
};
