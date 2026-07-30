import { buildSpeechPhraseList } from '../../config/speechPhraseList.js';

const MAX_PHRASES = 120;
const MAX_PHRASE_LENGTH = 80;

const TECH_TOKEN_PATTERN = /\b(?:[A-Z0-9]+(?:\/[A-Z0-9]+)+|[A-Z][A-Za-z0-9]*\.?[A-Za-z0-9]*|[A-Za-z]+(?:\.(?:js|ts)|JS|TS)|[A-Za-z]+(?:SQL|API|SDK|AI|ML|UI|UX|DB|EC2|RDS|S3|IAM|VAD|TTS|STT)|[A-Za-z]+(?:[- ][A-Za-z0-9]+){1,3})\b/gi;
const GENERIC_PHRASES = new Set(['and', 'or', 'the', 'with', 'from', 'your', 'this', 'that', 'role', 'team', 'work']);
const AUTO_CORRECT_REASONS = new Set([
  'proper_noun',
  'technical_acronym',
  'tool_or_framework',
  'certification',
  'company_or_product_name',
  'domain_term',
  'question_target_skill',
  'user_confirmed',
]);

const cleanPhrase = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/^[,.;:!?()[\]{}'"`]+|[,.;:!?()[\]{}'"`]+$/g, '')
  .trim();

const normalizeTermKey = (value = '') => cleanPhrase(value).toLowerCase();

const inferReason = (phrase = '', fallback = 'domain_term') => {
  if (/\b(?:CI\/CD|STT\/TTS|[A-Z]{2,}\b|\bEC2\b|\bRDS\b|\bS3\b|\bIAM\b|\bVAD\b)\b/i.test(phrase)) return 'technical_acronym';
  if (/\b(?:SQL|API|SDK|AI|ML|UI|UX|DB)\b/i.test(phrase) || /\.(?:js|ts)$/i.test(phrase) || /\b(?:WebSocket|WebSockets|TypeScript|LangChain|Docker|PostgreSQL|Render)\b/i.test(phrase)) return 'tool_or_framework';
  if (/\b(?:certificate|certification|certified|degree|university)\b/i.test(phrase)) return 'certification';
  if (/^[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)+$/.test(phrase)) return 'proper_noun';
  return fallback;
};

const buildGlossaryItem = ({
  term,
  source,
  fieldPath,
  scope = 'session',
  priority = 'medium',
  reason = null,
}) => {
  const phrase = cleanPhrase(term);
  const resolvedReason = reason || inferReason(phrase);
  return {
    term: phrase,
    normalizedTerm: normalizeTermKey(phrase),
    source,
    sourceRef: {
      fieldPath,
    },
    scope,
    priority,
    reason: resolvedReason,
    safeForPhraseHint: true,
    safeForAutoCorrection: AUTO_CORRECT_REASONS.has(resolvedReason),
    safeForReportCitation: false,
  };
};

const addGlossaryItem = (items, value, metadata) => {
  const phrase = cleanPhrase(value);
  if (!phrase || phrase.length < 2 || phrase.length > MAX_PHRASE_LENGTH) return;
  if (GENERIC_PHRASES.has(phrase.toLowerCase())) return;
  const key = normalizeTermKey(phrase);
  if (items.has(key)) return;
  items.set(key, buildGlossaryItem({ term: phrase, ...metadata }));
};

const addPhrase = (items, value, metadata) => addGlossaryItem(items, value, metadata);

const addMany = (items, values = [], metadata) => {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (typeof value === 'string') {
      addPhrase(items, value, metadata);
    } else if (value && typeof value === 'object') {
      addPhrase(items, value.label || value.name || value.title || value.skill || value.keyword || value.value, metadata);
    }
  }
};

const addTextTokens = (items, value = '', metadata) => {
  const text = String(value || '');
  const matches = text.match(TECH_TOKEN_PATTERN) || [];
  for (const match of matches) addPhrase(items, match, metadata);
};

