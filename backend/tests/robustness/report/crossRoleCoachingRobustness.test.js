import { describe, expect, it } from 'vitest';

import {
  buildAnswerRewriteExamples,
  buildCoachingAdvice,
} from '../../../src/services/agents/reportGenerator/reportCoachingBuilder.js';
import { buildReportDraft } from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';

const bannedItFallbacks = /React Native|mobile feature|debugging story|API integration|regression testing/i;

describe('cross-role report coaching', () => {
  it('rewrites a nurse scenario from the original answer and role topic without inventing IT work', () => {
    const examples = buildAnswerRewriteExamples({
      evidenceSummary: { totals: { hypothetical_understanding: 1 } },
      turnBreakdowns: [{
        questionTopic: 'medication safety',
        answer: 'I would follow the process and check the patient record.',
        rubricType: 'role_specific',
        evidenceMode: 'scenario_reasoning',
      }],
    });

    expect(examples[0].weak).toBe('I would follow the process and check the patient record.');
    expect(examples[0].better).toContain('medication safety');
    expect(examples[0].better).toContain('[說明驗證方式]');
    expect(examples[0].better).toContain('[補充實際結果]');
    expect(JSON.stringify(examples)).not.toMatch(bannedItFallbacks);
  });

  it('uses a STARR scaffold only for behavioural rewrites', () => {
    const [example] = buildAnswerRewriteExamples({
      evidenceSummary: { totals: {} },
      turnBreakdowns: [{
        questionTopic: 'conflict resolution',
        answer: 'I spoke with my colleague and we resolved it.',
        rubricType: 'starr',
        frameworkKey: 'behavioural_starr',
      }],
    });

    expect(example.better).toContain('Situation:');
    expect(example.better).toContain('Reflection:');
  });

  it('uses evidence, validity, scope, conditions, and verification for credential rewrites', () => {
    const [example] = buildAnswerRewriteExamples({
      evidenceSummary: { totals: {} },
      turnBreakdowns: [{
        questionTopic: 'professional registration',
        answer: 'Yes, I have registration.',
        rubricType: 'role_specific',
        evidenceMode: 'credential_verification',
      }],
    });

    expect(example.better).toContain('[補充資格證明]');
    expect(example.better).toContain('[說明有效期限]');
    expect(example.better).toContain('[說明驗證方式]');
    expect(example.better).not.toMatch(/business outcome/i);
  });

  it('does not push past-project evidence for scenario and knowledge questions', () => {
    const advice = buildCoachingAdvice({
      evidenceSummary: {
        averageStrength: 1,
        totals: { hypothetical_understanding: 2, direct_past_experience: 0 },
      },
      turnBreakdowns: [
        { rubricType: 'role_specific', evidenceMode: 'scenario_reasoning' },
        { rubricType: 'role_specific', evidenceMode: 'knowledge_explanation' },
      ],
    });
    const text = JSON.stringify(advice);

    expect(text).not.toMatch(/real project|past experience|mobile feature|debugging story/i);
    expect(text).toMatch(/requirements|judgement|risk|validation|outcome/i);
    expect(text).not.toMatch(bannedItFallbacks);
  });

  it('does not turn scenario reasoning into a past-project gap in the report narrative', () => {
    const report = buildReportDraft({
      session: { id: 'scenario-report', totalQuestions: 1 },
      analysisResult: { explanation: { strengths: [], gaps: [] } },
      interviewPlan: {},
      explanation: { strengths: [], gaps: [] },
      evidenceSummary: {
        averageStrength: 1,
        totals: { hypothetical_understanding: 1 },
        strongestExamples: [],
      },
      interviewMetrics: {
        interviewerQuestionCount: 1,
        candidateTurnCount: 1,
        plannedQuestionCount: 1,
        interviewCompletedByLimit: true,
      },
      candidateFeedback: {
        turnBreakdowns: [{
          rubricType: 'role_specific',
          evidenceMode: 'scenario_reasoning',
          frameworkBreakdown: { normalizedScore: 7 },
        }],
      },
    });
    const gapText = report.sections.find((section) => section.id === 'gaps')?.content || '';

    expect(gapText).not.toMatch(/direct past|project example|past experience/i);
    expect(JSON.stringify(report.recommendations)).not.toMatch(/technology question|project example|STARR-style/i);
  });
});
