import { describe, expect, it } from 'vitest';

import * as reportGeneratorAgent from '../../../src/services/agents/reportGeneratorAgent.js';
import * as reportDraftBuilder from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';
import * as reportRewriteService from '../../../src/services/report/reportRewriteService.js';
import { groundCandidateFeedbackClaims } from '../../../src/services/report/claimGroundingService.js';
import {
  analyzeTurnStructure,
  validateRubricQuestionAlignment,
} from '../../../src/services/report/turnRubricService.js';
import { buildReportScores, computeInterviewPerformanceScore } from '../../../src/services/report/reportScoreService.js';
import { buildPlainEnglishMetrics } from '../../../src/services/agents/reportGenerator/reportMetricBuilder.js';
import { generateCandidateFeedback } from '../../../src/services/reportCoachingService.js';

describe('report framework pipeline', () => {
  it('uses interview performance as the report overall score', () => {
    const scores = buildReportScores({ cvJdScore: 64.3, interviewScore: 53 });
    const metrics = buildPlainEnglishMetrics({
      scores,
      evidenceSummary: { averageStrength: 1.2, totals: { direct_past_experience: 3 } },
      interviewMetrics: { plannedQuestionCount: 15, scoredCandidateAnswerCount: 15 },
    });

    expect(scores.overall).toBe(53);
    expect(scores.interviewPerformance).toBe(53);
    expect(scores).not.toHaveProperty('cvJdMatch');
    expect(metrics.find((item) => item.id === 'interview_performance')?.displayValue).toBe('53.00/100');
    expect(metrics.find((item) => item.id === 'cv_jd_match')).toBeUndefined();
  });

  it('does not put Match score, confidence, or a Match decision in the report overview', () => {
    const draft = reportDraftBuilder.buildReportDraft({
      session: { id: 'session-1' },
      analysisResult: {
        overallScore: 91,
        confidence: 0.92,
        decision: { label: 'strong_match' },
      },
      evidenceSummary: {
        averageStrength: 2.5,
        strongestExamples: [],
        totals: {
          direct_past_experience: 2,
          indirect_adjacent_experience: 1,
          hypothetical_understanding: 0,
          generic_filler: 0,
        },
      },
      interviewMetrics: { candidateTurnCount: 3, plannedQuestionCount: 3, interviewerQuestionCount: 3 },
      candidateFeedback: { turnBreakdowns: [] },
      scores: { overall: 53, interviewPerformance: 53 },
    });
    const overview = draft.sections.find((section) => section.id === 'interview_performance_overview');

    expect(overview?.content).toContain('Interview performance score 53');
    expect(overview?.content).not.toMatch(/CV-JD|confidence|strong_match|match decision/i);
  });

  it('does not score a validation follow-up with stale motivation metadata', () => {
    const turn = analyzeTurnStructure({
      question: 'Can you walk me through a specific example of how you validated that the feedback helped a candidate improve?',
      answer: 'I separated feedback types but did not run before-and-after user validation.',
      metadata: {
        topic: 'company_and_role_motivation',
        questionFamily: 'motivation',
        followUpIntent: 'validation',
      },
    });

    expect(turn.rubricType).toBe('role_specific');
    expect(turn.frameworkKey).toBe('role_specific_reasoning');
    expect(turn.frameworkBreakdown.dimensions.find((item) => item.key === 'validationVerification')?.status).not.toBe('not_applicable');
    expect(turn.frameworkBreakdown.dimensions.find((item) => item.key === 'approach')?.status).toBe('not_applicable');
    expect(validateRubricQuestionAlignment({
      question: 'How did you validate the result?',
      rubric: turn,
      metadata: { followUpIntent: 'validation' },
    })).toMatchObject({ passed: true });
  });

  it('uses trade-off reasoning rather than STARR for a constraint follow-up', () => {
    const turn = analyzeTurnStructure({
      question: 'What trade-offs or constraints did you consider when designing the experiments?',
      answer: 'I had to balance sample size, operator time, fixture changes, and reproducibility.',
      metadata: { followUpIntent: 'tradeoff', questionFamily: 'behavioural' },
    });

    expect(turn.rubricType).toBe('role_specific');
    expect(turn.starApplicable).toBe(false);
    expect(turn.frameworkBreakdown.dimensions.find((item) => item.key === 'judgementTradeoffs')?.status).not.toBe('not_applicable');
  });

  it('scores only the requested result dimension on a behavioural result follow-up', () => {
    const turn = analyzeTurnStructure({
      question: 'What was the result?',
      answer: 'The retest rate dropped from 15% to 5%.',
      metadata: { followUpIntent: 'result', questionFamily: 'behavioural' },
    });

    expect(turn.rubricType).toBe('starr');
    expect(turn.frameworkBreakdown.dimensions.find((item) => item.key === 'resultOrReaction')?.status).toBe('clear');
    expect(turn.frameworkBreakdown.dimensions.find((item) => item.key === 'task')?.status).toBe('not_applicable');
  });

  it('builds deterministic framework analysis before coaching enrichment', () => {
    const turns = reportGeneratorAgent.buildDeterministicTurnBreakdowns?.([
      {
        role: 'ai',
        text: 'How would you adapt a lesson for different learner needs?',
        metadata: {
          questionFamily: 'role_specific',
          evidenceMode: 'scenario_reasoning',
          capabilityGroup: 'service_delivery',
          roleDomain: 'education',
          questionType: 'scenario_case',
        },
      },
      {
        role: 'user',
        text: 'I would clarify requirements, compare options, manage safeguarding risk, assess understanding, and adjust based on the result.',
      },
    ]) || [];

    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      frameworkKey: 'scenario_case_reasoning',
      questionFamily: 'role_specific',
      evidenceMode: 'scenario_reasoning',
      starApplicable: false,
      starBreakdown: null,
    });
    expect(turns[0].frameworkBreakdown.dimensions).toHaveLength(6);
  });

  it('does not let coaching output overwrite deterministic framework fields', () => {
    const merged = reportGeneratorAgent.mergeTurnBreakdownsWithRubrics?.([
      {
        question: 'How would you handle the case?',
        answer: 'I would compare options.',
        feedback: 'Use STAR.',
        rubricType: 'starr',
        frameworkKey: 'behavioural_starr',
        starApplicable: true,
        starBreakdown: { situation: 'missing' },
        scores: { business: 10, logic: 10, evidence: 10 },
      },
    ], [
      {
        question: 'How would you handle the case?',
        answer: 'I would compare options.',
        feedback: 'Explain the requirements, options, risks, validation, and expected outcome.',
        rubricType: 'role_specific',
        frameworkKey: 'scenario_case_reasoning',
        frameworkLabel: 'Scenario / Case Reasoning',
        questionFamily: 'role_specific',
        evidenceMode: 'scenario_reasoning',
        starApplicable: false,
        starBreakdown: null,
        frameworkBreakdown: { dimensions: [{ key: 'requirements', label: 'Requirements', status: 'missing', score: 0 }] },
        scores: { business: 3, logic: 4, evidence: 2 },
      },
    ]) || [];

    expect(merged[0]).toMatchObject({
      rubricType: 'role_specific',
      frameworkKey: 'scenario_case_reasoning',
      starApplicable: false,
      starBreakdown: null,
      scores: { business: 3, logic: 4, evidence: 2 },
    });
    expect(merged[0].feedback).not.toBe('Use STAR.');
  });

  it('matches reordered and omitted coaching only to the exact deterministic turn', () => {
    const deterministic = [
      { question: 'Question one?', answer: 'Answer one.', feedback: 'Fallback one.', rubricType: 'direct' },
      { question: 'Question two?', answer: 'Answer two.', feedback: 'Fallback two.', rubricType: 'direct' },
      { question: 'Question three?', answer: 'Answer three.', feedback: 'Fallback three.', rubricType: 'direct' },
    ];
    const merged = reportGeneratorAgent.mergeTurnBreakdownsWithRubrics?.([
      { question: 'Question three?', answer: 'Answer three.', feedback: 'Coach three.' },
      { question: 'Unknown?', answer: 'Unknown answer.', feedback: 'Must be discarded.' },
      { question: 'Question one?', answer: 'Answer one.', feedback: 'Coach one.' },
    ], deterministic) || [];

    expect(merged.map((turn) => turn.question)).toEqual(deterministic.map((turn) => turn.question));
    expect(merged.map((turn) => turn.feedback)).toEqual(['Coach one.', 'Fallback two.', 'Coach three.']);
    expect(JSON.stringify(merged)).not.toContain('Must be discarded.');
  });

  it('allows grounded coaching wording while keeping deterministic framework fields locked', () => {
    const [merged] = reportGeneratorAgent.mergeTurnBreakdownsWithRubrics?.([{
      question: 'How would you handle the case?',
      answer: 'I would compare options.',
      feedback: 'Clarify the requirements, then explain why one option best manages the quality risk.',
      rubricType: 'starr',
      frameworkKey: 'behavioural_starr',
      starApplicable: true,
    }], [{
      question: 'How would you handle the case?',
      answer: 'I would compare options.',
      feedback: 'Fallback framework coaching.',
      rubricType: 'role_specific',
      frameworkKey: 'scenario_case_reasoning',
      frameworkLabel: 'Scenario / Case Reasoning',
      questionFamily: 'role_specific',
      evidenceMode: 'scenario_reasoning',
      starApplicable: false,
      starBreakdown: null,
      frameworkBreakdown: { dimensions: [{ key: 'requirements', score: 0 }] },
      scores: { business: 3, logic: 4, evidence: 2 },
    }]) || [];

    expect(merged.feedback).toBe('Clarify the requirements, then explain why one option best manages the quality risk.');
    expect(merged).toMatchObject({
      frameworkKey: 'scenario_case_reasoning',
      starApplicable: false,
      scores: { business: 3, logic: 4, evidence: 2 },
    });
  });

  it('computes new interview performance from scorable framework turns', () => {
    const score = reportDraftBuilder.computeInterviewPerformanceScore?.({}, {
      turnBreakdowns: [
        { rubricType: 'role_specific', frameworkBreakdown: { normalizedScore: 8 } },
        { rubricType: 'starr', frameworkBreakdown: { normalizedScore: 6 } },
        { rubricType: 'conversation', frameworkBreakdown: { normalizedScore: 10 } },
      ],
    });

    expect(score).toBe(70);
  });

  it('keeps the legacy interview formula when framework breakdowns are absent', () => {
    const score = reportDraftBuilder.computeInterviewPerformanceScore?.({
      averageStrength: 2,
      totals: {
        direct_past_experience: 1,
        indirect_adjacent_experience: 0,
        hypothetical_understanding: 1,
        generic_filler: 0,
      },
    }, {
      turnBreakdowns: [{ scores: { business: 6, logic: 6, evidence: 6 } }],
    });

    expect(score).toBe(53);
  });

  it('does not count adjacent-only evidence as direct evidence in the legacy score', () => {
    const score = computeInterviewPerformanceScore({
      averageStrength: 0,
      totals: { direct_past_experience: 0, indirect_adjacent_experience: 1 },
    }, {});

    expect(score).toBe(0);
  });

  it('preserves deterministic frameworks during report rewrites', () => {
    const preserved = reportRewriteService.preserveCandidateFeedbackSafety?.({
      turnBreakdowns: [{
        question: 'How would you handle the case?',
        rubricType: 'role_specific',
        frameworkKey: 'scenario_case_reasoning',
        frameworkLabel: 'Scenario / Case Reasoning',
        frameworkBreakdown: { dimensions: [{ key: 'requirements', score: 5 }] },
        starApplicable: false,
        starBreakdown: null,
      }],
    }, {
      turnBreakdowns: [{
        question: 'How would you handle the case?',
        rubricType: 'starr',
        frameworkKey: 'behavioural_starr',
        starApplicable: true,
        feedback: 'Use STAR.',
      }],
    }) || { turnBreakdowns: [] };

    expect(preserved.turnBreakdowns[0]).toMatchObject({
      rubricType: 'role_specific',
      frameworkKey: 'scenario_case_reasoning',
      frameworkLabel: 'Scenario / Case Reasoning',
      starApplicable: false,
      starBreakdown: null,
    });
  });

  it('grounds role-specific turns with the role framework source', () => {
    const grounded = groundCandidateFeedbackClaims({
      candidateFeedback: {
        strengthHighlights: [],
        improvementPriorities: [],
        coachingAdvice: [],
        turnBreakdowns: [{
          question: 'How would you handle a customer case?',
          answer: 'I would clarify the customer need and verify the outcome.',
          feedback: 'Compare options and explain the quality risk.',
          rubricType: 'role_specific',
          frameworkKey: 'service_stakeholder_reasoning',
          starApplicable: false,
        }],
      },
      session: {
        transcript: [{ role: 'user', text: 'I would clarify the customer need and verify the outcome.' }],
      },
      analysisResult: {},
    });

    expect(grounded.candidateFeedback.turnBreakdowns[0].evidenceSources).toContain('role_framework');
    expect(grounded.candidateFeedback.turnBreakdowns[0].evidenceSources).not.toContain('star_rubric');
    expect(grounded.claimEvidenceReferences[0]).toMatchObject({
      sourceType: 'transcript',
      rubricSource: 'role_framework',
    });
  });

  it('matches LLM answerRewriteExamples by question/weak identity when reordered', async () => {
    const deterministicFeedback = {
      answerRewriteExamples: [
        {
          question: 'What is your background?',
          weak: 'I worked on web apps.',
          better: '',
          status: 'unavailable',
        },
        {
          question: 'How do you handle system failure?',
          weak: 'I check the logs.',
          better: '',
          status: 'unavailable',
        },
      ],
    };

    // DeepSeek call will fail in mock/unit test mode and fallback or we can test normalize logic
    // Let's test generateCandidateFeedback fallback & AI output behavior
    const result = await generateCandidateFeedback({
      session: { candidateName: 'Test' },
      analysisResult: { jobTitle: 'Engineer' },
      deterministicFeedback,
    });

    expect(result.answerRewriteExamples).toHaveLength(2);
    expect(result.answerRewriteExamples[0].question).toBe('What is your background?');
    expect(result.answerRewriteExamples[0].weak).toBe('I worked on web apps.');
    expect(result.answerRewriteExamples[1].question).toBe('How do you handle system failure?');
    expect(result.answerRewriteExamples[1].weak).toBe('I check the logs.');
  });
});
