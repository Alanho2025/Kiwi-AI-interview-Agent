import { describe, expect, it } from 'vitest';
import { buildEvidenceBundle } from '../../src/services/aiControl/evidenceBundleService.js';

describe('buildEvidenceBundle', () => {
  it('uses normalized contracts and keeps retrieval attribution', () => {
    const bundle = buildEvidenceBundle({
      session: {
        targetRole: 'Software Engineer',
        analysisResult: {
          parsedJdProfile: {
            title: 'Software Engineer',
            technicalSkillRequirements: ['Node.js'],
            softSkillRequirements: ['communication'],
            interviewTargets: ['API design'],
          },
          parsedCvProfile: {
            candidateName: 'Alan',
            skills: [{ label: 'Node.js' }],
            projects: [{ title: 'Forkcast', description: 'Built API' }],
            evidenceProfile: { technicalDepthEvidence: ['Built API endpoints'] },
          },
          requirementChecks: [
            { required: true, passed: false, requirement: 'System design' },
          ],
          explanation: {
            strengths: ['Strong Node.js evidence'],
            gaps: ['System design proof is limited'],
            risks: ['Commercial system design proof is missing'],
          },
          matchingDetails: {
            questionPlanHints: {
              priorityTopics: ['system design'],
              followUpTargets: ['system design'],
            },
          },
        },
        transcript: [{ role: 'user', text: 'I built an API for students.' }],
      },
      retrievalBundle: {
        objective: 'FIND_ROLE_SPECIFIC_QUESTION',
        sourceQuality: 'strong',
        correctiveRetryUsed: true,
        items: [{ sourceType: 'question_bank', sourceId: 'q1', text: 'Tell me about API design.', metadata: {}, scores: { fusion: 0.6 } }],
      },
    });

    expect(bundle.normalizedJdRubric.requiredSkills).toContain('Node.js');
    expect(bundle.normalizedCvProfile.skills).toContain('Node.js');
    expect(bundle.matchAnalysis.validationTargets).toContain('system design');
    expect(bundle.sourceAttribution.retrieval.correctiveRetryUsed).toBe(true);
  });
});
