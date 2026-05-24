import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/company/urlSafetyService.js', () => ({
  normalizeSafeHttpUrl: (value = '') => {
    try {
      const parsed = new URL(String(value || '').trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      parsed.hash = '';
      return parsed;
    } catch {
      return null;
    }
  },
  isPublicHttpUrl: vi.fn(async () => true),
}));

vi.mock('../../../src/services/company/serperSearchService.js', () => ({
  searchWithSerper: vi.fn(async () => ({
    ok: true,
    results: [
      {
        title: 'Robert Half Technology official website',
        url: 'https://www.roberthalf.com/nz/en/about',
        snippet: 'Robert Half Technology careers, culture, values, and company information.',
      },
    ],
  })),
}));

import { resolveCompanyWebsite } from '../../../src/services/company/companyWebsiteResolverService.js';
import { searchWithSerper } from '../../../src/services/company/serperSearchService.js';
import { buildReportDraft } from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';

const buildCompanyMotivationReportSection = (companyMotivationFit) => {
  const report = buildReportDraft({
    session: { id: 'session-1', totalQuestions: 1 },
    analysisResult: {
      candidateName: 'Candidate',
      jobTitle: 'Full Stack Developer',
      overallScore: 70,
      confidence: 0.8,
      decision: { label: 'manual_review' },
      explanation: { strengths: [], gaps: [] },
      scoreBreakdown: {},
      evidenceMap: [],
    },
    interviewPlan: { interviewFocus: [] },
    evidenceSummary: {
      totals: {
        direct_past_experience: 1,
        indirect_adjacent_experience: 0,
        hypothetical_understanding: 0,
        generic_filler: 0,
      },
      averageStrength: 2,
      strongestExamples: [],
    },
    interviewMetrics: {
      candidateTurnCount: 1,
      interviewerQuestionCount: 1,
      plannedQuestionCount: 1,
      extraAiTurnCount: 0,
      interviewCompletedByLimit: true,
    },
    companyMotivationFit,
  });

  return report.sections.find((section) => section.id === 'company_motivation_fit');
};

describe('company research availability report wording', () => {
  it('uses company-specific availability when a company website URL is provided', async () => {
    const resolved = await resolveCompanyWebsite({
      manualWebsiteUrl: 'https://www.roberthalf.com/nz/en',
    });
    const section = buildCompanyMotivationReportSection({
      source: resolved.source,
      score: 7,
      summary: 'The candidate showed interest in AI and full-stack work.',
      suggestedRewrite: 'Prepare one company fact, one role responsibility, and one personal project link.',
    });

    expect(resolved).toEqual(expect.objectContaining({
      websiteUrl: 'https://www.roberthalf.com/nz/en',
      source: 'manual',
    }));
    expect(searchWithSerper).not.toHaveBeenCalled();
    expect(section.content).toContain('Company research availability: Company-specific sources were available and used for this section.');
  });

  it('uses company-specific availability when Serper resolves a company name', async () => {
    vi.mocked(searchWithSerper).mockClear();

    const resolved = await resolveCompanyWebsite({
      companyName: 'Robert Half Technology',
      location: 'New Zealand',
    });
    const section = buildCompanyMotivationReportSection({
      source: resolved.source === 'serper' ? 'official_website' : resolved.source,
      score: 7,
      summary: 'The candidate showed interest in AI and full-stack work.',
      suggestedRewrite: 'Prepare one company fact, one role responsibility, and one personal project link.',
    });

    expect(searchWithSerper).toHaveBeenCalled();
    expect(resolved).toEqual(expect.objectContaining({
      websiteUrl: 'https://www.roberthalf.com',
      source: 'serper',
    }));
    expect(section.content).toContain('Company research availability: Company-specific sources were available and used for this section.');
  });
});
