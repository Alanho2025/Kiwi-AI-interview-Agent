/**
 * File responsibility: Quantitative B-WER & N-Best Recall Evaluation Suite.
 * Main responsibilities:
 * - Calculate exact Biased Word Error Rate (B-WER) for session 98d6deba & 50-case adversarial suite.
 * - Test ASR N-Best recall@K coverage and full-failure modes across 57 total technical term cases.
 * - Provide offline, deterministic evaluation metrics without relying on live human speech.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import {
  calculateBwer,
  calculateBenchmarkSuiteBwer,
} from '../../../src/utils/bwerCalculator.js';
import {
  buildSessionSpeechPhraseContext,
} from '../../../src/services/voice/speechPhraseHintService.js';
import {
  calibrateTranscript,
} from '../../../src/services/voice/transcriptCalibrationService.js';

const fixturePath = resolve(process.cwd(), 'tests/fixtures/voice/session98d6debaAsrFixture.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const advPath = resolve(process.cwd(), 'tests/fixtures/voice/syntheticAsrAdversarialSuite.json');
const advSuite = JSON.parse(readFileSync(advPath, 'utf8'));

describe('B-WER (Biased Word Error Rate) & N-Best Recall Robustness Suite', () => {
  it('calculates 100% B-WER error baseline on raw ASR transcripts for Session 98d6deba', () => {
    const evaluatedCases = fixture.cases.map((testCase) => ({
      ...testCase,
      calibratedTranscript: testCase.syntheticUtterance,
    }));

    const benchmark = calculateBenchmarkSuiteBwer(evaluatedCases);

    expect(benchmark.totalExpectedTerms).toBe(7);
    expect(benchmark.aggregateRawBwer).toBe(1.0);
    expect(benchmark.aggregateNBestRecall).toBeGreaterThan(0.7);
  });

  it('measures N-Best Recall@K availability and identifies N-Best full-failure cases', () => {
    const fullFailureCases = [];
    const partialSuccessCases = [];

    for (const testCase of fixture.cases) {
      const bwerResult = calculateBwer({
        expectedTerms: [testCase.expectedTerm],
        rawTranscript: testCase.syntheticUtterance,
        nBestCandidates: testCase.nBestCandidates || [],
      });

      if (bwerResult.nBestRecallAtK === 0) {
        fullFailureCases.push({
          id: testCase.id,
          expectedTerm: testCase.expectedTerm,
          rawAsr: testCase.rawAsr,
        });
      } else {
        partialSuccessCases.push({
          id: testCase.id,
          expectedTerm: testCase.expectedTerm,
        });
      }
    }

    expect(fullFailureCases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'case-3-pos-system',
        expectedTerm: 'POS system',
        rawAsr: "LP's sister",
      }),
    ]));

    expect(partialSuccessCases.length).toBe(6);
  });

  it('evaluates phrase hint coverage recall prior to STT transmission', () => {
    const context = buildSessionSpeechPhraseContext({
      analysisResult: fixture.syntheticSessionContext,
    });

    const phraseListLower = context.phraseList.map((p) => p.toLowerCase());
    const expectedTerms = fixture.cases.map((c) => c.expectedTerm.toLowerCase());

    let coveredCount = 0;
    for (const term of expectedTerms) {
      const isCovered = phraseListLower.some((phrase) => (
        phrase.includes(term) || term.includes(phrase)
      ));
      if (isCovered) coveredCount += 1;
    }

    const phraseHintRecall = coveredCount / expectedTerms.length;

    expect(phraseHintRecall).toBe(1.0);
    expect(context.phraseList.length).toBeLessThanOrEqual(120);
  });

  it('computes B-WER reduction score after N-Best calibration for Session 98d6deba', () => {
    const evaluatedCases = fixture.cases.map((testCase) => {
      const contextualGlossary = contextFromCase(testCase);
      const decision = calibrateTranscript({
        rawText: testCase.syntheticUtterance,
        nBestCandidates: testCase.nBestCandidates || [],
        glossaryItems: contextualGlossary,
      });

      return {
        ...testCase,
        calibratedTranscript: decision.selectedTranscript,
      };
    });

    const benchmark = calculateBenchmarkSuiteBwer(evaluatedCases);

    expect(benchmark.aggregateRawBwer).toBe(1.0);
    expect(benchmark.aggregateCalibratedBwer).toBeLessThan(0.2);
    expect(benchmark.aggregateBwerReduction).toBeGreaterThan(0.8);
  });

  it('evaluates 100-case multi-domain (Tech, Data, BA, Consulting, Marketing, NZ Education, NZ Law) adversarial term suite for broad system robustness', () => {
    expect(advSuite.cases.length).toBe(100);

    const evaluatedAdvCases = advSuite.cases.map((testCase) => {
      const glossaryItems = [
        {
          term: testCase.expectedTerm,
          normalizedTerm: testCase.expectedTerm.toLowerCase(),
          source: 'cv_profile',
          priority: 'high',
          safeForPhraseHint: true,
          safeForAutoCorrection: true,
        },
      ];

      const decision = calibrateTranscript({
        rawText: testCase.syntheticUtterance,
        nBestCandidates: [], // Simulating N-best full failure mode across all 100 cases
        glossaryItems,
      });

      return {
        ...testCase,
        calibratedTranscript: decision.selectedTranscript,
        decisionType: decision.decisionType,
      };
    });

    const benchmark = calculateBenchmarkSuiteBwer(evaluatedAdvCases);

    expect(benchmark.aggregateRawBwer).toBeGreaterThanOrEqual(0.85);

    const flaggedCases = evaluatedAdvCases.filter((c) => c.decisionType === 'possible_term_corruption');
    const detectionRate = flaggedCases.length / 100;

    // Detection rate across 100 multi-domain corruptions without N-best is >= 50%
    expect(detectionRate).toBeGreaterThanOrEqual(0.50);
  });
});

function contextFromCase(testCase) {
  return [
    {
      term: testCase.expectedTerm,
      normalizedTerm: testCase.expectedTerm.toLowerCase(),
      source: 'cv_profile',
      priority: 'high',
      safeForPhraseHint: true,
      safeForAutoCorrection: true,
    },
  ];
}
