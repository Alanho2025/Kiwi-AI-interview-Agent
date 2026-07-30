import { describe, expect, it, afterEach } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { buildInterviewEnvironment } from '../../../src/services/aiControl/interviewEnvironmentService.js';
import { evaluateInterviewTurn } from '../../../src/services/aiControl/interviewEvaluatorService.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import {
  classifyTechnologyMatch,
  extractFastAnswerUnderstanding,
  resolveFastAnswerUnderstanding,
} from '../../../src/services/aiControl/fastAnswerUnderstandingService.js';

const buildTechnicalSession = (answerText) => ({
  id: 'fast-understanding-session',
  userId: 'user-1',
  targetRole: 'Full Stack Engineer',
  currentQuestionIndex: 2,
  totalQuestions: 6,
  settings: { focusArea: 'technical' },
  transcript: [
    {
      role: 'ai',
      text: 'Tell me about a technical problem you debugged in a production-like system.',
      metadata: { stage: 'technical_core', topic: 'debugging' },
    },
    { role: 'user', text: answerText },
  ],
  analysisResult: {
    matchingDetails: {
      questionPlanHints: { priorityTopics: ['PostgreSQL', 'WebSocket', 'debugging'] },
      validationTargets: ['production debugging', 'backend data flow'],
    },
    parsedCvProfile: {
      skills: ['React', 'PostgreSQL', 'WebSocket', 'Node.js'],
      projects: ['Realtime interview practice platform'],
    },
    parsedJdProfile: {
      requiredSkills: ['PostgreSQL', 'WebSocket APIs', 'production troubleshooting'],
    },
  },
  interviewPlan: {
    questionPool: [
      { text: 'Please introduce yourself.', stage: 'opening', topic: 'self_intro', category: 'opening' },
      { text: 'Tell me about technical debugging.', stage: 'technical_core', topic: 'debugging', category: 'technical' },
      { text: 'Tell me about backend data flow.', stage: 'technical_core', topic: 'backend_data_flow', category: 'technical' },
    ],
  },
});

afterEach(() => {
  delete process.env.ANSWER_UNDERSTANDING_ADAPTER_COMMAND;
  delete process.env.ANSWER_UNDERSTANDING_TIMEOUT_MS;
});

describe('fast answer understanding robustness', () => {
  it('preserves concrete technical facts before choosing the next action', () => {
    const session = buildTechnicalSession(
      'I used PostgreSQL and WebSocket while debugging an Apple Safari failure in the realtime interview flow.'
    );
    const baseEnvironment = buildInterviewEnvironment({ session });
    const understanding = extractFastAnswerUnderstanding({ session, environment: baseEnvironment });
    const environment = buildInterviewEnvironment({ session, latestAnswerUnderstanding: understanding });
    const evaluation = evaluateInterviewTurn({ environment });
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: environment.questionContext.latestQuestionStage,
      currentTopic: environment.questionContext.latestQuestionTopic,
      candidateState: { specificityLevel: evaluation.specificity },
      evaluatorState: evaluation,
      coverageState: { missingTopics: [], coveredTopics: ['debugging'], weakAreas: [] },
      matchState: { validationTargets: [] },
      sectionState: { sectionKey: 'technical', isSectionComplete: false },
      interviewStructure: { focusAreaKey: 'technical', isFinalPlannedTurn: false },
    });

    expect(understanding.technologies).toEqual(expect.arrayContaining(['postgresql', 'websocket', 'apple']));
    expect(understanding.suggestedFollowUp.mode).toBe('deepen');
    expect(understanding.suggestedFollowUp.topic).toMatch(/postgresql|websocket|failure/i);
    expect(evaluation.suggestedNextMode).toBe('deepen');
    expect(evaluation.mentionedEntities).toEqual(expect.arrayContaining(['postgresql', 'websocket', 'apple']));
    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION);
  });

  it('falls back to the local extractor when the optional adapter fails or times out', async () => {
    process.env.ANSWER_UNDERSTANDING_ADAPTER_COMMAND = 'node -e "setTimeout(() => {}, 1000)"';
    process.env.ANSWER_UNDERSTANDING_TIMEOUT_MS = '20';
    const session = buildTechnicalSession('I implemented WebSocket retries and checked PostgreSQL writes after failures.');
    const environment = buildInterviewEnvironment({ session });

    const understanding = await resolveFastAnswerUnderstanding({ session, environment });

    expect(understanding.source).toBe('local_js');
    expect(understanding.adapterError).toMatch(/timed out/i);
    expect(understanding.technologies).toEqual(expect.arrayContaining(['websocket', 'postgresql']));
  });

  it('classifies equivalent technology transferability correctly', () => {
    const svelteMatch = classifyTechnologyMatch({
      targetTech: 'react',
      mentionedTechs: ['svelte'],
      hasStarStructure: true,
    });
    expect(svelteMatch.matchType).toBe('TRANSFERABLE_EVIDENCE');
    expect(svelteMatch.cluster).toBe('frontend_ui_framework');

    const exactMatch = classifyTechnologyMatch({
      targetTech: 'react',
      mentionedTechs: ['react'],
      hasStarStructure: true,
    });
    expect(exactMatch.matchType).toBe('EXACT_MATCH');
  });

  it('distinguishes EXPLICIT_NO_EXPERIENCE from INSUFFICIENT_EVIDENCE', () => {
    const sessionDenial = buildTechnicalSession("I haven't worked with Kafka or message queues before.");
    const envDenial = buildInterviewEnvironment({ session: sessionDenial });
    const understandingDenial = extractFastAnswerUnderstanding({ session: sessionDenial, environment: envDenial });
    const evalDenial = evaluateInterviewTurn({ environment: buildInterviewEnvironment({ session: sessionDenial, latestAnswerUnderstanding: understandingDenial }) });

    expect(evalDenial.candidateDenial).toBe(true);
    expect(evalDenial.evidenceStatus).toBe('EXPLICIT_NO_EXPERIENCE');

    const sessionVague = buildTechnicalSession('I know a little bit about queues maybe.');
    const envVague = buildInterviewEnvironment({ session: sessionVague });
    const understandingVague = extractFastAnswerUnderstanding({ session: sessionVague, environment: envVague });
    const evalVague = evaluateInterviewTurn({ environment: buildInterviewEnvironment({ session: sessionVague, latestAnswerUnderstanding: understandingVague }) });

    expect(evalVague.candidateDenial).toBe(false);
    expect(evalVague.evidenceStatus).toBe('INSUFFICIENT_EVIDENCE');
  });
});
