import { describe, expect, it } from 'vitest';
import { buildInterviewEnvironment } from '../../../src/services/aiControl/interviewEnvironmentService.js';
import { evaluateInterviewTurn } from '../../../src/services/aiControl/interviewEvaluatorService.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import { deriveDynamicSlots } from '../../../src/services/aiControl/dynamicSlotService.js';
import { deriveAbductiveState } from '../../../src/services/aiControl/abductiveReasoningService.js';
import { inferInterviewSection, buildSectionState } from '../../../src/services/aiControl/sectionPlannerService.js';

const baseAnalysis = ({ priorityTopics = ['api_security', 'system_design'], validationTargets = [] } = {}) => ({
  explanation: { strengths: ['Node.js'], gaps: ['Need stronger role evidence'] },
  matchingDetails: {
    questionPlanHints: { priorityTopics },
    validationTargets,
  },
  parsedCvProfile: {
    skills: ['Node.js', 'JWT', 'Python', 'SQL'],
    projects: ['API Platform', 'Data Mining Model'],
  },
  parsedJdProfile: {
    requiredSkills: ['API Security', 'System Design', 'Python', 'SQL'],
  },
});

const buildSession = ({
  id = 'action-test-session',
  currentQuestionIndex = 2,
  totalQuestions = 8,
  focusArea = 'combined',
  aiText = 'Tell me about API security in one project.',
  aiStage = 'technical_core',
  aiTopic = 'api_security',
  userText = 'I implemented JWT auth and rate limiting for our Node API, but I have not explained the trade-offs yet.',
  analysisResult = baseAnalysis(),
  extraTranscript = [],
} = {}) => ({
  id,
  userId: 'user-action-test',
  targetRole: 'Backend Developer',
  status: 'active',
  currentQuestionIndex,
  totalQuestions,
  settings: { focusArea },
  transcript: [
    ...extraTranscript,
    { role: 'ai', text: aiText, metadata: { stage: aiStage, topic: aiTopic } },
    { role: 'user', text: userText },
  ],
  analysisResult,
  interviewPlan: {
    questionPool: [
      { text: 'Please introduce yourself.', stage: 'opening', topic: 'self_intro', category: 'opening' },
      { text: 'Tell me about API security in one project.', stage: 'technical_core', topic: 'api_security', category: 'technical' },
      { text: 'Tell me about system design.', stage: 'technical_core', topic: 'system_design', category: 'technical' },
      { text: 'Tell me about a teamwork challenge.', stage: 'behavioural', topic: 'teamwork', category: 'behavioural' },
      { text: 'Why this role?', stage: 'motivation', topic: 'company_and_role_motivation', category: 'experience' },
    ],
  },
});

const runController = (session) => {
  const environment = buildInterviewEnvironment({ session });
  const evaluatorOutput = evaluateInterviewTurn({ environment });
  const aiTurns = (session.transcript || []).filter((turn) => turn.role === 'ai');
  const coveredTopics = [...new Set(aiTurns.map((turn) => turn.metadata?.topic).filter(Boolean))];
  const coverageState = {
    coveredTopics,
    missingTopics: (session.analysisResult?.matchingDetails?.questionPlanHints?.priorityTopics || []).filter((topic) => !coveredTopics.includes(topic)),
    weakAreas: session.analysisResult?.explanation?.gaps || [],
  };
  const dynamicSlotState = deriveDynamicSlots({
    latestAnswer: environment.latestAnswer.text,
    coverageState,
    existingState: { activeSlots: [], activeSlotTopics: [], prunedSlots: [] },
  });
  const currentTopic = environment.questionContext.latestQuestionTopic
    || dynamicSlotState.activeSlotTopics?.[0]
    || coverageState.missingTopics?.[0]
    || 'role_fit';
  const candidateState = { specificityLevel: evaluatorOutput.specificity };
  const abductiveState = deriveAbductiveState({
    latestAnswer: environment.latestAnswer.text,
    currentTopic,
    candidateState,
    dynamicSlotState,
  });
  const currentSection = inferInterviewSection({
    currentStage: environment.questionContext.latestQuestionStage,
    currentTopic,
    coverageState,
    dynamicSlotState,
  });
  const sectionState = buildSectionState({ currentSection, coverageState, dynamicSlotState });
  const plan = selectNextAction({
    taskType: 'interview_next_turn',
    currentStage: environment.questionContext.latestQuestionStage,
    currentTopic,
    candidateState,
    evaluatorState: evaluatorOutput,
    coverageState,
    matchState: { validationTargets: session.analysisResult?.matchingDetails?.validationTargets || [] },
    dynamicSlotState,
    abductiveState,
    sectionState,
  });

  return { environment, evaluatorOutput, plan, coverageState, dynamicSlotState, abductiveState, sectionState };
};

