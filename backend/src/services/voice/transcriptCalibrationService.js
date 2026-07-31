/**
 * File responsibility: Conservative realtime transcript calibration & phonetic corruption detection.
 * Main responsibilities:
 * - Keep ASR correction bounded to term-level evidence from provider candidates.
 * - Detect near-match phonetic glossary corruptions (Double Metaphone + Levenshtein) when N-best fails.
 * - Aggregate multi-segment minConfidence & risk summaries for transcript trust evaluation.
 * - Preserve raw transcript text and expose auditable calibration metadata.
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
  || '',
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
  if (!normalizedTerm) return false;
  if (normalizedText.includes(` ${normalizedTerm} `)) return true;
  const strippedText = normalizedText.replace(/\s+/g, '');
  const strippedTerm = normalizedTerm.replace(/\s+/g, '');
  return Boolean(strippedTerm.length >= 3 && strippedText.includes(strippedTerm));
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

export const levenshteinDistance = (leftValue = '', rightValue = '') => {
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

export const textSimilarity = (left = '', right = '') => {
  const normalizedLeft = normalizeForSearch(left);
  const normalizedRight = normalizeForSearch(right);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  if (!maxLength) return 1;
  const distance = levenshteinDistance(normalizedLeft, normalizedRight);
  return Math.max(0, 1 - (distance / maxLength));
};

export const computeSoundexCode = (word = '') => {
  const norm = String(word || '')
    .toLowerCase()
    .replace(/^c(?=[aou])/g, 'k')
    .replace(/^g(?=[eiy])/g, 'j')
    .replace(/[^a-z]+/g, '');
  if (!norm) return '';
  const first = norm[0].toUpperCase();
  const mappings = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  };
  let code = first;
  let prev = mappings[norm[0]] || '';
  for (let i = 1; i < norm.length; i += 1) {
    const char = norm[i];
    const mapped = mappings[char] || '';
    if (mapped && mapped !== prev) {
      code += mapped;
      prev = mapped;
    } else if (!mapped && char !== 'h' && char !== 'w') {
      prev = '';
    }
  }
  return (code + '0000').slice(0, 4);
};

export const detectNearMatchGlossaryCorruptions = ({
  rawText = '',
  glossaryItems = [],
} = {}) => {
  const usableItems = glossaryItems.filter(isUsableGlossaryItem);
  if (!usableItems.length || !rawText) return [];

  const rawTokens = normalizeForSearch(rawText).split(/\s+/).filter(Boolean);
  const detectedCorruptions = [];

  for (const item of usableItems) {
    const termNorm = normalizeForSearch(item.term);
    const termTokens = termNorm.split(/\s+/).filter(Boolean);
    if (!termTokens.length) continue;

    if (textContainsTerm(rawText, item.term)) continue;

    const minWindow = Math.max(1, termTokens.length - 1);
    const maxWindow = Math.min(rawTokens.length, termTokens.length + 2);

    for (let windowLen = minWindow; windowLen <= maxWindow; windowLen += 1) {
      for (let index = 0; index <= rawTokens.length - windowLen; index += 1) {
        const windowTokens = rawTokens.slice(index, index + windowLen);
        const windowText = windowTokens.join(' ');
        const windowStripped = windowTokens.join('');

        const distance = levenshteinDistance(windowText, termNorm);
        const similarity = textSimilarity(windowText, termNorm);
        const strippedSimilarity = textSimilarity(windowStripped, termNorm.replace(/\s+/g, ''));
        const effectiveSimilarity = Math.max(similarity, strippedSimilarity);

        const windowPhonetic = windowTokens.map(computeSoundexCode).join('');
        const termPhonetic = termTokens.map(computeSoundexCode).join('');
        const phoneticMatch = windowPhonetic === termPhonetic || textSimilarity(windowPhonetic, termPhonetic) >= 0.65;

        if (effectiveSimilarity >= 0.40 || (effectiveSimilarity >= 0.35 && phoneticMatch)) {
          const matchStrength = (effectiveSimilarity >= 0.50 || (effectiveSimilarity >= 0.40 && phoneticMatch)) ? 'strong' : 'weak';
          detectedCorruptions.push({
            rawSpan: windowText,
            candidateTerm: item.term,
            normalizedTerm: item.normalizedTerm || normalizeForSearch(item.term),
            similarity: Number(effectiveSimilarity.toFixed(4)),
            distance,
            phoneticMatch,
            matchStrength,
            source: item.source,
            sourceRef: item.sourceRef || null,
            scoringImpacting: true,
            ambiguityCount: 1,
          });
        }
      }
    }
  }

  return detectedCorruptions;
};

export const buildMergedTranscriptRiskSummary = (segments = []) => {
  const validSegments = Array.isArray(segments) ? segments.filter(Boolean) : [];
  if (!validSegments.length) {
    return {
      totalSegments: 0,
      minSegmentConfidence: null,
      averageConfidence: null,
      lowConfidenceSegmentCount: 0,
      technicalRiskSegmentCount: 0,
      requiresConfirmation: false,
      riskLevel: 'low',
      riskSegments: [],
    };
  }

  const confidences = validSegments
    .map((s) => Number(s.confidence?.stt ?? s.confidence))
    .filter((c) => Number.isFinite(c));

  const minSegmentConfidence = confidences.length ? Math.min(...confidences) : null;
  const averageConfidence = confidences.length
    ? Number((confidences.reduce((sum, val) => sum + val, 0) / confidences.length).toFixed(4))
    : null;

  const lowConfidenceSegmentCount = validSegments.filter((s) => {
    const conf = Number(s.confidence?.stt ?? s.confidence);
    return Number.isFinite(conf) && conf < 0.70;
  }).length;

  const riskSegments = validSegments.filter((s) => (
    s.decisionType === 'possible_term_corruption'
    || Boolean(s.termCorruption)
    || (Array.isArray(s.corrections) && s.corrections.some((c) => c.scoringImpacting))
  ));

  const technicalRiskSegmentCount = riskSegments.length;
  const requiresConfirmation = (minSegmentConfidence !== null && minSegmentConfidence < 0.65) || technicalRiskSegmentCount > 0;
  const riskLevel = technicalRiskSegmentCount > 0 || (minSegmentConfidence !== null && minSegmentConfidence < 0.60)
    ? 'high'
    : (lowConfidenceSegmentCount > 0 ? 'medium' : 'low');

  return {
    totalSegments: validSegments.length,
    minSegmentConfidence: minSegmentConfidence !== null ? Number(minSegmentConfidence.toFixed(4)) : null,
    averageConfidence,
    lowConfidenceSegmentCount,
    technicalRiskSegmentCount,
    requiresConfirmation,
    riskLevel,
    riskSegments: riskSegments.map((s) => ({
      rawText: s.rawTranscript || s.rawText || '',
      decisionType: s.decisionType || 'no_change',
      termCorruption: s.termCorruption || null,
    })),
  };
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

  const nearMatchCorruptions = detectNearMatchGlossaryCorruptions({
    rawText: topText,
    glossaryItems,
  });

  const baseDecision = buildBaseDecision({
    rawTranscript: topText,
    candidates,
    selectedTranscript: topText,
    selectedIndex: 0,
    startedAt,
  });

  if (nearMatchCorruptions.length > 0) {
    const primaryCorruption = nearMatchCorruptions[0];
    baseDecision.decisionType = 'possible_term_corruption';
    baseDecision.termCorruption = primaryCorruption;
    baseDecision.ambiguityCount = nearMatchCorruptions.length;
    baseDecision.matchStrength = primaryCorruption.matchStrength;
    baseDecision.scoringImpacting = true;
    baseDecision.corrections = nearMatchCorruptions.map((corr) => ({
      rawSpan: corr.rawSpan,
      correctedSpan: corr.candidateTerm,
      glossaryTerm: corr.candidateTerm,
      source: corr.source,
      reason: 'near_match_phonetic_detection',
      similarity: corr.similarity,
      matchStrength: corr.matchStrength,
      scoringImpacting: true,
      userConfirmed: false,
    }));
  }

  return baseDecision;
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
