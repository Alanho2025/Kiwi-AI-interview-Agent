import { describe, expect, it } from 'vitest';

import * as reportGeneratorAgent from '../../../src/services/agents/reportGeneratorAgent.js';
import * as reportDraftBuilder from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';
import * as reportRewriteService from '../../../src/services/report/reportRewriteService.js';
import { groundCandidateFeedbackClaims } from '../../../src/services/report/claimGroundingService.js';

describe('report framework pipeline', () => {
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
});