describe('interview controller action completeness', () => {
  it('rephrases when the candidate does not understand the question', () => {
    const { evaluatorOutput, plan } = runController(buildSession({
      userText: 'Sorry, I am not sure what you mean by that.',
    }));

    expect(evaluatorOutput.suggestedNextMode).toBe('rephrase');
    expect(plan.selectedAction).toBe('REPHRASE_QUESTION');
  });

  it('rephrases when the candidate says the question is tough', () => {
    const { evaluatorOutput, plan } = runController(buildSession({
      userText: 'I am feeling these questions quite tough. Could you make it simpler?',
    }));

    expect(evaluatorOutput.candidateDifficultySignal).toBe(true);
    expect(evaluatorOutput.suggestedNextMode).toBe('rephrase');
    expect(plan.selectedAction).toBe('REPHRASE_QUESTION');
  });

  it('asks a deep dive when the answer is usable but still misses trade-off detail', () => {
    const { evaluatorOutput, plan } = runController(buildSession({
      userText: 'I implemented JWT auth and rate limiting for our Node API, but I have not explained the trade-offs yet.',
    }));

    expect(evaluatorOutput.suggestedNextMode).toBe('deepen');
    expect(plan.selectedAction).toBe('ASK_DEEP_DIVE_QUESTION');
  });

  it('asks a probing question for a thin answer with weak evidence', () => {
    const { evaluatorOutput, plan } = runController(buildSession({
      userText: 'I helped with it a bit and learned some things.',
    }));

    expect(evaluatorOutput.suggestedNextMode).toBe('probe');
    expect(['ASK_PROBING_QUESTION', 'ASK_ABDUCTIVE_PROBE_QUESTION']).toContain(plan.selectedAction);
  });

  it('asks validation when a CV-JD validation target remains uncovered', () => {
    const { plan } = runController(buildSession({
      aiTopic: 'python_model_validation',
      aiText: 'Tell me about how you validated your model.',
      userText: 'I used Python and compared the output accuracy across different splits.',
      analysisResult: baseAnalysis({
        priorityTopics: ['python_model_validation'],
        validationTargets: ['python_model_validation'],
      }),
    }));

    expect(plan.selectedAction).toBe('ASK_VALIDATION_QUESTION');
  });

  it('switches or shifts when the current answer closes the topic and coverage remains', () => {
    const { evaluatorOutput, plan } = runController(buildSession({
      currentQuestionIndex: 4,
      aiStage: 'experience',
      aiTopic: 'ownership',
      aiText: 'What result did your backend API redesign lead to?',
      userText: 'I handled the hardest trade-off, updated the API design, and validated the result by reducing latency by 30 percent.',
      analysisResult: baseAnalysis({ priorityTopics: ['teamwork', 'problem_solving'], validationTargets: [] }),
      extraTranscript: [
        { role: 'ai', text: 'Tell me about a project you owned.', metadata: { stage: 'experience', topic: 'project' } },
      ],
    }));

    expect(evaluatorOutput.suggestedNextMode).toBe('advance');
    expect(['SHIFT_SECTION', 'SWITCH_TOPIC', 'ASK_POOL_QUESTION']).toContain(plan.selectedAction);
  });
});
