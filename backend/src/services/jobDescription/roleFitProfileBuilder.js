import crypto from 'node:crypto';

const UNTRUSTED_INSTRUCTION_PATTERN = /\b(ignore (?:all |any |the )?(?:previous|prior|system) instructions?|system prompt|developer message|mark every candidate|override (?:the )?(?:score|match|rules?))\b/i;

const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

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

const buildSourceFact = ({ statement, sourceLabel, sourceType, confidence, uncertainty, section }) => ({
  id: stableId('company-fact', sourceType, statement),
  statement,
  sourceLabel,
  sourceType,
  confidence,
  uncertainty,
  sourceTrace: {
    sourceType,
    section,
    rawSnippet: statement,
  },
});

const buildCompanyUnderstanding = ({ rubric = {}, websiteUrl = '', manualStatements = [] } = {}) => {
  const companyName = normalizeText(rubric.jobOverview?.companyName || rubric.companyName || '');
  const jdCompanyStatements = (rubric.sections?.companyContext || [])
    .map(normalizeText)
    .filter(Boolean)
    .filter((statement) => !UNTRUSTED_INSTRUCTION_PATTERN.test(statement))
    .slice(0, 4);
  const facts = [
    ...manualStatements.map((statement) => buildSourceFact({
      statement,
      sourceLabel: 'User-provided company context',
      sourceType: 'manual_company_context',
      confidence: 0.9,
      uncertainty: 'This statement was provided by the user and has not been independently verified.',
      section: 'userCompanyContext',
    })),
    ...jdCompanyStatements.map((statement) => buildSourceFact({
      statement,
      sourceLabel: 'JD company context',
      sourceType: 'jd_company_context',
      confidence: 0.72,
      uncertainty: 'This statement reflects employer-authored JD wording and may be promotional.',
      section: 'companyContext',
    })),
    ...(websiteUrl ? [buildSourceFact({
      statement: `Company website supplied for review: ${websiteUrl}`,
      sourceLabel: 'User-provided company website URL',
      sourceType: 'company_website_url',
      confidence: 0.8,
      uncertainty: 'The website URL is structurally valid but its content has not been verified during JD parsing.',
      section: 'companyWebsiteUrl',
    })] : []),
  ];
  const summaryParts = manualStatements.length
    ? manualStatements
    : jdCompanyStatements.length
      ? jdCompanyStatements
      : websiteUrl
        ? [`Review ${companyName || 'the company'} using the supplied company website before interview.`]
        : [];

  return {
    companyName,
    summary: summaryParts.slice(0, 3).join(' '),
    facts,
    confidence: facts.length ? Math.min(...facts.map((fact) => fact.confidence)) : 0,
    uncertainty: facts.length
      ? 'Confirm or edit these company statements before matching.'
      : 'No company source was provided, so company-specific understanding was not generated.',
  };
};

const intentCandidates = (rubric = {}) => {
  const sections = rubric.sections || {};
  return [
    ...(sections.mustHaveRequirements || []).map((statement) => ({ statement, priority: 'high', sourceLabel: 'JD must-have requirement', section: 'mustHaveRequirements', category: 'requirement' })),
    ...(sections.responsibilities || rubric.roleSummary || []).map((statement) => ({ statement, priority: 'high', sourceLabel: 'JD responsibility', section: 'responsibilities', category: 'responsibility' })),
    ...(sections.softSkills || rubric.softSkillRequirements || []).map((statement) => ({ statement, priority: 'medium', sourceLabel: 'JD soft skill', section: 'softSkills', category: 'behavioural' })),
    ...(sections.niceToHaveRequirements || rubric.niceToHaveExperience || []).map((statement) => ({ statement, priority: 'low', sourceLabel: 'JD nice-to-have requirement', section: 'niceToHaveRequirements', category: 'preferred_requirement' })),
    ...(rubric.requirements || []).map((item) => ({
      statement: item.label || item.text,
      priority: item.importance || (item.type === 'hard' ? 'high' : 'medium'),
      sourceLabel: item.type === 'hard' ? 'JD must-have requirement' : 'JD parsed requirement',
      section: 'requirements',
      category: item.category || 'requirement',
    })),
  ];
};

const BOILERPLATE_INTENT_PATTERN = /^(?:why\s+you\s+should\s+care|why\s+work\s+for\s+us|why\s+join\s+us|what\s+we\s+offer|how\s+to\s+apply|about\s+the\s+company|about\s+us|apply\s+now|recruiter|save\s+job|share\s+this\s+job|work\s+type|posted\s+date|salary|location):?$/i;

const buildRoleIntent = (rubric = {}) => {
  const seen = new Set();
  const items = intentCandidates(rubric).flatMap((candidate) => {
    const statement = normalizeText(candidate.statement);
    const key = statement.toLowerCase();
    if (!statement || seen.has(key) || UNTRUSTED_INSTRUCTION_PATTERN.test(statement) || BOILERPLATE_INTENT_PATTERN.test(statement)) return [];
    seen.add(key);
    return [{
      id: stableId('intent', candidate.section, statement),
      statement,
      priority: candidate.priority,
      category: candidate.category,
      sourceLabel: candidate.sourceLabel,
      confidence: candidate.section === 'requirements' ? 0.78 : 0.9,
      uncertainty: candidate.section === 'responsibilities'
        ? 'Responsibility wording may describe team scope rather than individual ownership.'
        : 'Confirm the priority and interpretation during human review.',
      sourceTrace: {
        sourceType: 'job_description',
        section: candidate.section,
        rawSnippet: statement,
      },
    }];
  });

  return { items, highPriorityCount: items.filter((item) => item.priority === 'high').length };
};

export const buildRoleFitProfile = ({ rawJD = '', rubric = {}, companyWebsiteUrl = '', userCompanyContext = '' } = {}) => {
  const requestedWebsiteUrl = normalizeText(companyWebsiteUrl || rubric.jobOverview?.companyWebsiteUrl || '');
  const websiteUrl = normalizeHttpUrl(requestedWebsiteUrl);
  const manualContext = sanitizeManualContext(userCompanyContext);
  const hasCompanyContext = Boolean(websiteUrl || manualContext.statements.length);

  return {
    schemaVersion: 'role_fit_profile_v1',
    id: stableId('role-fit', rawJD, websiteUrl, manualContext.statements.join('\n')),
    companyContext: {
      status: hasCompanyContext ? 'ready' : 'missing',
      websiteUrl,
      manualContext: manualContext.statements.join(' '),
      sourceTypes: [websiteUrl ? 'company_website_url' : '', manualContext.statements.length ? 'manual_company_context' : ''].filter(Boolean),
    },
    companyUnderstanding: buildCompanyUnderstanding({ rubric, websiteUrl, manualStatements: manualContext.statements }),
    roleIntent: buildRoleIntent(rubric),
    review: { status: 'unreviewed', version: 1, baseVersion: 0 },
    securityFlags: {
      invalidCompanyWebsiteUrl: Boolean(requestedWebsiteUrl && !websiteUrl),
      untrustedInstructionDetected: manualContext.untrustedInstructionDetected,
    },
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
