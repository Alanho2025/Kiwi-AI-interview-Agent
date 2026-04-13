import { describe, expect, it } from 'vitest';
import { buildInterviewEnvironment } from '../../src/services/aiControl/interviewEnvironmentService.js';

describe('buildInterviewEnvironment', () => {
  it('builds a deterministic interview environment from session state', () => {
    const environment = buildInterviewEnvironment({
      session: {
        id: 'session-1',
        userId: 'user-1',
        targetRole: 'Backend Developer',
        currentQuestionIndex: 2,
        totalQuestions: 6,
        transcript: [
          { role: 'ai', text: 'Tell me about your backend project.', metadata: { stage: 'technical_core', topic: 'backend_project' } },
          { role: 'user', text: 'I built APIs in Node.js for a student platform.' },
        ],
        analysisResult: {
          explanation: { strengths: ['Node.js'], gaps: ['System design'] },
          matchingDetails: { questionPlanHints: { priorityTopics: ['system_design'] } },
          parsedCvProfile: { candidateName: 'Alan', skills: [{ label: 'Node.js' }], projects: [{ title: 'Forkcast' }] },
          parsedJdProfile: { requiredSkills: ['Node.js', 'System Design'] },
        },
      },
      retrievalBundle: { objective: 'bootstrap_interview_context', sourceQuality: 'strong', items: [{ sourceType: 'question_bank' }] },
    });

    expect(environment.questionContext.latestQuestionTopic).toBe('backend_project');
    expect(environment.latestAnswer.tokenCount).toBeGreaterThan(5);
    expect(environment.roleContext.requiredSkills).toContain('Node.js');
    expect(environment.coverageContext.questionCount).toBe(1);
  });
});
