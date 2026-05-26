import { describe, expect, it } from 'vitest';

import { runReportQaAgent } from '../../../src/services/agents/reportQaAgent.js';
import { buildHumanCalibrationPilot } from '../../../src/services/humanCalibrationService.js';
import { groundCandidateFeedbackClaims } from '../../../src/services/report/claimGroundingService.js';
import { analyzeTurnStructure } from '../../../src/services/report/turnRubricService.js';
import { validateReportOutput } from '../../../src/services/schemaValidationService.js';

describe('report grounding robustness', () => {
  it('flags sparse or unsupported reports instead of passing them as useful feedback', async () => {
    const qa = await runReportQaAgent({
      report: {
        id: 'r1',
        summary: 'The candidate is excellent for this role.',
        sections: [],
        evidenceReferences: [],
        interviewMetrics: { plannedQuestionCount: 5, interviewerQuestionCount: 2, candidateTurnCount: 1 },
        candidateFeedback: {},
        scores: {},
      },
      analysisResult: { decision: { label: 'manual_review' }, explanation: { strengths: ['SQL'] } },
      retrievalBundle: { items: [] },
    });

    expect(qa.passed).toBe(false);
    expect(qa.qualityFlags).toEqual(expect.arrayContaining([
      'missing_sections',
      'missing_interaction_section',
      'missing_candidate_feedback',
      'question_count_mismatch',
    ]));
    expect(qa.consistencyChecks.find((item) => item.rule === 'evidence_presence').passed).toBe(false);
  });

  it('preserves candidate-facing trust fields and STAR breakdowns through report validation', () => {
    const report = validateReportOutput({
      sessionId: 's1',
      summary: 'Grounded summary.',
      sections: [{ id: 'interaction_feedback', title: 'Interaction feedback', content: 'Useful.' }],
      evidenceReferences: [],
      candidateFeedback: {
        overallTakeaway: 'The answer needs more result evidence.',
        scoreBand: 'developing',
        strengthHighlights: [{
          title: 'React exposure',
          explanation: 'The candidate mentioned React work.',
          evidenceLabel: 'supported_by_answer',
          confidenceLevel: 'medium',
          evidenceSources: ['interview_answer'],
          evidenceReason: 'React was explicitly mentioned, but impact was not measurable.',
          feedbackStatus: 'downgraded_feedback',
        }],
        improvementPriorities: [],
        coachingAdvice: [],
        turnBreakdowns: [{
          question: 'Tell me about React.',
          answer: 'I used React in a project and helped improve the frontend.',
          feedback: 'Add the decision and result.',
          scores: { business: 5, logic: 5, evidence: 4 },
          starBreakdown: {
            situation: 'partial',
            task: 'partial',
            action: 'partial',
            result: 'missing',
            mainMissingElement: 'result',
            scoreReason: 'No measurable result was provided.',
          },
          evidenceLabel: 'supported_by_answer',
          confidenceLevel: 'medium',
          evidenceSources: ['interview_answer', 'star_rubric'],
          evidenceReason: 'The answer mentions React but not result or validation method.',
          feedbackStatus: 'downgraded_feedback',
        }],
      },
    });

    expect(report.candidateFeedback.strengthHighlights[0]).toMatchObject({
      evidenceLabel: 'supported_by_answer',
      confidenceLevel: 'medium',
      feedbackStatus: 'downgraded_feedback',
    });
    expect(report.candidateFeedback.turnBreakdowns[0].starBreakdown).toMatchObject({
      result: 'missing',
      mainMissingElement: 'result',
    });
  });

  it('downgrades unsupported candidate-facing claims instead of presenting them as confirmed feedback', () => {
    const grounded = groundCandidateFeedbackClaims({
      candidateFeedback: {
        strengthHighlights: [{
          title: 'Kubernetes leadership',
          explanation: 'The candidate led Kubernetes platform migration work.',
        }],
        improvementPriorities: [{
          title: 'Add result evidence',
          explanation: 'The answer should include React testing outcomes.',
        }],
        coachingAdvice: [],
        turnBreakdowns: [],
      },
      session: {
        transcript: [{ role: 'user', text: 'I used React and wrote component tests for a dashboard.' }],
      },
      analysisResult: {
        parsedCvProfile: { skills: ['React', 'testing'] },
        parsedJdProfile: { requiredSkills: ['React'] },
      },
      retrievalBundle: { items: [] },
    });

    expect(grounded.candidateFeedback.strengthHighlights[0]).toMatchObject({
      confidenceLevel: 'low',
      evidenceLabel: 'needs_user_confirmation',
      needsUserConfirmation: true,
      feedbackStatus: 'needs_confirmation',
    });
    expect(grounded.claimEvidenceDiagnostics).toMatchObject({
      totalClaims: 2,
      downgradedClaims: expect.any(Number),
      needsConfirmationClaims: 1,
    });
    expect(grounded.claimEvidenceReferences[0]).toMatchObject({
      claimSupported: false,
      degraded: true,
    });
  });

  it('summarizes human calibration pilot agreement without requiring live reviewers', () => {
    const pilot = buildHumanCalibrationPilot({
      records: [
        { sampleId: 'strong_star', dimension: 'STAR completeness', systemScore: 4, humanScore: 5 },
        { sampleId: 'unsupported_skill_claim', dimension: 'confidence label accuracy', systemScore: 5, humanScore: 2 },
      ],
    });

    expect(pilot.sampleSet.length).toBeGreaterThanOrEqual(6);
    expect(pilot.completedRatings).toBe(2);
    expect(pilot.agreementRate).toBe(0.5);
    expect(pilot.averageScoreDifference).toBe(2);
    expect(pilot.commonDisagreementPatterns).toEqual(['confidence label accuracy']);
  });

  it('does not apply STAR scoring to self-introduction turns', async () => {
    const structure = analyzeTurnStructure({
      question: 'Hi, thanks for joining. Could you tell me a bit about yourself and what interested you in this Game AI Product Management Intern interview?',
      answer: 'I study information technology, I am interested in AI and games, and I built an AI interview coach web app.',
      metadata: { stage: 'opening', topic: 'self_intro' },
    });

    expect(structure).toMatchObject({
      rubricType: 'self_intro',
      starApplicable: false,
      starBreakdown: null,
    });

    const report = validateReportOutput({
      sessionId: 's1',
      summary: 'Directional report.',
      sections: [{ id: 'interaction_feedback', title: 'Interaction feedback', content: 'Stable.' }],
      candidateFeedback: {
        overallTakeaway: 'The introduction had relevant signals.',
        turnBreakdowns: [{
          question: 'Tell me about yourself.',
          answer: 'I study information technology and I am interested in AI games.',
          feedback: 'Clarify the role link.',
          rubricType: 'self_intro',
          starApplicable: false,
          structureLabel: 'Introduction structure',
          structureBreakdown: structure.structureBreakdown,
          starBreakdown: null,
          scores: { business: 5, logic: 5, evidence: 4 },
          evidenceLabel: 'supported_by_answer',
          confidenceLevel: 'medium',
          feedbackStatus: 'downgraded_feedback',
        }],
      },
    });

    expect(report.candidateFeedback.turnBreakdowns[0]).toMatchObject({
      rubricType: 'self_intro',
      starApplicable: false,
      starBreakdown: null,
    });

    const qa = await runReportQaAgent({
      report,
      analysisResult: {},
      retrievalBundle: { items: [] },
    });

    expect(qa.qualityFlags).not.toContain('self_intro_star_misapplied');
    expect(qa.consistencyChecks.find((item) => item.rule === 'self_intro_not_star_scored').passed).toBe(true);
  });
});
