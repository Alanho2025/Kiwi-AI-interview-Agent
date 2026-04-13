import { describe, expect, it } from 'vitest';
import { buildNormalizedCvProfile } from '../../../src/services/cv/cvProfileContractBuilder.js';
import { buildRequirementChecks, calculateScoreBreakdown } from '../../../src/services/match/matchScoringService.js';
import { buildMatchAnalysisContract } from '../../../src/services/match/matchAnalysisContractBuilder.js';

describe('CV-JD match scenarios', () => {
  it('keeps a strong fit above a weak fit when direct evidence exists', () => {
    const strongCv = buildNormalizedCvProfile({
      skills: ['Node.js', 'SQL', 'AWS'],
      projects: [{ title: 'Production API', description: 'Built and deployed Node.js APIs to production' }],
      workHistory: [{ role: 'Backend Engineer', responsibilities: 'Owned API delivery and improved latency by 30%' }],
      achievements: ['Reduced latency by 30%'],
      evidenceProfile: { quantifiedEvidence: ['30%'], deliveryEvidence: ['deployed to production'], technicalDepthEvidence: ['implemented API architecture'] },
    });

    const weakCv = buildNormalizedCvProfile({
      skills: ['HTML', 'CSS'],
      projects: [{ title: 'Student Website', description: 'Built a basic web page' }],
      workHistory: [],
      achievements: [],
    });

    const requirements = [
      { label: 'Node.js production experience', type: 'hard', importance: 'high' },
      { label: 'SQL', type: 'hard', importance: 'medium' },
      { label: 'AWS', type: 'soft', importance: 'medium' },
    ];

    const strongChecks = buildRequirementChecks(requirements, '', strongCv.evidenceProfile);
    const weakChecks = buildRequirementChecks(requirements, '', weakCv.evidenceProfile);

    const strongBreakdown = calculateScoreBreakdown({ rubric: { weights: { overall: { macro: 0.45, micro: 0.35, requirements: 0.2 } } }, macroScores: [{ score: 80, weight: 1 }], microScores: [{ score: 78, weight: 1 }], requirementChecks: strongChecks });
    const weakBreakdown = calculateScoreBreakdown({ rubric: { weights: { overall: { macro: 0.45, micro: 0.35, requirements: 0.2 } } }, macroScores: [{ score: 35, weight: 1 }], microScores: [{ score: 30, weight: 1 }], requirementChecks: weakChecks });

    expect(strongBreakdown.overallScore).toBeGreaterThan(weakBreakdown.overallScore);

    const contract = buildMatchAnalysisContract({
      overallScore: strongBreakdown.overallScore,
      decision: { status: 'partial_match' },
      requirementChecks: strongChecks.map((item) => ({ required: item.type === 'hard', passed: item.status === 'met', requirement: item.label })),
      explanation: { strengths: ['Node.js production evidence'], gaps: ['System design not yet proven'], risks: ['Cloud depth still needs probing'] },
      matchingDetails: { questionPlanHints: { priorityTopics: ['system_design'], followUpTargets: ['AWS'], roleCanonical: 'backend_engineer' } },
    });

    expect(contract.questionPlanHints.priorityTopics).toContain('system_design');
  });
});
