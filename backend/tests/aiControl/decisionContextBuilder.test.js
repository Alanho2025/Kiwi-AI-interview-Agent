import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/aiControl/agentMemoryService.js', () => ({
  getAgentMemory: vi.fn(async () => ({
    recentPatterns: ['candidate tends to answer generally'],
    topicHistory: ['self_intro'],
    failedStrategies: [],
    successfulStrategies: [],
    evidenceGaps: ['system design'],
    lastUpdatedAt: null,
  })),
}));

vi.mock('../../src/services/aiControl/interviewEvaluatorService.js', () => ({
  getLatestEvaluatorRecord: vi.fn(async () => ({
    currentTopic: 'system_design',
    specificity: 'low',
    evidenceGainScore: 0.4,
    misunderstandingFlag: false,
    interactionStatus: 'thin',
    overallInteractionScore: 0.48,
    repetitionRisk: false,
    reflectionNeeded: false,
    suggestedNextMode: 'probe',
  })),
}));

vi.mock('../../src/services/aiControl/dynamicSlotService.js', () => ({
  getDynamicSlotState: vi.fn(async () => ({ activeSlots: [], activeSlotTopics: [], prunedSlots: [] })),
  deriveDynamicSlots: vi.fn(() => ({ activeSlots: [{ slotKey: 'dynamic_system_design', topic: 'system_design' }], activeSlotTopics: ['system_design'], prunedSlots: [] })),
}));

vi.mock('../../src/services/aiControl/reflectionWriterService.js', () => ({
  getSessionReflectionMemory: vi.fn(async () => ([{ lesson: 'Ask for one concrete design decision.' }])),
}));

vi.mock('../../src/services/aiControl/userCoachingMemoryService.js', () => ({
  getUserCoachingMemory: vi.fn(async () => ({ memoryRecords: [{ lesson: 'Tighten scope for this user.' }], latestSummary: 'Tighten scope for this user.' })),
}));

import { buildDecisionContext } from '../../src/services/aiControl/decisionContextBuilder.js';

const buildSession = () => ({
  id: 'session-1',
  userId: 'user-1',
  targetRole: 'Backend Developer',
  transcript: [
    { role: 'ai', text: 'Tell me about a backend project.', timestamp: new Date().toISOString(), metadata: { stage: 'technical_core', topic: 'backend_project' } },
    { role: 'user', text: 'I built APIs with Node.', timestamp: new Date().toISOString() },
  ],
  analysisResult: {
    jobTitle: 'Backend Developer',
    explanation: {
      strengths: ['Node.js fundamentals'],
      gaps: ['System design depth'],
      risks: ['Claimed full-stack experience without evidence'],
      summary: 'Needs more backend depth.',
    },
    requirementChecks: [{ required: true, passed: false, requirement: 'system design' }],
    interviewFocus: ['backend_project', 'system_design'],
    parsedJdProfile: { requiredSkills: ['Node.js', 'System Design'], behaviouralSignals: ['ownership'] },
    parsedCvProfile: { skills: ['Node.js'], projects: ['Food recommendation API'] },
    matchingDetails: {
      validationTargets: ['full-stack experience'],
      questionPlanHints: {
        priorityTopics: ['system_design', 'api_security'],
        followUpTargets: ['full-stack experience'],
        roleCanonical: 'backend_developer',
      },
    },
  },
  interviewPlan: {
    questionPool: [
      { text: 'Please introduce yourself.', stage: 'opening', topic: 'self_intro' },
      { text: 'Tell me about a backend project.', stage: 'technical_core', topic: 'backend_project' },
      { text: 'How do you design APIs?', stage: 'technical_core', topic: 'system_design' },
    ],
  },
  currentQuestionIndex: 2,
});

describe('buildDecisionContext', () => {
  it('builds a controller context with dynamic slots, section state, and coaching memory', async () => {
    const decisionContext = await buildDecisionContext({ taskType: 'interview_next_turn', session: buildSession() });
    expect(decisionContext.currentTopic).toBe('system_design');
    expect(decisionContext.dynamicSlotState.activeSlotTopics).toContain('system_design');
    expect(decisionContext.sectionState.sectionKey).toBeTruthy();
    expect(decisionContext.sessionReflectionMemory[0].lesson).toContain('concrete design decision');
    expect(decisionContext.userCoachingMemory.latestSummary).toContain('Tighten scope');
  });
});
