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

  it('rewrites internal validation preambles returned by the model', () => {
    const result = validateMicroPlan({
      microPlan: {
        selectedAngle: 'stakeholder communication',
        finalSpokenQuestion: 'I want to validate one possible gap around limited direct evidence for stakeholder communication. What related experience do you have?',
      },
      planningFrame: {
        ...planningFrame,
        evidencePackage: {
          matchTargets: ['cross-functional stakeholder communication'],
        },
      },
      fallbackQuestion: 'Can you describe a relevant example of cross-functional stakeholder communication and what you personally owned?',
      focusArea: 'combined',
    });

    expect(result.microPlan.finalSpokenQuestion).toBe(
      'Can you describe a relevant example of cross-functional stakeholder communication and what you personally owned?',
    );
    expect(result.microPlan.riskFlags).toContain('internal_assessment_preamble_rewritten');
    expect(result.microPlan.finalSpokenQuestion).not.toMatch(/validate one possible gap|limited direct evidence/i);
  });

  it('keeps model-failure fallback questions candidate-safe', async () => {
    const plan = await runBoundedQuestionMicroPlanning({
      planningFrame,
      fallbackQuestion: 'I want to validate one possible gap around testing evidence. What related experience do you have?',
      focusArea: 'technical',
      callModel: vi.fn().mockRejectedValue(new Error('model unavailable')),
    });

    expect(plan.finalSpokenQuestion).toBe(
      'Can you give me one practical example that shows your experience with this requirement?',
    );
    expect(plan.riskFlags).toContain('internal_assessment_preamble_rewritten');
    expect(plan.finalSpokenQuestion).not.toMatch(/validate one possible gap|testing evidence/i);
  });

  it('does not speak an overlong raw gap summary when a voice micro-plan falls back', async () => {
    const rawGapQuestion = 'Can you describe a relevant example involving strong communication skills across commercial marketing design manufacturing and finance stakeholders while translating technical concepts for non technical senior leaders and presenting to senior management, including what you personally owned?';
    const plan = await runBoundedQuestionMicroPlanning({
      planningFrame: { ...planningFrame, deliveryMode: 'voice' },
      fallbackQuestion: rawGapQuestion,
      focusArea: 'combined',
      callModel: vi.fn().mockRejectedValue(new Error('model unavailable')),
    });

    expect(plan.finalSpokenQuestion).toBe(
      'Can you give me one practical example that shows your experience with this requirement?',
    );
    expect(plan.riskFlags).toContain('overlong_spoken_question_rewritten');
    expect(plan.finalSpokenQuestion.split(/\s+/).length).toBeLessThanOrEqual(30);
  });
});
