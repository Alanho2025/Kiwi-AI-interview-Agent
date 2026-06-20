import { describe, expect, it } from 'vitest';

import { validateReportOutput } from '../../src/services/schemaValidationService.js';

describe('report v5 framework schema', () => {
  it('preserves role-specific framework fields through validation', () => {
    const report = validateReportOutput({
      schemaVersion: 'v5',
      candidateFeedback: {
        turnBreakdowns: [{
          question: 'How would you handle the case?',
          answer: 'I would compare options and verify the result.',
          feedback: 'Explain the risk.',
          rubricType: 'role_specific',
          frameworkKey: 'scenario_case_reasoning',
          frameworkLabel: 'Scenario / Case Reasoning',
          questionFamily: 'role_specific',
          evidenceMode: 'scenario_reasoning',
          capabilityGroup: 'service_delivery',
          roleDomain: 'education',
          starApplicable: false,
          starBreakdown: null,
          frameworkBreakdown: {
            dimensions: [{
              key: 'requirements',
              label: 'Requirements',
              status: 'partial',
              score: 5,
              reason: 'Requirements were partly explained.',
            }],
            mainGapKey: 'riskQualityEthics',
            summary: 'Scenario structure and evidence.',
            totalScore: 5,
            maxScore: 10,
            normalizedScore: 5,
          },
        }],
      },
    });

    expect(report.candidateFeedback.turnBreakdowns[0]).toMatchObject({
      frameworkKey: 'scenario_case_reasoning',
      frameworkLabel: 'Scenario / Case Reasoning',
      questionFamily: 'role_specific',
      evidenceMode: 'scenario_reasoning',
      capabilityGroup: 'service_delivery',
      roleDomain: 'education',
      frameworkBreakdown: {
        mainGapKey: 'riskQualityEthics',
        normalizedScore: 5,
      },
    });
  });

  it('preserves the full behavioural STARR breakdown', () => {
    const report = validateReportOutput({
      schemaVersion: 'v5',
      candidateFeedback: {
        turnBreakdowns: [{
          question: 'Tell me about a conflict.',
          answer: 'I resolved it and reflected on the lesson.',
          feedback: 'Add more detail.',
          rubricType: 'starr',
          frameworkKey: 'behavioural_starr',
          starApplicable: true,
          starBreakdown: {
            situation: 'clear',
            task: 'partial',
            action: 'clear',
            resultOrReaction: 'partial',
            reflection: 'clear',
            mainMissingElement: 'task',
          },
        }],
      },
    });

    expect(report.candidateFeedback.turnBreakdowns[0].starBreakdown).toMatchObject({
      situation: 'clear',
      task: 'partial',
      action: 'clear',
      resultOrReaction: 'partial',
      reflection: 'clear',
    });
  });
});
