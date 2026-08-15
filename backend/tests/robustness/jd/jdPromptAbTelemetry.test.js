import { describe, expect, it } from 'vitest';

import {
  attachJdReviewProviderTelemetry,
  buildJdSafeguardTrace,
  classifyJdReparseReasons,
  sanitizeTelemetryError,
  summarizeJdSafeguardReview,
  summarizeProviderResponse,
} from '../../../eval/helpers/jdPromptAbTelemetry.js';

describe('JD prompt A/B safeguard telemetry', () => {
  it('distinguishes high-severity revise from low-severity revise', () => {
    const highSeverityReview = {
      verdict: 'revise',
      issues: [{ field: 'sections.responsibilities', severity: 'high', problem: 'Responsibilities drift', action: 'Re-extract responsibilities.' }],
    };
    expect(classifyJdReparseReasons(highSeverityReview)).toContain('revise_with_high_severity_issue');
    expect(summarizeJdSafeguardReview(highSeverityReview).issues[0]).toEqual({
      field: 'sections.responsibilities',
      severity: 'high',
      problem: 'Responsibilities drift',
      action: 'Re-extract responsibilities.',
    });

    expect(classifyJdReparseReasons({
      verdict: 'revise',
      issues: [{ field: 'sections.qualifications', severity: 'low' }],
    })).toContain('revise_without_high_severity_issue');
  });

  it('redacts secret-shaped issue problem and action text while preserving safe summaries', () => {
    const summary = summarizeJdSafeguardReview({
      verdict: 'revise',
      issues: [{
        field: 'sections.responsibilities',
        severity: 'high',
        problem: 'Investigate the failed request api_key=issue-api-secret.',
        action: 'Rotate Authorization: Bearer issue-bearer-secret password=issue-password-secret.',
      }],
    });

    expect(summary.issues[0].problem).toContain('Investigate the failed request');
    expect(summary.issues[0].action).toContain('Rotate');
    expect(summary.issues[0].problem).not.toContain('issue-api-secret');
    expect(summary.issues[0].action).not.toContain('issue-bearer-secret');
    expect(summary.issues[0].action).not.toContain('issue-password-secret');
  });

  it('records provider fallback and timeout as separate reparse evidence', () => {
    const review = summarizeJdSafeguardReview({
      verdict: 'revise',
      issues: [],
      providerFallbackUsed: true,
      providerTimedOut: true,
      providerError: 'The operation was aborted due to timeout.',
    });

    expect(review).toMatchObject({
      providerFallbackUsed: true,
      providerTimedOut: true,
      providerError: expect.stringMatching(/timeout/i),
    });
    expect(classifyJdReparseReasons(review)).toEqual(expect.arrayContaining([
      'provider_fallback',
      'provider_timeout',
      'revise_without_issue',
    ]));
  });

  it('separates first review, second review, and reparse override metadata', () => {
    const trace = buildJdSafeguardTrace({
      safeguard: {
        parseAttempts: 2,
        finalStatus: 'needs_review_provider_failure',
        repairApplied: true,
        firstReview: {
          verdict: 'revise',
          issues: [{ field: 'sections.responsibilities', severity: 'high' }],
          providerFallbackUsed: false,
        },
        verdict: 'pass',
        issues: [],
        providerFallbackUsed: true,
        providerError: 'fetch failed',
        sectionOverrides: {
          sections: {
            responsibilities: ['Build systems.'],
            mustHaveRequirements: ['Python'],
            niceToHaveRequirements: [],
          },
          metadata: { providerFallbackUsed: true, providerTimedOut: false, providerError: 'fetch failed' },
        },
      },
    });

    expect(trace.firstReview.verdict).toBe('revise');
    expect(trace.firstReviewReparseReasons).toContain('revise_with_high_severity_issue');
    expect(trace.secondReview.verdict).toBe('pass');
    expect(trace.secondReview.providerFallbackUsed).toBe(true);
    expect(trace.secondReview.providerError).toBe('fetch failed');
    expect(trace.finalStatus).toBe('needs_review_provider_failure');
    expect(trace.sectionOverrides).toEqual({
      responsibilities: { count: 1 },
      mustHaveRequirements: { count: 1 },
      niceToHaveRequirements: { count: 0 },
    });
    expect(trace.reparseProviderFallbackUsed).toBe(true);
    expect(trace.reparseProviderError).toBe('fetch failed');
  });

  it('reports whether the raw provider content was valid JSON', () => {
    expect(summarizeProviderResponse('{"verdict":"pass","issues":[]}')).toMatchObject({
      hasContent: true,
      jsonValid: true,
      schemaKind: 'critic',
      schemaValid: true,
      verdict: 'pass',
      verdictValid: true,
      issueCount: 0,
      issueObjectCount: 0,
      issueWithProblemCount: 0,
      schemaIssues: [],
    });
    const incompleteSummary = summarizeProviderResponse('{"verdict":"revise","issues":[{"field":"requirements","severity":"high"}]}');
    expect(incompleteSummary).toMatchObject({
      hasContent: true,
      jsonValid: true,
      schemaKind: 'critic',
      schemaValid: false,
      issueCount: 1,
      issueObjectCount: 1,
      issueWithProblemCount: 0,
      issueWithActionCount: 0,
    });
    expect(incompleteSummary.schemaIssues).toEqual(expect.arrayContaining([
      'issue_missing_problem',
      'issue_missing_action',
    ]));
    expect(summarizeProviderResponse('not json')).toMatchObject({
      hasContent: true,
      jsonValid: false,
      schemaValid: false,
      verdict: null,
      issueCount: null,
    });

    const sanitizedError = sanitizeTelemetryError(
      'request failed api_key=api-secret Authorization: Bearer authorization-secret token=token-secret secret=secret-value password=password-value',
    );
    expect(sanitizedError).toContain('[REDACTED]');
    expect(sanitizedError).not.toContain('api-secret');
    expect(sanitizedError).not.toContain('authorization-secret');
    expect(sanitizedError).not.toContain('token-secret');
    expect(sanitizedError).not.toContain('secret-value');
    expect(sanitizedError).not.toContain('password-value');
    expect(sanitizeTelemetryError('fetch failed')).toBe('fetch failed');
    expect(sanitizeTelemetryError('x'.repeat(300))).toHaveLength(240);
  });

  it('classifies every raw issue contract field without reason or action fallbacks', () => {
    const summary = summarizeProviderResponse(JSON.stringify({
      verdict: 'revise',
      issues: [
        { reason: 'fallback problem', suggestedAction: 'fallback action' },
        { field: 42, severity: 'critical', problem: { text: 'wrong type' }, action: ['wrong type'] },
      ],
    }));

    expect(summary).toMatchObject({
      schemaValid: false,
      issueCount: 2,
      issueObjectCount: 2,
      issueWithFieldCount: 0,
      issueWithSeverityCount: 0,
      issueWithProblemCount: 0,
      issueWithActionCount: 0,
    });
    expect(summary.schemaIssues).toEqual(expect.arrayContaining([
      'issue_missing_field',
      'issue_missing_severity',
      'issue_missing_problem',
      'issue_missing_action',
      'issue_invalid_field',
      'issue_invalid_severity',
      'issue_invalid_problem',
      'issue_invalid_action',
    ]));
  });

  it('separates provider timeout attempts from valid critic JSON attempts', () => {
    const trace = attachJdReviewProviderTelemetry(
      buildJdSafeguardTrace({ safeguard: { parseAttempts: 2, firstReview: { verdict: 'revise' }, verdict: 'pass' } }),
      [
        { flow: 'parse_critic', error: 'The operation was aborted due to timeout', responseBodyRead: false },
        { flow: 'reparse', responseJsonValid: true },
        { flow: 'parse_critic', responseJsonValid: true, providerResponse: { schemaValid: true } },
      ],
    );

    expect(trace.firstReviewProviderCalls).toMatchObject({
      attempts: 1,
      responseBodyReadErrorCount: 1,
      timeoutCount: 1,
    });
    expect(trace.secondReviewProviderCalls).toMatchObject({
      attempts: 1,
      responseJsonValidCount: 1,
      schemaValidCount: 1,
      timeoutCount: 0,
    });
  });
});
