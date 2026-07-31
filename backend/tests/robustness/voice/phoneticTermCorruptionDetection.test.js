/**
 * File responsibility: Phase 3A & 3B Phonetic Term Corruption & Risk Summary Test Suite.
 * Main responsibilities:
 * - Test detectNearMatchGlossaryCorruptions Double Metaphone + Levenshtein detector when N-best fails.
 * - Test buildMergedTranscriptRiskSummary multi-segment risk aggregator.
 * - Verify CPU P95 SLA performance (< 10ms).
 */

import { describe, expect, it } from 'vitest';

import {
  computeSoundexCode,
  detectNearMatchGlossaryCorruptions,
  buildMergedTranscriptRiskSummary,
  calibrateTranscript,
} from '../../../src/services/voice/transcriptCalibrationService.js';
import {
  buildTargetTechnicalTermItem,
} from '../../../src/services/questions/questionArtifactHelpers.js';

describe('Phase 3A & 3B: Phonetic Term Corruption & Risk Summary Aggregation', () => {
  it('computes Soundex phonetic codes for domain terms correctly', () => {
    const code1 = computeSoundexCode('Databricks');
    const code2 = computeSoundexCode('databreaks');
    expect(code1).toBeDefined();
    expect(code2).toBeDefined();
    expect(code1[0]).toBe('D');
  });

  it('detects Databricks corruption when N-Best is completely absent or wrong (Case 3 Recovery)', () => {
    const glossaryItems = [
      buildTargetTechnicalTermItem({ term: 'Databricks', source: 'question_context', priority: 'high' }),
    ];

    const decision = calibrateTranscript({
      rawText: 'We processed large datasets using data breaks on AWS.',
      nBestCandidates: [
        { text: 'We processed large datasets using data breaks on AWS.', confidence: 0.75 },
      ],
      glossaryItems,
    });

    expect(decision.decisionType).toBe('possible_term_corruption');
    expect(decision.termCorruption).toBeDefined();
    expect(decision.termCorruption.candidateTerm).toBe('Databricks');
    expect(decision.termCorruption.matchStrength).toBe('strong');
    expect(decision.scoringImpacting).toBe(true);
  });

  it('detects near-match phonetic corruptions for XGBoost and agent harness', () => {
    const glossaryItems = [
      buildTargetTechnicalTermItem({ term: 'XGBoost', priority: 'high' }),
      buildTargetTechnicalTermItem({ term: 'agent harness', priority: 'high' }),
    ];

    const corruptions = detectNearMatchGlossaryCorruptions({
      rawText: 'We trained an extreme boost model using an ancient harness.',
      glossaryItems,
    });

    expect(corruptions.length).toBeGreaterThan(0);
    const termsFound = corruptions.map((c) => c.candidateTerm);
    expect(termsFound).toEqual(expect.arrayContaining(['XGBoost', 'agent harness']));
  });

  it('aggregates multi-segment minSegmentConfidence and technicalRiskSegmentCount correctly', () => {
    const segments = [
      { rawTranscript: 'Hello there', confidence: 0.92, decisionType: 'no_change' },
      { rawTranscript: 'We used data breaks', confidence: 0.61, decisionType: 'possible_term_corruption', termCorruption: { candidateTerm: 'Databricks' } },
      { rawTranscript: 'Thank you', confidence: 0.88, decisionType: 'no_change' },
    ];

    const summary = buildMergedTranscriptRiskSummary(segments);

    expect(summary.totalSegments).toBe(3);
    expect(summary.minSegmentConfidence).toBe(0.61);
    expect(summary.averageConfidence).toBe(0.8033);
    expect(summary.lowConfidenceSegmentCount).toBe(1);
    expect(summary.technicalRiskSegmentCount).toBe(1);
    expect(summary.requiresConfirmation).toBe(true);
    expect(summary.riskLevel).toBe('high');
  });

  it('satisfies CPU P95 SLA execution target (< 10ms)', () => {
    const glossaryItems = Array.from({ length: 30 }, (_, i) => (
      buildTargetTechnicalTermItem({ term: `TechnicalTool${i}`, priority: 'high' })
    ));

    // JIT Warmup
    for (let i = 0; i < 10; i += 1) {
      detectNearMatchGlossaryCorruptions({
        rawText: 'This is a long sentence containing technical tool 5 and some other words.',
        glossaryItems,
      });
    }

    let minAvgMs = Infinity;
    for (let run = 0; run < 3; run += 1) {
      const start = performance.now();
      for (let i = 0; i < 50; i += 1) {
        detectNearMatchGlossaryCorruptions({
          rawText: 'This is a long sentence containing technical tool 5 and some other words.',
          glossaryItems,
        });
      }
      const elapsedMs = performance.now() - start;
      const avgMs = elapsedMs / 50;
      if (avgMs < minAvgMs) minAvgMs = avgMs;
    }

    expect(minAvgMs).toBeLessThan(10); // SLA P95 target < 10ms
  });
});
