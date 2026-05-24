import { describe, expect, it } from 'vitest';
import { scoreSearchResult } from '../../../src/services/company/companyWebsiteResolverService.js';
import { buildCompanyValuesJdFingerprint } from '../../../src/services/company/companyValuesFingerprintService.js';
import { findMotivationAnswer } from '../../../src/services/company/companyMotivationFitService.js';
import { buildQuestionPoolFromAnalysis } from '../../../src/services/session/sessionShared.js';
import { validateReportOutput } from '../../../src/services/schemaValidationService.js';

describe('company values and motivation fit robustness', () => {
  it('scores official company sites above job boards', () => {
    const official = scoreSearchResult({
      companyName: 'Luma Analytics',
      result: {
        title: 'Luma Analytics official website',
        snippet: 'Careers, values, and company culture',
        url: 'https://luma-analytics.co.nz/about',
      },
    });
    const jobBoard = scoreSearchResult({
      companyName: 'Luma Analytics',
      result: {
        title: 'Luma Analytics jobs',
        snippet: 'Find roles on SEEK',
        url: 'https://www.seek.co.nz/Luma-Analytics-jobs',
      },
    });

    expect(official).toBeGreaterThan(jobBoard);
    expect(jobBoard).toBeLessThan(0.65);
  });

  it('builds a stable JD fingerprint from raw JD and reviewed overview fields', () => {
    const fingerprint = buildCompanyValuesJdFingerprint({
      rawJD: 'Role: Data Engineer\nCompany: Luma Analytics',
      jdRubric: {
        jobOverview: {
          title: 'Data Engineer',
          companyName: 'Luma Analytics',
          location: 'Auckland',
        },
      },
    });
    const sameFingerprint = buildCompanyValuesJdFingerprint({
      rawJD: 'Role:   Data Engineer\nCompany: Luma Analytics',
      jdRubric: {
        jobOverview: {
          title: 'Data Engineer',
          companyName: 'Luma Analytics',
          location: 'Auckland',
        },
      },
    });

    expect(fingerprint).toHaveLength(64);
    expect(sameFingerprint).toBe(fingerprint);
  });

  it('adds the company and role motivation question early in the plan', () => {
    const pool = buildQuestionPoolFromAnalysis({
      jobTitle: 'Data Engineer',
      parsedJdProfile: {
        jobOverview: { companyName: 'Luma Analytics' },
      },
      matchingDetails: {
        questionPlanHints: {
          mustProbeSkills: ['Python'],
          mustProbeBehavioural: ['teamwork'],
        },
      },
    }, { seniorityLevel: 'Junior/Grad', focusArea: 'Combined', questionLimit: 8 });

    expect(pool[0].text).toContain('with Luma Analytics');
    expect(pool[1]).toEqual(expect.objectContaining({
      type: 'company_motivation',
      topic: 'company_and_role_motivation',
      text: 'What attracted you to this company and role?',
    }));
  });

  it('finds the motivation answer from question metadata', () => {
    const result = findMotivationAnswer({
      transcript: [
        { role: 'ai', text: 'What attracted you to this company and role?', metadata: { questionType: 'company_motivation' } },
        { role: 'user', text: 'I like the company mission and the role is close to my data engineering projects.' },
      ],
    });

    expect(result).toEqual({
      answer: 'I like the company mission and the role is close to my data engineering projects.',
      evidenceStrength: 'direct',
    });
  });

  it('preserves company motivation fit in the report schema', () => {
    const report = validateReportOutput({
      sessionId: 'session-1',
      companyMotivationFit: {
        source: 'general_fallback',
        score: 6,
        summary: 'The answer showed role interest but little company research.',
        matchedValues: [{ value: 'Role motivation', candidateQuote: 'the role fits my projects', comment: 'Specific role signal.' }],
        missingValues: [{ value: 'Company research signal', whyItMatters: 'Shows preparation.', suggestion: 'Name one company fact.' }],
        candidateResearchSignal: { score: 2, comment: 'Limited company detail.' },
        roleMotivationSignal: { score: 7, comment: 'Clear role interest.' },
        suggestedRewrite: 'I was attracted to this company because...',
        fallbackReason: 'company_values_not_available_at_report_generation',
        evidenceStrength: 'direct',
      },
    });

    expect(report.companyMotivationFit.summary).toContain('role interest');
    expect(report.companyMotivationFit.missingValues[0].value).toBe('Company research signal');
  });
});
