import crypto from 'node:crypto';
import { buildCompanyUnderstandingDetails } from './companyUnderstandingDetailService.js';
import { buildRoleIntent } from './roleIntentDecoderService.js';

const UNTRUSTED_INSTRUCTION_PATTERN = /\b(ignore (?:all |any |the )?(?:previous|prior|system) instructions?|system prompt|developer message|mark every candidate|override (?:the )?(?:score|match|rules?))\b/i;
const KEYWORD_STOP_WORDS = new Set([
  'about',
  'analytics',
  'brand',
  'company',
  'customer',
  'customers',
  'decision',
  'decisions',
  'helps',
  'luma',
  'makes',
  'operations',
  'planning',
  'teams',
  'trusted',
]);

const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stableId = (prefix, ...parts) => {
  const digest = crypto.createHash('sha256').update(parts.map(normalizeText).join('\n')).digest('hex').slice(0, 18);
  return `${prefix}:${digest}`;
};

const normalizeHttpUrl = (value = '') => {
  try {
    const parsed = new URL(normalizeText(value));
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const splitContextStatements = (value = '') => String(value || '')
  .split(/\n+|(?<=[.!?])\s+/)
  .map((item) => normalizeText(item).replace(/[.!?]+$/g, ''))
  .filter(Boolean);

const sanitizeManualContext = (value = '') => {
  const statements = splitContextStatements(value);
  return {
    statements: statements.filter((statement) => !UNTRUSTED_INSTRUCTION_PATTERN.test(statement)).slice(0, 8),
    untrustedInstructionDetected: statements.some((statement) => UNTRUSTED_INSTRUCTION_PATTERN.test(statement)),
  };
};

const buildSourceFact = ({
  statement,
  sourceLabel,
  sourceType,
  confidence,
  sourceConfidence,
  reviewConfidence = 'unreviewed',
  claimStatus = 'needs_confirmation',
  uncertainty,
  section,
  url = null,
}) => ({
  id: stableId('company-fact', sourceType, statement),
  statement,
  sourceLabel,
  sourceType,
  confidence,
  sourceConfidence,
  reviewConfidence,
  claimStatus,
  uncertainty,
  sourceTrace: {
    sourceType,
    section,
    rawSnippet: statement,
    ...(url ? { url } : {}),
  },
});

const getWebsiteEvidenceSnippets = (companyWebsiteEvidence = null) => (
  companyWebsiteEvidence?.fetchStatus === 'fetched'
    ? (companyWebsiteEvidence.pages || []).flatMap((page) => (
        (page.snippets || []).map((snippet) => ({
          snippet,
          url: page.url || companyWebsiteEvidence.normalizedUrl || null,
        }))
      ))
    : []
);

const hasGroundedWebsiteEvidence = (companyWebsiteEvidence = null) => getWebsiteEvidenceSnippets(companyWebsiteEvidence).length > 0;

const extractConflictKeywords = (text = '') => [...new Set(
  String(text || '').toLowerCase().match(/[a-z][a-z-]{4,}/g) || []
)].filter((token) => !KEYWORD_STOP_WORDS.has(token));

const manualNegatesKeyword = (manualText = '', keyword = '') => {
  const escapedKeyword = escapeRegExp(keyword);
  const negatedTermPattern = new RegExp(
    `\\b(?:not|never|no longer|does not|doesn't|is not|isn't|are not|aren't|no)\\b(?:\\W+\\w+){0,4}\\W+${escapedKeyword}\\b`,
    'i'
  );
  return negatedTermPattern.test(manualText);
};

const buildCompanySourceConflicts = ({ manualStatements = [], websiteSnippets = [] } = {}) => {
  if (!manualStatements.length || !websiteSnippets.length) return [];

  const manualText = manualStatements.join(' ');
  const negatedWebsiteKeywords = extractConflictKeywords(websiteSnippets.map((item) => item.snippet).join(' '))
    .filter((keyword) => manualNegatesKeyword(manualText, keyword))
    .slice(0, 3);

  if (!negatedWebsiteKeywords.length) return [];

  return [{
    code: 'manual_website_context_conflict',
    severity: 'warning',
    sourceTypes: ['manual_company_context', 'company_website'],
    conflictSignals: negatedWebsiteKeywords,
    message: 'Manual company context appears to contradict bounded company website evidence. Confirm the company context before matching.',
  }];
};

const buildCompanyUnderstanding = ({
  rubric = {},
  websiteUrl = '',
  manualStatements = [],
  companyWebsiteEvidence = null,
} = {}) => {
  const companyName = normalizeText(rubric.jobOverview?.companyName || rubric.companyName || '');
  const jdCompanyStatements = (rubric.sections?.companyContext || [])
    .map(normalizeText)
    .filter(Boolean)
    .filter((statement) => !UNTRUSTED_INSTRUCTION_PATTERN.test(statement))
    .slice(0, 4);
  const websiteSnippets = getWebsiteEvidenceSnippets(companyWebsiteEvidence).slice(0, 5);
  const sourceConflicts = buildCompanySourceConflicts({ manualStatements, websiteSnippets });
  const facts = [
    ...manualStatements.map((statement) => buildSourceFact({
      statement,
      sourceLabel: 'User-provided company context',
      sourceType: 'manual_company_context',
      confidence: 0.9,
      sourceConfidence: 'medium',
      claimStatus: 'needs_confirmation',
      uncertainty: 'This statement was provided by the user and has not been independently verified.',
      section: 'userCompanyContext',
    })),
    ...websiteSnippets.map(({ snippet, url }) => buildSourceFact({
      statement: snippet,
      sourceLabel: 'Company website evidence',
      sourceType: 'company_website',
      confidence: 0.82,
      sourceConfidence: 'medium',
      claimStatus: 'grounded',
      uncertainty: 'This statement was extracted from bounded visible company website text and still requires user review.',
      section: 'companyWebsiteEvidence',
      url,
    })),
    ...jdCompanyStatements.map((statement) => buildSourceFact({
      statement,
      sourceLabel: 'JD company context',
      sourceType: 'jd_company_context',
      confidence: 0.72,
      sourceConfidence: 'medium',
      claimStatus: 'grounded',
      uncertainty: 'This statement reflects employer-authored JD wording and may be promotional.',
      section: 'companyContext',
    })),
    ...(websiteUrl ? [buildSourceFact({
      statement: `Company website supplied for review: ${websiteUrl}`,
      sourceLabel: 'User-provided company website URL',
      sourceType: 'supplied_url_only',
      confidence: 0.8,
      sourceConfidence: 'low',
      claimStatus: 'needs_confirmation',
      uncertainty: 'The website URL is structurally valid but its content has not been verified during JD parsing.',
      section: 'companyWebsiteUrl',
    })] : []),
  ];
  const baseSummaryParts = manualStatements.length
    ? manualStatements
    : websiteSnippets.length
      ? websiteSnippets.map((item) => item.snippet)
    : jdCompanyStatements.length
      ? jdCompanyStatements
      : websiteUrl
        ? [`Review ${companyName || 'the company'} using the supplied company website before interview.`]
        : [];
  const summaryParts = sourceConflicts.length
    ? ['Company context sources conflict. Review manual context against website evidence before matching.', ...baseSummaryParts]
    : baseSummaryParts;
  const details = buildCompanyUnderstandingDetails({ companyName, facts });

  return {
    ...details,
    companyName,
    summary: summaryParts.slice(0, 3).join(' '),
    facts,
    sourceConflicts,
    confidence: facts.length ? Math.min(...facts.map((fact) => fact.confidence)) : 0,
    uncertainty: sourceConflicts.length
      ? 'Manual company context conflicts with website evidence. Confirm or edit company understanding before matching.'
    : facts.length
      ? 'Confirm or edit these company statements before matching.'
      : 'No company source was provided, so company-specific understanding was not generated.',
  };
};

const buildCompanyContextStatus = ({ websiteUrl = '', manualContext = {}, companyWebsiteEvidence = null, sourceConflicts = [] } = {}) => {
  if (sourceConflicts.length) return 'degraded';
  if (hasGroundedWebsiteEvidence(companyWebsiteEvidence)) return 'grounded';
  if (manualContext.statements?.length) return 'manual';
  if (websiteUrl) return 'url_supplied';
  return 'missing';
};

const buildCompanyContextGroundingStatus = ({ websiteUrl = '', manualContext = {}, companyWebsiteEvidence = null } = {}) => {
  if (hasGroundedWebsiteEvidence(companyWebsiteEvidence)) return 'website_grounded';
  if (manualContext.statements?.length) return 'manual_context';
  if (websiteUrl) return 'supplied_url_only';
  return 'missing';
};

const getRoleIntentDiagnosticReasons = (roleIntent = {}) => (
  (roleIntent.diagnostics || [])
    .map((diagnostic) => diagnostic.degradedReason)
    .filter(Boolean)
);

const getRoleIntentDiagnosticCodes = (roleIntent = {}) => (
  (roleIntent.diagnostics || [])
    .map((diagnostic) => diagnostic.code)
    .filter(Boolean)
);

const buildRoleFitDiagnostics = ({
  websiteUrl = '',
  manualContext = {},
  companyUnderstanding = {},
  roleIntent = {},
  securityFlags = {},
  companyWebsiteEvidence = null,
  sourceConflicts = [],
} = {}) => {
  const degradedReasons = [
    sourceConflicts.length ? 'company_context_source_conflict' : '',
    websiteUrl && !hasGroundedWebsiteEvidence(companyWebsiteEvidence) && !manualContext.statements?.length ? 'company_website_content_not_verified' : '',
    companyWebsiteEvidence?.fetchStatus === 'blocked' ? 'company_website_fetch_blocked' : '',
    companyWebsiteEvidence?.fetchStatus === 'failed' ? 'company_website_fetch_failed' : '',
    securityFlags.invalidCompanyWebsiteUrl ? 'invalid_company_website_url' : '',
    securityFlags.untrustedInstructionDetected ? 'manual_company_context_untrusted_instruction_removed' : '',
    ...getRoleIntentDiagnosticReasons(roleIntent),
  ].filter(Boolean);
  const sourceLimitations = [
    sourceConflicts.length ? 'manual_website_context_conflict' : '',
    ...getRoleIntentDiagnosticCodes(roleIntent),
  ].filter(Boolean);

  return {
    companyContextStatus: buildCompanyContextStatus({ websiteUrl, manualContext, companyWebsiteEvidence, sourceConflicts }),
    companyUnderstandingStatus: (companyUnderstanding.facts || []).length ? 'needs_review' : 'failed',
    roleIntentStatus: (roleIntent.items || []).length ? 'needs_review' : 'failed',
    unsupportedInferenceCount: [
      ...(companyUnderstanding.facts || []),
      ...(roleIntent.items || []),
    ].filter((item) => item.claimStatus === 'unsupported').length,
    evidenceMapCoverage: null,
    proofStrategyStatus: 'not_started',
    answerAlignmentStatus: 'not_started',
    degradedReasons,
    sourceLimitations,
  };
};

export const buildRoleFitProfile = ({
  rawJD = '',
  rubric = {},
  companyWebsiteUrl = '',
  userCompanyContext = '',
  companyWebsiteEvidence = null,
} = {}) => {
  const requestedWebsiteUrl = normalizeText(companyWebsiteUrl || rubric.jobOverview?.companyWebsiteUrl || '');
  const websiteUrl = normalizeHttpUrl(requestedWebsiteUrl);
  const manualContext = sanitizeManualContext(userCompanyContext);
  const hasCompanyContext = Boolean(websiteUrl || manualContext.statements.length);
  const companyUnderstanding = buildCompanyUnderstanding({ rubric, websiteUrl, manualStatements: manualContext.statements, companyWebsiteEvidence });
  const roleIntent = buildRoleIntent(rubric, { companyUnderstanding });
  const securityFlags = {
    invalidCompanyWebsiteUrl: Boolean(requestedWebsiteUrl && !websiteUrl),
    untrustedInstructionDetected: manualContext.untrustedInstructionDetected,
  };

  return {
    schemaVersion: 'role_fit_profile_v1',
    id: stableId('role-fit', rawJD, websiteUrl, manualContext.statements.join('\n')),
    companyContext: {
      status: hasCompanyContext ? 'ready' : 'missing',
      groundingStatus: buildCompanyContextGroundingStatus({ websiteUrl, manualContext, companyWebsiteEvidence }),
      websiteUrl,
      manualContext: manualContext.statements.join(' '),
      sourceTypes: [
        hasGroundedWebsiteEvidence(companyWebsiteEvidence) ? 'company_website' : websiteUrl ? 'supplied_url_only' : '',
        manualContext.statements.length ? 'manual_company_context' : '',
      ].filter(Boolean),
    },
    companyUnderstanding,
    roleIntent,
    review: { status: 'unreviewed', version: 1, baseVersion: 0 },
    securityFlags,
    companyWebsiteEvidence,
    roleFitDiagnostics: buildRoleFitDiagnostics({
      websiteUrl,
      manualContext,
      companyUnderstanding,
      roleIntent,
      securityFlags,
      companyWebsiteEvidence,
      sourceConflicts: companyUnderstanding.sourceConflicts || [],
    }),
    warnings: [
      ...(!hasCompanyContext ? ['Provide a company website URL or manual company context before matching.'] : []),
      ...(requestedWebsiteUrl && !websiteUrl ? ['The company website URL must use HTTP or HTTPS.'] : []),
      ...(manualContext.untrustedInstructionDetected ? ['Prompt-like instructions were excluded from manual company context.'] : []),
    ],
  };
};

export const validateRoleFitReviewInput = (roleFitProfile = {}) => {
  const requestedWebsiteUrl = normalizeText(roleFitProfile.companyContext?.websiteUrl || '');
  const safeWebsiteUrl = normalizeHttpUrl(requestedWebsiteUrl);
  const manualContext = normalizeText(roleFitProfile.companyContext?.manualContext || '');
  const reviewTexts = [
    roleFitProfile.companyUnderstanding?.summary,
    ...(roleFitProfile.roleIntent?.items || []).map((item) => item.statement),
  ].map(normalizeText).filter(Boolean);
  const errorCodes = [
    requestedWebsiteUrl && !safeWebsiteUrl ? 'invalid_company_website_url' : '',
    !safeWebsiteUrl && !manualContext ? 'missing_company_context' : '',
    reviewTexts.some((text) => UNTRUSTED_INSTRUCTION_PATTERN.test(text)) ? 'untrusted_review_instruction' : '',
    !(roleFitProfile.roleIntent?.items || []).length ? 'missing_role_intent' : '',
  ].filter(Boolean);

  return {
    valid: errorCodes.length === 0,
    errorCodes: [...new Set(errorCodes)],
    safeWebsiteUrl,
  };
};
