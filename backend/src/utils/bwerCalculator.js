/**
 * File responsibility: Biased Word Error Rate (B-WER) & N-Best Recall Calculator.
 * Main responsibilities:
 * - Calculate B-WER specifically for domain technical terms in ASR transcripts.
 * - Measure N-best Recall@K and term recovery rates for speech evaluation benchmarks.
 * - Provide quantitative metrics to evaluate phrase hints & calibration improvements without manual human speech testing.
 */

import { collapseSpacing } from './textNormalizers.js';

const normalizeText = (value = '') => collapseSpacing(String(value || ''))
  .toLowerCase()
  .replace(/[^a-z0-9\s-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const containsTerm = (text = '', term = '') => {
  const normText = normalizeText(text);
  const normTerm = normalizeText(term);
  if (!normTerm || !normText) return false;

  const termTokens = normTerm.split(/\s+/).filter(Boolean);
  const textTokens = normText.split(/\s+/).filter(Boolean);
  if (!termTokens.length || !textTokens.length) return false;

  if (termTokens.length === 1) {
    return textTokens.includes(termTokens[0]);
  }

  // Exact token sequence match
  for (let index = 0; index <= textTokens.length - termTokens.length; index += 1) {
    let matches = true;
    for (let termIndex = 0; termIndex < termTokens.length; termIndex += 1) {
      if (textTokens[index + termIndex] !== termTokens[termIndex]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
};

/**
 * Calculates Biased Word Error Rate (B-WER) for a list of target technical terms.
 *
 * @param {Object} params
 * @param {Array<string>} params.expectedTerms - Array of expected domain technical terms
 * @param {string} params.rawTranscript - Raw ASR output transcript
 * @param {string} [params.calibratedTranscript] - Calibrated/processed transcript
 * @param {Array<Object>} [params.nBestCandidates] - Array of N-best candidates from provider
 * @returns {Object} Quantitative B-WER and Recall metrics
 */
export function calculateBwer({
  expectedTerms = [],
  rawTranscript = '',
  calibratedTranscript = '',
  nBestCandidates = [],
} = {}) {
  const terms = Array.isArray(expectedTerms) ? expectedTerms.filter(Boolean) : [];
  if (!terms.length) {
    return {
      totalExpectedTerms: 0,
      rawBwer: 0,
      calibratedBwer: 0,
      bwerReduction: 0,
      nBestRecallAtK: 0,
      termDetails: [],
    };
  }

  let rawSubstitutions = 0;
  let calibratedSubstitutions = 0;
  let nBestFoundCount = 0;

  const termDetails = terms.map((term) => {
    const rawFound = containsTerm(rawTranscript, term);
    const calibratedFound = calibratedTranscript ? containsTerm(calibratedTranscript, term) : rawFound;
    const nBestFound = Array.isArray(nBestCandidates) && nBestCandidates.some((candidate) => (
      containsTerm(candidate?.text || candidate?.displayText || '', term)
    ));

    if (!rawFound) rawSubstitutions += 1;
    if (!calibratedFound) calibratedSubstitutions += 1;
    if (nBestFound) nBestFoundCount += 1;

    return {
      term,
      rawFound,
      calibratedFound,
      nBestFound,
      rawError: !rawFound ? 'substitution_or_deletion' : 'none',
      calibratedError: !calibratedFound ? 'substitution_or_deletion' : 'none',
    };
  });

  const totalExpectedTerms = terms.length;
  const rawBwer = rawSubstitutions / totalExpectedTerms;
  const calibratedBwer = calibratedSubstitutions / totalExpectedTerms;
  const bwerReduction = Math.max(0, rawBwer - calibratedBwer);
  const nBestRecallAtK = nBestFoundCount / totalExpectedTerms;

  return {
    totalExpectedTerms,
    rawErrors: rawSubstitutions,
    rawBwer: Number(rawBwer.toFixed(4)),
    calibratedErrors: calibratedSubstitutions,
    calibratedBwer: Number(calibratedBwer.toFixed(4)),
    bwerReduction: Number(bwerReduction.toFixed(4)),
    nBestRecallAtK: Number(nBestRecallAtK.toFixed(4)),
    termDetails,
  };
}

/**
 * Calculates aggregate B-WER across a suite of evaluation cases.
 *
 * @param {Array<Object>} cases - Array of test cases containing expectedTerm, rawAsr/rawTranscript, etc.
 * @returns {Object} Benchmark summary report
 */
export function calculateBenchmarkSuiteBwer(cases = []) {
  if (!Array.isArray(cases) || !cases.length) {
    return {
      caseCount: 0,
      totalExpectedTerms: 0,
      aggregateRawBwer: 0,
      aggregateCalibratedBwer: 0,
      aggregateBwerReduction: 0,
      aggregateNBestRecall: 0,
    };
  }

  let totalTerms = 0;
  let totalRawErrors = 0;
  let totalCalibratedErrors = 0;
  let totalNBestFound = 0;

  for (const testCase of cases) {
    const term = testCase.expectedTerm || testCase.term;
    if (!term) continue;

    const result = calculateBwer({
      expectedTerms: [term],
      rawTranscript: testCase.rawAsr || testCase.syntheticUtterance || testCase.rawTranscript || '',
      calibratedTranscript: testCase.calibratedTranscript || testCase.selectedTranscript || '',
      nBestCandidates: testCase.nBestCandidates || [],
    });

    totalTerms += 1;
    totalRawErrors += result.rawErrors;
    totalCalibratedErrors += result.calibratedErrors;
    if (result.nBestRecallAtK > 0) totalNBestFound += 1;
  }

  const aggregateRawBwer = totalTerms > 0 ? totalRawErrors / totalTerms : 0;
  const aggregateCalibratedBwer = totalTerms > 0 ? totalCalibratedErrors / totalTerms : 0;
  const aggregateBwerReduction = Math.max(0, aggregateRawBwer - aggregateCalibratedBwer);
  const aggregateNBestRecall = totalTerms > 0 ? totalNBestFound / totalTerms : 0;

  return {
    caseCount: cases.length,
    totalExpectedTerms: totalTerms,
    aggregateRawBwer: Number(aggregateRawBwer.toFixed(4)),
    aggregateCalibratedBwer: Number(aggregateCalibratedBwer.toFixed(4)),
    aggregateBwerReduction: Number(aggregateBwerReduction.toFixed(4)),
    aggregateNBestRecall: Number(aggregateNBestRecall.toFixed(4)),
  };
}
