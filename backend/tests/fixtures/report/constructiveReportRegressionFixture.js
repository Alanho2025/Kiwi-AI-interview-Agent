const questionMetadata = (overrides = {}) => ({
  countsAsQuestion: true,
  turnType: 'interview_question',
  ...overrides,
});

const answerMetadata = {
  countsAsAnswer: true,
  turnType: 'candidate_answer',
  transcriptStatus: 'accepted',
};

export const constructiveReportRegressionTranscript = [
  {
    role: 'ai',
    text: 'How did you verify that feedback helped the candidate improve?',
    metadata: questionMetadata({
      questionId: 'q-validation',
      questionFamily: 'motivation',
      evidenceMode: 'company_motivation',
      followUpIntent: 'validation',
    }),
  },
  {
    role: 'user',
    text: 'I did not set a before-and-after measure. I mainly asked whether the feedback was useful.',
    metadata: answerMetadata,
  },
  {
    role: 'ai',
    text: 'I heard that you asked whether the feedback was useful. Is that correct?',
    metadata: {
      countsAsQuestion: false,
      turnType: 'transcript_confirmation',
      repairReason: 'low_confidence_transcript',
    },
  },
  {
    role: 'user',
    text: 'Yes, that is correct.',
    metadata: {
      countsAsAnswer: false,
      turnType: 'transcript_confirmation_response',
    },
  },
  {
    role: 'ai',
    text: 'Tell me about a time you reduced friction in a product or workflow.',
    metadata: questionMetadata({
      questionId: 'q-friction',
      questionFamily: 'behavioural',
      evidenceMode: 'starr',
    }),
  },
  {
    role: 'user',
    text: 'In a support workflow, latency was about 12 seconds. I traced the slow calls, changed the request flow, and retested it. The response time fell to 3 seconds.',
    metadata: answerMetadata,
  },
  {
    role: 'ai',
    text: 'Describe a time you took ownership of a team problem.',
    metadata: questionMetadata({
      questionId: 'q-ownership',
      questionFamily: 'behavioural',
      evidenceMode: 'starr',
    }),
  },
  {
    role: 'user',
    text: 'On a food recommendation app, I took ownership when the team was blocked. I clarified responsibilities, shared the plan, and kept the work moving, but we did not record a measurable result.',
    metadata: answerMetadata,
  },
  {
    role: 'ai',
    text: 'Give an example of collaborating to improve quality.',
    metadata: questionMetadata({
      questionId: 'q-collaboration',
      questionFamily: 'behavioural',
      evidenceMode: 'starr',
    }),
  },
  {
    role: 'user',
    text: 'During a 40 to 50 unit pilot, I worked with the QA team, changed the test checklist, and shared the failure patterns. The retest rate dropped from 15% to 5%. I can bring the same approach to this role.',
    metadata: answerMetadata,
  },
];

export const constructiveReportPlannedQuestionCount = 4;

export const repairTurnsThatMustNotCount = constructiveReportRegressionTranscript.slice(2, 4);
