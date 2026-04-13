import { describe, expect, it } from 'vitest';
import { buildNormalizedCvProfile } from '../../src/services/cv/cvProfileContractBuilder.js';
import { buildRequirementChecks, calculateScoreBreakdown } from '../../src/services/match/matchScoringService.js';
import { buildMatchAnalysisContract } from '../../src/services/match/matchAnalysisContractBuilder.js';

describe('match flow', () => {
  it('converts CV evidence and JD requirements into a grounded match contract', () => {
    const cvProfile = buildNormalizedCvProfile({
      skills: ['Node.js', 'SQL', 'Docker'],
      projects: [{ title: 'Backend API', description: 'Built and deployed a Node.js API to production', techStack: ['Node.js', 'SQL', 'Docker'] }],
      workHistory: [{ role: 'Engineer', responsibilities: 'Owned backend delivery and reduced support tickets by 20%' }],
      achievements: ['Reduced support tickets by 20%'],
    });

    const requirementChecks = buildRequirementChecks([
      { label: 'Node.js production experience', type: 'hard', importance: 'high' },
      { label: 'Docker', type: 'soft', importance: 'medium' },
      { label: 'AWS', type: 'soft', importance: 'medium' },
    ], '', cvProfile.evidenceProfile);

    const scoreBreakdown = calculateScoreBreakdown({
      rubric: { weights: { overall: { macro: 0.45, micro: 0.35, requirements: 0.2 } } },
      macroScores: [{ score: 72, weight: 1 }],
      microScores: [{ score: 76, weight: 1 }],
      requirementChecks,
    });

    const contract = buildMatchAnalysisContract({
      overallScore: scoreBreakdown.overallScore,
      decision: { status: 'partial_match' },
      requirementChecks: requirementChecks.map((item) => ({ required: item.type === 'hard', passed: item.status === 'met', requirement: item.label })),
      explanation: { strengths: ['Node.js production evidence'], gaps: ['AWS depth'], risks: ['Cloud evidence remains limited'] },
      matchingDetails: { questionPlanHints: { priorityTopics: ['AWS', 'system_design'], followUpTargets: ['AWS'], roleCanonical: 'backend_engineer' } },
    });

    expect(contract.missingRequiredSkills).not.toContain('Node.js production experience');
    expect(contract.validationTargets).toContain('AWS');
  });
});
