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
    requirementChecks: [
      { required: true, passed: false, requirement: 'system design' },
    ],
    interviewFocus: ['backend_project', 'system_design'],
    parsedJdProfile: {
      requiredSkills: ['Node.js', 'System Design'],
      behaviouralSignals: ['ownership'],
    },
    parsedCvProfile: {
      skills: ['Node.js'],
      projects: ['Food recommendation API'],
    },
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
  it('builds a controller context with coverage and match signals', async () => {
    const decisionContext = await buildDecisionContext({ taskType: 'interview_next_turn', session: buildSession() });

    expect(decisionContext.currentStage).toBe('technical_core');
    expect(decisionContext.currentTopic).toBe('system_design');
    expect(decisionContext.candidateState.specificityLevel).toBe('low');
    expect(decisionContext.coverageState.missingTopics).toContain('system_design');
    expect(decisionContext.matchState.validationTargets).toContain('full-stack experience');
    expect(decisionContext.agentMemory.recentPatterns).toContain('candidate tends to answer generally');
  });
});