const addManyTextTokens = (items, values = [], metadata) => {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (typeof value === 'string') {
      addTextTokens(items, value, metadata);
    } else if (value && typeof value === 'object') {
      addTextTokens(items, value.label || value.name || value.title || value.skill || value.keyword || value.value, metadata);
    }
  }
};

const addRubricPhrases = (items, rubric = {}) => {
  const baseMetadata = { source: 'jd_rubric', fieldPath: 'parsedJdProfile', priority: 'high' };
  addMany(items, [
    rubric.title,
    rubric.jobTitle,
    rubric.roleCanonical,
    rubric.roleFamily,
    rubric.companyName,
  ], { ...baseMetadata, reason: 'company_or_product_name' });
  addManyTextTokens(items, rubric.mustHaveRequirements, { ...baseMetadata, fieldPath: 'parsedJdProfile.mustHaveRequirements', priority: 'medium' });
  addManyTextTokens(items, rubric.niceToHaveExperience, { ...baseMetadata, fieldPath: 'parsedJdProfile.niceToHaveExperience' });
  addManyTextTokens(items, rubric.qualifications, { ...baseMetadata, fieldPath: 'parsedJdProfile.qualifications', reason: 'certification' });
  addManyTextTokens(items, rubric.responsibilities, { ...baseMetadata, fieldPath: 'parsedJdProfile.responsibilities', priority: 'medium' });
  addMany(items, rubric.softSkills, { ...baseMetadata, fieldPath: 'parsedJdProfile.softSkills', priority: 'low', reason: 'domain_term' });
  addManyTextTokens(items, rubric.benefits, { ...baseMetadata, fieldPath: 'parsedJdProfile.benefits', priority: 'low', reason: 'domain_term' });

  const technicalSkills = rubric.sections?.technicalSkills || rubric.technicalSkills || {};
  if (Array.isArray(technicalSkills)) {
    addMany(items, technicalSkills, { ...baseMetadata, fieldPath: 'parsedJdProfile.sections.technicalSkills', reason: 'tool_or_framework' });
  } else if (technicalSkills && typeof technicalSkills === 'object') {
    for (const skillItems of Object.values(technicalSkills)) {
      addMany(items, skillItems, { ...baseMetadata, fieldPath: 'parsedJdProfile.sections.technicalSkills', reason: 'tool_or_framework' });
    }
  }
};

const addCvPhrases = (items, cvProfile = {}) => {
  const baseMetadata = { source: 'cv_profile', fieldPath: 'parsedCvProfile', priority: 'high' };
  addMany(items, cvProfile.skills, { ...baseMetadata, fieldPath: 'parsedCvProfile.skills', reason: 'tool_or_framework' });
  addMany(items, cvProfile.technicalSkills, { ...baseMetadata, fieldPath: 'parsedCvProfile.technicalSkills', reason: 'tool_or_framework' });
  addMany(items, cvProfile.tools, { ...baseMetadata, fieldPath: 'parsedCvProfile.tools', reason: 'tool_or_framework' });
  addMany(items, cvProfile.frameworks, { ...baseMetadata, fieldPath: 'parsedCvProfile.frameworks', reason: 'tool_or_framework' });
  addMany(items, cvProfile.certifications, { ...baseMetadata, fieldPath: 'parsedCvProfile.certifications', reason: 'certification' });
  addMany(items, cvProfile.education, { ...baseMetadata, fieldPath: 'parsedCvProfile.education', priority: 'medium', reason: 'proper_noun' });
  addMany(items, cvProfile.projects, { ...baseMetadata, fieldPath: 'parsedCvProfile.projects', reason: 'proper_noun' });
  addTextTokens(items, JSON.stringify(cvProfile).slice(0, 8000), { ...baseMetadata, fieldPath: 'parsedCvProfile', priority: 'medium' });
};

