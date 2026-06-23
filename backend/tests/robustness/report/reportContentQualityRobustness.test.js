import { describe, expect, it } from 'vitest';

import { validateAnswerRewrite } from '../../../src/services/report/reportContentQualityService.js';
import { detectReportTranscriptRisks } from '../../../src/services/report/reportTranscriptRiskService.js';

describe('answer rewrite quality', () => {
  it('flags conflicting percentage claims without rewriting either transcript', () => {
    const transcript = [
      { role: 'user', text: 'The retest rate dropped from 15% to 5%.', questionId: 'q1', metadata: { rawTranscriptText: 'The retest rate dropped from 15% to 5%.' } },
      { role: 'user', text: 'The retest rate dropped from 50% to 5%.', questionId: 'q2', metadata: { rawTranscriptText: 'The retest rate dropped from 50% to 5%.' } },
    ];

    const risks = detectReportTranscriptRisks({ transcript, session: {} });

    expect(risks).toEqual(expect.arrayContaining([expect.objectContaining({
      code: 'conflicting_metric_values',
      needsUserConfirmation: true,
      affectedTurnIds: ['q1', 'q2'],
    })]));
    expect(transcript[0].text).toContain('15%');
    expect(transcript[1].text).toContain('50%');
  });
  it.each([
    'Topic: self_intro. Principle: [補充核心原則]',
    'Topic: project. Action: [describe your action]',
    'Topic: project. Action: [ŠªfPNºˆLRÕ]',
  ])('rejects non-candidate-facing rewrite text', (better) => {
    expect(validateAnswerRewrite({
      question: 'Tell me about the project.',
      weak: 'It was hard.',
      better,
    })).toMatchObject({ valid: false });
  });

  it('accepts a grounded readable rewrite', () => {
    const better = 'The main friction was latency. I traced the frontend, backend, speech-to-text, and speech synthesis stages, found delays in answer understanding and question generation, simplified the routing step, and reduced latency from about 12 seconds to about 3 seconds.';

    expect(validateAnswerRewrite({
      question: 'What was the hardest friction point?',
      weak: 'Latency was hard.',
      better,
    })).toMatchObject({ valid: true });
  });
});
