import { describe, expect, it, vi } from 'vitest';

import {
  runBoundedQuestionMicroPlanning,
  validateMicroPlan,
} from '../../../src/services/questions/interviewMicroPlanningService.js';

const planningFrame = {
  scenario: 'root_match_gap',
  turnKind: 'root_question',
  parentQuestion: null,
  topRootCandidates: [{ questionId: 'q1', text: 'How did you validate testing?' }],
  evidencePackage: { matchTargets: ['testing evidence'] },
  mode: 'technical',
};

describe('interviewMicroPlanningService', () => {
  it('accepts a bounded JSON micro-plan with one TTS-ready question', async () => {
    const callModel = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        selectedAngle: 'testing validation',
        shortReason: 'The match gap needs direct validation.',
        finalSpokenQuestion: 'How did you validate the testing work yourself?',
        evidenceUsed: ['match_gap:testing evidence'],
        riskFlags: [],
      }),
    });

    const plan = await runBoundedQuestionMicroPlanning({
      planningFrame,
      fallbackQuestion: 'How did you validate testing?',
      focusArea: 'technical',
      callModel,
    });

    expect(plan).toEqual(expect.objectContaining({
      selectedAngle: 'testing validation',
      shortReason: 'The match gap needs direct validation.',
      finalSpokenQuestion: 'How did you validate the testing work yourself?',
      evidenceUsed: ['match_gap:testing evidence'],
      riskFlags: [],
    }));
  });

  it('falls back when the model asks multiple questions', () => {
    const result = validateMicroPlan({
      microPlan: {
        selectedAngle: 'too broad',
        finalSpokenQuestion: 'What did you build? How did you test it?',
      },
      planningFrame,
      fallbackQuestion: 'How did you validate testing?',
      focusArea: 'technical',
    });

    expect(result.ok).toBe(false);
    expect(result.validationErrors).toContain('multiple_questions');
    expect(result.microPlan.finalSpokenQuestion).toBe('How did you validate testing?');
  });

  it('blocks technical implementation probes in behavioural-only mode', () => {
    const result = validateMicroPlan({
      microPlan: {
        selectedAngle: 'technical drift',
        finalSpokenQuestion: 'Which database schema did you implement?',
      },
      planningFrame: { ...planningFrame, mode: 'behavioural' },
      fallbackQuestion: 'What personal action did you take in that situation?',
      focusArea: 'behavioural',
    });

    expect(result.ok).toBe(false);
    expect(result.validationErrors).toContain('behavioural_mode_technical_probe');
    expect(result.microPlan.finalSpokenQuestion).toBe('What personal action did you take in that situation?');
  });
});
