import { describe, expect, it } from 'vitest';
import { deriveDynamicSlots } from '../../../src/services/aiControl/dynamicSlotService.js';
import { deriveAbductiveState } from '../../../src/services/aiControl/abductiveReasoningService.js';
import { inferInterviewSection, buildSectionState } from '../../../src/services/aiControl/sectionPlannerService.js';
import { evaluateInterviewTurn } from '../../../src/services/aiControl/interviewEvaluatorService.js';

const buildEnvironment = ({ answerText, stage = 'technical_core', topic = 'api_security', requiredSkills = ['API design', 'model validation'] } = {}) => ({
  latestAnswer: { text: answerText },
  questionContext: {
    latestQuestionTopic: topic,
    latestQuestionStage: stage,
    previousQuestionTopics: [],
  },
  roleContext: { requiredSkills },
});

describe('reasoning policy completeness', () => {
  it('derives dynamic slots from decision trade-off signals', () => {
    const slots = deriveDynamicSlots({
      latestAnswer: 'I chose the 70 30 split because it gave a better tradeoff between training data and testing reliability.',
      coverageState: { coveredTopics: [] },
      existingState: {},
    });

    expect(slots.activeSlotTopics).toContain('decision_tradeoff');
  });

  it('does not add dynamic slots for already covered topics', () => {
    const slots = deriveDynamicSlots({
      latestAnswer: 'I used authentication checks and permission rules for the API part.',
      coverageState: { coveredTopics: ['api_security'] },
      existingState: {},
    });

    expect(slots.activeSlotTopics).not.toContain('api_security');
  });

  it('caps dynamic slots and prunes older slots', () => {
    const existingState = {
      activeSlots: Array.from({ length: 6 }, (_, index) => ({ slotKey: `slot_${index}`, topic: `topic_${index}`, priority: 0.4 })),
      prunedSlots: [],
    };
    const slots = deriveDynamicSlots({ latestAnswer: 'I chose a tradeoff decision.', coverageState: {}, existingState });

    expect(slots.activeSlots.length).toBeLessThanOrEqual(5);
    expect(slots.prunedSlots.length).toBeGreaterThan(0);
  });

  it('infers deployment gap when candidate says production was not shipped', () => {
    const state = deriveAbductiveState({
      latestAnswer: 'The project worked locally but it was not deployed to production.',
      currentTopic: 'deployment',
      candidateState: { specificityLevel: 'medium' },
      dynamicSlotState: {},
    });

    expect(state.shouldProbe).toBe(true);
    expect(state.hiddenGap).toBe('deployment_depth');
    expect(state.probeTopic).toBe('deployment');
  });

  it('infers API trade-off gap only when answer is low specificity', () => {
    const low = deriveAbductiveState({
      latestAnswer: 'I used security controls for the API.',
      currentTopic: 'api_security',
      candidateState: { specificityLevel: 'low' },
      dynamicSlotState: {},
    });
    const high = deriveAbductiveState({
      latestAnswer: 'I used permission checks, expiry checks, and tested missing and expired access cases.',
      currentTopic: 'api_security',
      candidateState: { specificityLevel: 'high' },
      dynamicSlotState: {},
    });

    expect(low.shouldProbe).toBe(true);
    expect(low.hiddenGap).toBe('security_tradeoff_depth');
    expect(high.shouldProbe).toBe(false);
  });

  it('routes decision trade-off dynamic slot into trade-off probe', () => {
    const state = deriveAbductiveState({
      latestAnswer: 'I compared several options.',
      currentTopic: 'model_validation',
      candidateState: { specificityLevel: 'medium' },
      dynamicSlotState: { activeSlotTopics: ['decision_tradeoff'] },
    });

    expect(state.shouldProbe).toBe(true);
    expect(state.hiddenGap).toBe('tradeoff_reasoning');
  });

  it('infers section from stage and topic signals', () => {
    expect(inferInterviewSection({ currentStage: 'opening', currentTopic: 'self_intro' })).toBe('introduction');
    expect(inferInterviewSection({ currentStage: 'technical_core', currentTopic: 'api_security' })).toBe('technical');
    expect(inferInterviewSection({ currentStage: 'behavioural', currentTopic: 'teamwork' })).toBe('behavioural');
    expect(inferInterviewSection({ currentStage: 'experience', currentTopic: 'ownership' })).toBe('experience');
  });

  it('marks section complete only when enough target topics are covered and no in-section topics remain missing', () => {
    const complete = buildSectionState({
      currentSection: 'technical',
      coverageState: { coveredTopics: ['technical_depth', 'system_design'], missingTopics: [] },
      dynamicSlotState: {},
    });
    const incomplete = buildSectionState({
      currentSection: 'technical',
      coverageState: { coveredTopics: ['technical_depth'], missingTopics: ['system_design'] },
      dynamicSlotState: {},
    });

    expect(complete.isSectionComplete).toBe(true);
    expect(incomplete.isSectionComplete).toBe(false);
  });

  it('classifies long vague voice answer as probe-worthy rather than advance-worthy', () => {
    const answerText = 'Yeah so basically I helped with that part of the project and I was involved in the backend side, like I joined meetings and checked some things when the team needed help. I learned a lot from it and it was useful experience, but I cannot remember a very specific decision or result right now.';
    const evaluation = evaluateInterviewTurn({ environment: buildEnvironment({ answerText }) });

    expect(evaluation.vagueLongAnswer).toBe(true);
    expect(evaluation.suggestedNextMode).toBe('probe');
    expect(evaluation.closeCurrentIntent).toBe(false);
  });

  it('classifies useful but incomplete voice answer as deepen-worthy', () => {
    const answerText = 'I implemented authentication checks and request controls for the Node backend. I added middleware, checked protected routes, and tested failed cases like missing access details, but I did not explain the trade-off between safety and user experience yet.';
    const evaluation = evaluateInterviewTurn({ environment: buildEnvironment({ answerText }) });

    expect(evaluation.incompleteEvidenceAdmission).toBe(true);
    expect(evaluation.suggestedNextMode).toBe('deepen');
  });

  it('does not treat voice self-correction as misunderstanding when corrected content has evidence', () => {
    const answerText = 'I managed the database, no sorry, I mean I did not manage the whole database. I helped design part of the schema and tested SQL queries for the dashboard feature.';
    const evaluation = evaluateInterviewTurn({ environment: buildEnvironment({ answerText, topic: 'database_sql' }) });

    expect(evaluation.selfCorrectionDetected).toBe(true);
    expect(evaluation.misunderstandingFlag).toBe(false);
  });
});
