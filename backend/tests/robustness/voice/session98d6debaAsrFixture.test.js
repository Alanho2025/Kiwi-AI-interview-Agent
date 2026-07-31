import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import {
  buildSessionContextualGlossary,
} from '../../../src/services/voice/speechPhraseHintService.js';
import {
  calibrateTranscript,
} from '../../../src/services/voice/transcriptCalibrationService.js';

const fixturePath = resolve(process.cwd(), 'tests/fixtures/voice/session98d6debaAsrFixture.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('Session 98d6deba ASR Ground-Truth Regression Fixture (Issue #143)', () => {
  it('loads text-only fixture with all 7 confirmed ground-truth pairs and metadata', () => {
    expect(fixture.sessionId).toBe('98d6deba-17c9-4f3a-a181-63a71fb3342d');
    expect(fixture.sttProvider).toBe('Azure realtime STT');
    expect(fixture.language).toBe('en-NZ');
    expect(fixture.cases).toHaveLength(7);
  });

  it('evaluates 4-dimension metrics (Glossary, N-Best, Calibration, Scoring Safety) for all cases', () => {
    const contextualGlossary = buildSessionContextualGlossary({
      analysisResult: fixture.syntheticSessionContext,
    });
    const glossaryTerms = contextualGlossary.map((item) => item.term.toLowerCase());

    const summaryReport = [];

    for (const testCase of fixture.cases) {
      // 1. Glossary Coverage check
      const expectedTermLower = testCase.expectedTerm.toLowerCase();
      const inGlossary = glossaryTerms.includes(expectedTermLower) ||
        contextualGlossary.some((item) => item.term.toLowerCase().includes(expectedTermLower));

      // 2. N-Best Availability check
      const nbestSupplied = Array.isArray(testCase.nBestCandidates) && testCase.nBestCandidates.length > 0;
      const nbestContainsExpected = nbestSupplied && testCase.nBestCandidates.some(
        (cand) => cand.text.toLowerCase().includes(expectedTermLower)
      );

      // 3. Calibration Decision check
      const calibrationDecision = calibrateTranscript({
        rawText: testCase.syntheticUtterance,
        nBestCandidates: testCase.nBestCandidates || [],
        glossaryItems: contextualGlossary,
      });

      // 4. Scoring Safety check
      const calibratedTextLower = (calibrationDecision.calibratedTranscript || calibrationDecision.selectedTranscript).toLowerCase();
      const termRecoveredInText = calibratedTextLower.includes(expectedTermLower);
      const isSafeForScoring = termRecoveredInText || calibrationDecision.decisionType === 'no_change';

      const metricsRow = {
        id: testCase.id,
        expectedTerm: testCase.expectedTerm,
        rawAsr: testCase.rawAsr,
        glossaryCoverage: inGlossary ? 'COVERED' : 'MISSING',
        nBestAvailability: nbestContainsExpected ? 'PRESENT' : (nbestSupplied ? 'PARTIAL' : 'ABSENT'),
        calibrationDecision: calibrationDecision.decisionType,
        selectedTranscript: calibrationDecision.selectedTranscript,
        scoringSafety: isSafeForScoring ? 'SAFE' : 'RISKY',
      };

      summaryReport.push(metricsRow);

      // Assertions per case
      expect(inGlossary).toBe(true);
      expect(calibrationDecision).toBeDefined();
      expect(calibrationDecision.decisionType).toBeDefined();
    }

    // Verify all 7 cases processed
    expect(summaryReport).toHaveLength(7);
  });

  it('preserves raw transcript truth when provider N-best is unavailable', () => {
    const contextualGlossary = buildSessionContextualGlossary({
      analysisResult: fixture.syntheticSessionContext,
    });

    for (const testCase of fixture.cases) {
      const decisionWithoutNBest = calibrateTranscript({
        rawText: testCase.syntheticUtterance,
        nBestCandidates: [],
        glossaryItems: contextualGlossary,
      });

      expect(['no_change', 'possible_term_corruption']).toContain(decisionWithoutNBest.decisionType);
      expect(decisionWithoutNBest.selectedTranscript).toBe(testCase.syntheticUtterance);
    }
  });
});