const addPlanPhrases = (items, interviewPlan = {}) => {
  const baseMetadata = { source: 'interview_plan', fieldPath: 'interviewPlan', scope: 'session', priority: 'medium', reason: 'question_target_skill' };
  addMany(items, interviewPlan.interviewFocus, { ...baseMetadata, fieldPath: 'interviewPlan.interviewFocus' });
  addMany(items, interviewPlan.strengths, { ...baseMetadata, fieldPath: 'interviewPlan.strengths' });
  addMany(items, interviewPlan.gaps, { ...baseMetadata, fieldPath: 'interviewPlan.gaps' });
  for (const item of interviewPlan.questionPool || []) {
    const questionMetadata = {
      ...baseMetadata,
      fieldPath: `interviewPlan.questionPool.${item.id || item.questionId || item.topic || 'question'}`,
      scope: 'question',
      priority: 'high',
    };
    addPhrase(items, item.topic, questionMetadata);
    addPhrase(items, item.matchedSkill, questionMetadata);
    addMany(items, item.basedOnSkills, questionMetadata);
    addTextTokens(items, item.text, questionMetadata);
  }
};

export const buildSessionContextualGlossary = (session = {}) => {
  const items = new Map();
  const analysis = session.analysisResult || {};
  const rubric = analysis.parsedJdProfile || analysis.matchingDetails?.rubric || {};
  const hints = analysis.matchingDetails?.questionPlanHints || {};

  addMany(items, [
    session.candidateName,
    session.targetRole,
    session.displayTitle,
    analysis.jobTitle,
    analysis.companyName,
    hints.roleCanonical,
  ], { source: 'jd_rubric', fieldPath: 'session.role', priority: 'high', reason: 'proper_noun' });
  addMany(items, [
    'prompt engineering',
    'test-driven development',
    'Codex',
  ], { source: 'global_fallback', fieldPath: 'GLOBAL_INTERVIEW_PHRASES', priority: 'medium', reason: 'domain_term' });
  addMany(items, analysis.interviewFocus, { source: 'interview_plan', fieldPath: 'analysis.interviewFocus', priority: 'medium', reason: 'question_target_skill' });
  addMany(items, analysis.matchingDetails?.topMatchedSkills, { source: 'interview_plan', fieldPath: 'matchingDetails.topMatchedSkills', priority: 'high', reason: 'question_target_skill' });
  addMany(items, analysis.planPreview?.topMatchedAreas, { source: 'interview_plan', fieldPath: 'planPreview.topMatchedAreas', priority: 'medium', reason: 'question_target_skill' });
  addMany(items, hints.priorityTopics, { source: 'interview_plan', fieldPath: 'questionPlanHints.priorityTopics', priority: 'high', reason: 'question_target_skill' });
  addMany(items, hints.followUpTargets, { source: 'interview_plan', fieldPath: 'questionPlanHints.followUpTargets', priority: 'high', reason: 'question_target_skill' });
  addMany(items, hints.mustProbeSkills, { source: 'interview_plan', fieldPath: 'questionPlanHints.mustProbeSkills', priority: 'high', reason: 'question_target_skill' });
  addMany(items, hints.mustProbeExperience, { source: 'interview_plan', fieldPath: 'questionPlanHints.mustProbeExperience', priority: 'high', reason: 'question_target_skill' });
  addMany(items, hints.mustProbeBehavioural, { source: 'interview_plan', fieldPath: 'questionPlanHints.mustProbeBehavioural', priority: 'medium', reason: 'question_target_skill' });
  addRubricPhrases(items, rubric);
  addCvPhrases(items, analysis.parsedCvProfile || session.cvProfile || {});
  addPlanPhrases(items, session.interviewPlan || {});

  return Array.from(items.values()).slice(0, MAX_PHRASES);
};

export const buildSessionSpeechPhraseContext = (session = {}) => {
  const contextualGlossary = buildSessionContextualGlossary(session);
  const phraseList = buildSpeechPhraseList(contextualGlossary.map((item) => item.term)).slice(0, MAX_PHRASES);
  return { phraseList, contextualGlossary };
};

export const buildSessionSpeechPhraseList = (session = {}) => {
  const { phraseList } = buildSessionSpeechPhraseContext(session);
  return phraseList;
};
