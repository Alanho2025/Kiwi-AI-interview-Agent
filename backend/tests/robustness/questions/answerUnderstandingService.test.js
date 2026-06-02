import { describe, expect, it } from 'vitest';

import { buildCheapAnswerSignals } from '../../../src/services/questions/interviewTurnOrchestratorService.js';

describe('answer understanding signals for question orchestration', () => {
  it('extracts project, technology, and missing-evidence signals without a model call', () => {
    const signals = buildCheapAnswerSignals({
      answerText: 'I used React in Forkcast Food AI Assistant for the first UI pass.',
      session: {
        analysisResult: {
          parsedCvProfile: {
            evidenceProfile: {
              sections: {
                projects: [{ title: 'Forkcast Food AI Assistant' }],
              },
            },
          },
        },
      },
    });

    expect(signals).toEqual(expect.objectContaining({
      isContentful: true,
      isShallow: true,
      mentionedProjects: ['Forkcast Food AI Assistant'],
      technologyMentions: expect.arrayContaining(['react']),
    }));
    expect(signals.missingEvidence).toEqual(expect.arrayContaining([
      'result_or_validation',
      'tradeoff_or_constraint',
    ]));
  });

  it('does not classify empty or low-signal transcript fragments as contentful answers', () => {
    const signals = buildCheapAnswerSignals({
      answerText: 'um yeah project',
      session: {},
    });

    expect(signals.isContentful).toBe(false);
    expect(signals.isShallow).toBe(true);
    expect(signals.technologyMentions).toEqual([]);
  });
});
