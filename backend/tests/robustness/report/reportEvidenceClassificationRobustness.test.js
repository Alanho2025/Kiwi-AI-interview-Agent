import { describe, expect, it } from 'vitest';

import { analyzeStarrBreakdown } from '../../../src/services/aiControl/starRubricService.js';
import {
  analyseCandidateAnswers,
  buildEvidenceSummary,
} from '../../../src/services/agents/reportGenerator/reportEvidenceAnalysis.js';
import { buildReportTurnDataset } from '../../../src/services/report/reportTurnDatasetService.js';
import { constructiveReportRegressionTranscript } from '../../fixtures/report/constructiveReportRegressionFixture.js';

const answers = buildReportTurnDataset(constructiveReportRegressionTranscript).acceptedAnswers;

describe('constructive report evidence classification', () => {
  it('counts project, ownership, and collaboration answers as real examples', () => {
    const analysed = analyseCandidateAnswers(answers);

    expect(analysed.filter((item) => item.evidenceType === 'direct_past_experience')).toHaveLength(3);
    expect(analysed.at(-1).signals.hasFutureIntent).toBe(true);
    expect(analysed.at(-1).evidenceType).toBe('direct_past_experience');
    expect(buildEvidenceSummary(analysed)).toMatchObject({
      hypotheticalOnlyTurns: 0,
      mixedFutureIntentTurns: 1,
    });
  });

  it('recognises the latency debugging actions and result', () => {
    const breakdown = analyzeStarrBreakdown(answers[1].text);

    expect(breakdown.action).not.toBe('missing');
    expect(breakdown.resultOrReaction).toBe('clear');
  });

  it('requires a number-unit pair or explicit outcome for a clear result', () => {
    const breakdown = analyzeStarrBreakdown(answers[3].text);

    expect(breakdown.resultOrReaction).toBe('clear');
    expect(breakdown.scores.resultOrReaction).toBe(2);
    expect(analyzeStarrBreakdown('I reviewed the user interface and collected feedback.').resultOrReaction).not.toBe('clear');
  });

  it('does not treat vague team progress as candidate result or reflection', () => {
    const breakdown = analyzeStarrBreakdown(answers[2].text);

    expect(breakdown.reflection).toBe('missing');
    expect(breakdown.resultOrReaction).not.toBe('clear');
  });
});
