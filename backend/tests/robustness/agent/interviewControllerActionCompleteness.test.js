import { describe, expect, it } from 'vitest';
import { buildInterviewEnvironment } from '../../../src/services/aiControl/interviewEnvironmentService.js';
import { evaluateInterviewTurn } from '../../../src/services/aiControl/interviewEvaluatorService.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import { deriveDynamicSlots } from '../../../src/services/aiControl/dynamicSlotService.js';
import { deriveAbductiveState } from '../../../src/services/aiControl/abductiveReasoningService.js';
import { inferInterviewSection, buildSectionState } from '../../../src/services/aiControl/sectionPlannerService.js';

const tokenLength = (text = '') => String(text).trim().split(/\s+/).filter(Boolean).length;
const expectVoiceLikeLength = (text, minTokens = 35) => expect(tokenLength(text)).toBeGreaterThanOrEqual(minTokens);

const baseAnalysis = ({ priorityTopics = ['api_security', 'system_design'], validationTargets = [] } = {}) => ({
  explanation: { strengths: ['Node.js'], gaps: ['Need stronger role evidence'] },
  matchingDetails: {
    questionPlanHints: { priorityTopics },
    validationTargets,
  },
  parsedCvProfile: {
    skills: ['Node.js', 'JWT', 'Python', 'SQL', 'model evaluation'],
    projects: ['API Platform', 'Data Mining Model'],
  },
  parsedJdProfile: {
    requiredSkills: ['API Security', 'System Design', 'Python', 'SQL', 'model validation'],
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

describe('interview controller action completeness with realistic voice-length transcripts', () => {
  it('rephrases when the candidate does not understand the question in a real voice-style answer', () => {
    const userText = 'Sorry, I am not really sure what you mean by system design here. Like I can talk about the project structure or the API routes, but I am not sure whether you want architecture, database, or deployment, so could you repeat or make the question a bit clearer?';
    expectVoiceLikeLength(userText, 40);

    const { evaluatorOutput, plan } = runController(buildSession({ userText }));

    expect(evaluatorOutput.suggestedNextMode).toBe('rephrase');
    expect(plan.selectedAction).toBe('REPHRASE_QUESTION');
  });

  it('rephrases when the candidate says the question is tough in a long spoken turn', () => {
    const userText = 'Um I am feeling these questions quite tough because I understand the project generally, but when you ask it in this way I am not sure what level of technical detail you expect. I can explain the model or the evaluation, but maybe can you make the question simpler first?';
    expectVoiceLikeLength(userText, 40);

    const { evaluatorOutput, plan } = runController(buildSession({ userText }));

    expect(evaluatorOutput.candidateDifficultySignal).toBe(true);
    expect(evaluatorOutput.suggestedNextMode).toBe('rephrase');
    expect(plan.selectedAction).toBe('REPHRASE_QUESTION');
  });

  it('asks a deep dive for a realistic usable answer that still misses trade-off detail', () => {
    const userText = 'In that API project I implemented JWT authentication and rate limiting for the Node backend. I added middleware, checked the token before protected routes, and tested common failed cases like missing tokens and expired tokens. It worked for the demo, but I did not really explain the trade-off between security, user experience, and request limits yet.';
    expectVoiceLikeLength(userText, 50);

    const { evaluatorOutput, plan } = runController(buildSession({ userText }));

    expect(evaluatorOutput.suggestedNextMode).toBe('deepen');
    expect(plan.selectedAction).toBe('ASK_DEEP_DIVE_QUESTION');
  });

  it('asks a probe for a long but vague answer with filler and weak evidence', () => {
    const userText = 'Yeah so basically I helped with that part of the project and I was involved in the backend side, like I joined meetings and checked some things when the team needed help. I learned a lot from it and it was useful experience, but I cannot remember a very specific decision or result right now.';
    expectVoiceLikeLength(userText, 45);

    const { evaluatorOutput, plan } = runController(buildSession({ userText }));

    expect(evaluatorOutput.suggestedNextMode).toBe('probe');
    expect(['ASK_PROBING_QUESTION', 'ASK_ABDUCTIVE_PROBE_QUESTION']).toContain(plan.selectedAction);
  });

  it('asks validation for a realistic model-split answer with a CV-JD validation target', () => {
    const userText = 'For the model evaluation I compared different train test splits, mainly 70 30, 60 40, and 80 20. I finally used 70 30 because the accuracy looked more stable and it gave enough testing data. I also checked the output against the project objective, but I probably need to explain the validation method more clearly.';
    expectVoiceLikeLength(userText, 50);

    const { plan } = runController(buildSession({
      aiTopic: 'python_model_validation',
      aiText: 'Tell me about how you validated your model and why you selected the split.',
      userText,
      analysisResult: baseAnalysis({
        priorityTopics: ['python_model_validation'],
        validationTargets: ['python_model_validation'],
      }),
    }));

    expect(plan.selectedAction).toBe('ASK_VALIDATION_QUESTION');
  });

  it('switches or shifts after a realistic topic-closing answer with concrete result evidence', () => {
    const userText = 'For that backend API redesign, I handled the hardest trade-off between keeping the old endpoints stable and improving response time. I updated the route structure, checked the database calls, and validated the result by comparing latency before and after the change. The final result was around 30 percent faster in our test data.';
    expectVoiceLikeLength(userText, 50);

    const { evaluatorOutput, plan } = runController(buildSession({
      currentQuestionIndex: 4,
      aiStage: 'experience',
      aiTopic: 'ownership',
      aiText: 'What result did your backend API redesign lead to?',
      userText,
      analysisResult: baseAnalysis({ priorityTopics: ['teamwork', 'problem_solving'], validationTargets: [] }),
      extraTranscript: [
        { role: 'ai', text: 'Tell me about a project you owned.', metadata: { stage: 'experience', topic: 'project' } },
      ],
    }));

    expect(evaluatorOutput.suggestedNextMode).toBe('advance');
    expect(['SHIFT_SECTION', 'SWITCH_TOPIC', 'ASK_POOL_QUESTION']).toContain(plan.selectedAction);
  });

  it('preserves self-correction in a realistic spoken answer instead of treating the first phrase as final evidence', () => {
    const userText = 'I managed the database, no sorry, I mean I did not manage the whole database. I helped design part of the schema and tested SQL queries for the dashboard feature. The main thing I owned was checking whether the query returned the right fields and whether the result matched the requirement from the menu dataset.';
    expectVoiceLikeLength(userText, 50);

    const { evaluatorOutput, plan } = runController(buildSession({
      aiTopic: 'database_sql',
      aiText: 'Tell me about one database or SQL task you handled yourself.',
      userText,
      analysisResult: baseAnalysis({ priorityTopics: ['database_sql'], validationTargets: ['database_sql'] }),
    }));

    expect(evaluatorOutput.specificity).not.toBe('low');
    expect([
      'ASK_DEEP_DIVE_QUESTION',
      'ASK_VALIDATION_QUESTION',
      'SHIFT_SECTION',
      'SWITCH_TOPIC',
      'ASK_POOL_QUESTION',
      'PROBE_STRESS',
      'PROBE_FRICTION',
      'PROBE_TRADE_OFF',
    ]).toContain(plan.selectedAction);
  });

  it('does not repeat a denied validation target when the candidate gives alternative tool evidence', () => {
    const userText = 'For the analysis part, the main tools I used were Tableau and Python. I do not use Excel for this because Python helps me build scripts and dashboards, and Tableau helps me understand the data and show the result. In that project I used Python, Spark, and Tableau to find the top skills in job descriptions and present the analysis clearly.';
    expectVoiceLikeLength(userText, 50);

    const { evaluatorOutput, plan } = runController(buildSession({
      aiTopic: 'excel',
      aiText: 'Can you tell me about a time you used Microsoft Excel to analyze and present data clearly?',
      userText,
      analysisResult: baseAnalysis({
        priorityTopics: ['excel', 'data_analysis'],
        validationTargets: ['Microsoft Excel'],
      }),
    }));

    expect(evaluatorOutput.skillDenial.deniedTargets).toContain('Microsoft Excel');
    expect(evaluatorOutput.skillDenial.alternativeTools).toEqual(expect.arrayContaining(['Python', 'Tableau']));
    expect(plan.selectedAction).not.toBe('ASK_VALIDATION_QUESTION');
    expect(String(plan.actionInput?.targetTopic || '').toLowerCase()).not.toContain('excel');
  });
});
