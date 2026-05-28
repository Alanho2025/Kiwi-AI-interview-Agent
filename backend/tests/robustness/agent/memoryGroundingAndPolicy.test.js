import { describe, expect, it } from 'vitest';
import { guardGeneratedTextForInterviewMode } from '../../../src/services/aiControl/interviewModeGuard.js';
import { shouldUseFollowUpMemoryFastPath } from '../../../src/services/aiControl/decisionContextBuilder.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';

const voiceSession = {
  id: 'memory-policy-session',
  userId: 'memory-user',
  inputMode: 'realtime_voice',
  mode: 'voice',
  settings: { voiceMode: true },
  transcript: [],
};

describe('memory grounding and policy', () => {
  it('does not allow memory or CV facts to be framed as latest-answer mentions', () => {
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'combined',
      generatedText: "I see you've worked with TypeScript. Let's talk about Python. What did you implement yourself?",
      fallbackText: 'Tell me about one Python example from your CV.',
    });

    expect(result).not.toMatch(/you mentioned/i);
    expect(result).not.toMatch(/i see you.*worked with/i);
  });

  it('preserves grounded latest-answer wording when the text refers to explicit current-answer facts', () => {
    const text = 'You compared 70/30 with 60/40 and 80/20. How did you decide which split worked best?';
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'combined',
      generatedText: text,
      fallbackText: 'How did you validate the split?',
    });

    expect(result).toBe(text);
  });

  it('uses follow-up fast memory policy for current-answer deepen/probe/rephrase turns', () => {
    for (const mode of ['deepen', 'probe', 'rephrase']) {
      const result = shouldUseFollowUpMemoryFastPath({
        taskType: 'interview_next_turn',
        session: voiceSession,
        latestEvaluation: {
          suggestedNextMode: mode,
          closeCurrentIntent: false,
          misunderstandingFlag: mode === 'rephrase',
        },
        latestAnswerUnderstanding: {
          missingEvidence: ['validation_method'],
          followUpValue: 'high',
        },
      });

      expect(result).toBe(true);
    }
  });

  it('uses full memory path when the current topic is closed or a fresh section is needed', () => {
    const closeTopic = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      latestEvaluation: { suggestedNextMode: 'advance', closeCurrentIntent: true },
    });
    const shiftSection = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      latestEvaluation: { suggestedNextMode: 'shift_section', closeCurrentIntent: false },
    });

    expect(closeTopic).toBe(false);
    expect(shiftSection).toBe(false);
  });

  it('forces project shift when memory shows the same project is overused', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'experience',
      currentTopic: 'project_ownership',
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: {
        suggestedNextMode: 'advance',
        misunderstandingFlag: false,
        evidenceGainScore: 0.6,
        successStatus: 'usable',
        frictionState: { frictionDetected: true, frictionLevel: 'medium' },
      },
      coverageState: { coveredTopics: ['project_ownership'], missingTopics: ['teamwork'] },
      matchState: { validationTargets: [] },
      dynamicSlotState: { activeSlotTopics: [] },
      abductiveState: { shouldProbe: false },
      sectionState: { isSectionComplete: false },
      interviewStructure: { focusAreaKey: 'combined' },
      agentMemory: { projectUsage: { 'Data Mining Model': 2 } },
    });

    expect(plan.selectedAction).toBe('FORCE_SHIFT_PROJECT');
    expect(plan.actionInput.forbiddenProject).toBe('Data Mining Model');
  });

  it('does not force project shift during misunderstanding repair', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'api_security',
      candidateState: { specificityLevel: 'low' },
      evaluatorState: {
        suggestedNextMode: 'rephrase',
        misunderstandingFlag: true,
        evidenceGainScore: 0.2,
      },
      coverageState: { coveredTopics: [], missingTopics: ['api_security'] },
      matchState: { validationTargets: [] },
      dynamicSlotState: { activeSlotTopics: [] },
      abductiveState: { shouldProbe: false },
      sectionState: { isSectionComplete: false },
      interviewStructure: { focusAreaKey: 'combined' },
      agentMemory: { projectUsage: { 'Interview Agent': 3 } },
    });

    expect(plan.selectedAction).toBe('REPHRASE_QUESTION');
  });
});
