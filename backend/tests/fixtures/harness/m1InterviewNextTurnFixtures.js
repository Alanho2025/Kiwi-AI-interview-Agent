export const M1_SENSITIVE_ANSWER = 'I owned the private Kiwi billing migration and reduced failures by 37 percent.';

export const buildM1SessionFixture = () => ({
  id: 'session-m1-shadow-001',
  userId: 'user-m1-shadow-001',
  status: 'in_progress',
  mode: 'text',
  currentQuestionIndex: 2,
  totalQuestions: 6,
  targetRole: 'Backend Engineer',
  cvFileId: 'cv-file-m1-001',
  jdFingerprint: 'jd-fingerprint-m1-001',
  transcript: [
    {
      role: 'ai',
      text: 'Tell me about a production migration you owned.',
      questionId: 'question-m1-002',
      metadata: { countsAsQuestion: true, topic: 'migration_ownership' },
    },
    {
      role: 'user',
      text: M1_SENSITIVE_ANSWER,
      metadata: { inputMode: 'text' },
    },
  ],
  settings: { focusArea: 'combined' },
  analysisResult: {
    schemaVersion: 'analysis-v3',
    matchingDetails: {
      questionPlanHints: { roleCanonical: 'backend_engineer' },
    },
  },
  interviewPlan: {
    schemaVersion: 'interview-plan-v2',
    strategy: { matchAnalysisId: 'match-analysis-m1-001' },
  },
});

export const buildM1ObservationFixture = ({ modelSelectionError = null } = {}) => ({
  decisionContext: {
    currentStage: 'technical_core',
    currentObjective: 'validate_owned_delivery',
    currentTopic: 'private_migration_topic',
    retrievalState: {
      latestSources: ['cv_profile', 'jd_rubric', 'transcript'],
    },
  },
  fallbackPlan: {
    selectedAction: 'ASK_DEEP_DIVE_QUESTION',
  },
  plan: {
    selectedAction: 'ASK_DEEP_DIVE_QUESTION',
    fallbackAction: 'ASK_DEEP_DIVE_QUESTION',
    selectionSource: modelSelectionError ? 'rule_fallback' : 'model_assisted',
    modelSelectedAction: modelSelectionError ? null : 'ASK_DEEP_DIVE_QUESTION',
    modelSelectionError,
    confidence: 0.82,
    candidateActions: [
      { action: 'ASK_DEEP_DIVE_QUESTION', score: 0.82, reason: 'private candidate reason' },
      { action: 'SWITCH_TOPIC', score: 0.42, reason: 'private alternate reason' },
    ],
  },
  interviewerOutput: {
    nextQuestion: 'What trade-off did you make during the private Kiwi billing migration?',
    displayText: 'What trade-off did you make during the private Kiwi billing migration?',
    isComplete: false,
    questionType: 'follow_up',
    turnKind: 'follow_up',
    questionDecision: {
      selectedQuestionId: 'question-m1-003',
      rejectedCandidates: [],
    },
  },
  reflectionRecord: null,
});

export const M1_LEGACY_RESULT = Object.freeze({
  nextQuestion: 'What trade-off did you make during the private Kiwi billing migration?',
  displayText: 'What trade-off did you make during the private Kiwi billing migration?',
  nextQuestionOrder: 3,
  isComplete: false,
  controllerAction: 'ASK_DEEP_DIVE_QUESTION',
  fallbackAction: 'ASK_DEEP_DIVE_QUESTION',
  selectionSource: 'model_assisted',
});
