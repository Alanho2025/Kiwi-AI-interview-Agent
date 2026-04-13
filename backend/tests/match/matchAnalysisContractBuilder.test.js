import { describe, expect, it } from 'vitest';
import { buildMatchAnalysisContract } from '../../src/services/match/matchAnalysisContractBuilder.js';

describe('buildMatchAnalysisContract', () => {
  it('derives validation targets and missing required skills from match output', () => {
    const analysis = buildMatchAnalysisContract({
      overallScore: 72,
      decision: { status: 'partial_match' },
      requirementChecks: [
        { required: true, passed: false, requirement: 'C# commercial experience' },
        { required: false, passed: false, requirement: 'Azure' },
      ],
      explanation: {
        strengths: ['Strong Python and SQL evidence'],
        gaps: ['Limited direct C# delivery proof'],
        risks: ['Commercial proof for C# remains weak'],
      },
      matchingDetails: {
        questionPlanHints: {
          priorityTopics: ['C#', 'system design'],
          followUpTargets: ['C# commercial experience'],
          roleCanonical: 'software_engineer',
        },
      },
    });

    expect(analysis.missingRequiredSkills).toContain('C# commercial experience');
    expect(analysis.validationTargets).toContain('C# commercial experience');
    expect(analysis.questionPlanHints.priorityTopics).toContain('system design');
  });
});
