/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionShared should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { query } from '../../db/postgres.js';
import { validateAnalyzeOutput, validateInterviewPlan } from '../schemaValidationService.js';
import { prettifyCanonicalRole } from '../taxonomyService.js';
import {
  buildInterviewModeKey,
  normalizeFocusAreaKey,
  normalizeSeniorityLevelKey,
  resolveInterviewBlueprint,
  resolveInterviewModeConfig,
} from '../../config/interviewBlueprints.js';

export const buildFullTranscript = (turns) => turns.map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`).join('\n\n');
export const retentionDate = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

export const clampVarchar = (value, maxLength = 255, fallback = '') => {
  const text = String(value ?? fallback ?? '').trim() || fallback;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const ROLE_ACRONYMS = new Set(['QA', 'NZ', 'API', 'SQL', 'AWS', 'GCP', 'UI', 'UX']);
export const titleCaseWords = (value = '') => value
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => {
    if (ROLE_ACRONYMS.has(part.toUpperCase())) return part.toUpperCase();
    if (/^\.?net$/i.test(part)) return '.NET';
    const parenthetical = part.match(/^\(([^)]+)\)$/);
    if (parenthetical?.[1]) {
      const inner = parenthetical[1];
      const upperInner = inner.toUpperCase();
      if (ROLE_ACRONYMS.has(upperInner)) return `(${upperInner})`;
      return `(${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()})`;
    }
    if (/^[A-Z0-9_/-]{2,}$/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  })
  .join(' ');

const DISPLAY_TITLE_ROLE_NOUN_PATTERN = /\b(?:engineer|developer|designer|analyst|architect|consultant|specialist|intern|scientist|administrator|programme|program|product manager)\b/i;
const DISPLAY_TITLE_FALSE_POSITIVE_HIRING_ROLES = /\b(?:hiring manager|hiring coordinator|recruitment manager|talent acquisition specialist|people & culture advisor|people and culture advisor)\b/i;
const DISPLAY_TITLE_MARKETING_PREFIX_PATTERNS = [
  /^(?:we\s+are\s+)?(?:now\s+)?hiring\s*[:：]?\s+(?:for\s+)?(?:(?:a|an|the)\s+)?/i,
  /^we\s+are\s+looking\s+for\s+(?:(?:a|an|the)\s+)?/i,
  /^join\s+us\s+as\s+(?:(?:a|an|the)\s+)?/i,
  /^open\s+role\s*[:：]?\s*/i,
  /^role\s*[:：]?\s*/i,
  /^position\s*[:：]?\s*/i,
];

export const cleanDisplayTitle = (value = '') => {
  let text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?-]+\s*$/, '')
    .trim();

  if (!text || DISPLAY_TITLE_FALSE_POSITIVE_HIRING_ROLES.test(text)) return text;

  for (const pattern of DISPLAY_TITLE_MARKETING_PREFIX_PATTERNS) {
    const cleaned = text.replace(pattern, '').replace(/[.,;:!?-]+\s*$/, '').trim();
    if (cleaned && cleaned !== text && DISPLAY_TITLE_ROLE_NOUN_PATTERN.test(cleaned)) {
      text = cleaned;
      break;
    }
  }

  return text;
};

export const extractDisplayTitle = (...candidates) => {
  for (const candidate of candidates) {
    const text = String(candidate || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const directTitleMatch = text.match(/(?:job\s*title|position|role)\s*:\s*([^\n.]{3,120})/i);
    if (directTitleMatch?.[1]) return cleanDisplayTitle(directTitleMatch[1]);

    const commonRoleMatch = text.match(/\b((?:Junior|Senior|Lead|Principal|Staff|Graduate|Mid-Level|Solutions|Software|Backend|Frontend|Full[-\s]?Stack|Mobile|DevOps|Data|Civil|Platform|QA|Test|Product|AI|Machine Learning|Cloud)?\s*(?:Software Engineer|Solutions Engineer|Backend Engineer|Frontend Engineer|Full Stack Engineer|Mobile Developer|React Native Developer|DevOps Engineer|Data Engineer|Data \w+ AI Engineer|Data & AI Engineer|AI Engineer|Civil Engineer|Platform Engineer|QA Engineer|Test Engineer|Product Manager|Developer|Data Scientist|Machine Learning Engineer|Cloud Engineer))\b/i);
    if (commonRoleMatch?.[1]) return cleanDisplayTitle(commonRoleMatch[1]);

    const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) || '';
    if (firstLine && firstLine.length <= 120 && !/^(we|our|about|in\b)\b/i.test(firstLine)) return cleanDisplayTitle(firstLine);

    const sentenceMatch = text.match(/^([^.!?]{8,140}?)(?:[.!?]|$)/);
    if (sentenceMatch?.[1] && !/^(we|our|in\b)\b/i.test(sentenceMatch[1].trim())) return cleanDisplayTitle(sentenceMatch[1]);

    return cleanDisplayTitle(text.slice(0, 80));
  }

  return 'Interview Session';
};

export const mapSessionRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  status: row.status,
  mode: row.mode,
  targetRole: row.target_role,
  candidateName: row.candidate_name,
  totalQuestions: row.total_questions,
  currentQuestionIndex: row.current_question_index,
  elapsedSeconds: row.elapsed_seconds,
  controlMode: row.control_mode || 'question_limited',
  questionType: row.question_type || row.focus_area || 'combined',
  questionLimit: row.question_limit || row.total_questions,
  timeLimitSeconds: row.time_limit_seconds || null,
  completedBecause: row.completed_because || null,
  lastResumedAt: row.last_resumed_at,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationSeconds: row.duration_seconds,
  overallScore: row.overall_score,
  summaryText: row.summary_text,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  settings: {
    seniorityLevel: row.seniority_level,
    focusArea: row.focus_area,
    questionType: row.question_type || row.focus_area,
    controlMode: row.control_mode || 'question_limited',
    questionLimit: row.question_limit || row.total_questions,
    timeLimitSeconds: row.time_limit_seconds || null,
    timeLimitMinutes: row.time_limit_seconds ? Math.round(Number(row.time_limit_seconds) / 60) : null,
    enableNZCultureFit: row.enable_nz_culture_fit,
  },
});

export const buildCanonicalRoleMeta = ({ resolvedTargetRole = '', normalizedAnalysis = null, settings = {} } = {}) => {
  const parsedJdProfile = normalizedAnalysis?.parsedJdProfile || normalizedAnalysis?.matchingDetails?.rubric || {};
  const canonicalRole = prettifyCanonicalRole(
    parsedJdProfile?.roleCanonical || normalizedAnalysis?.matchingDetails?.questionPlanHints?.roleCanonical || ''
  ) || '';
  const explicitResolvedTitle = cleanDisplayTitle(resolvedTargetRole);
  const displayTitle = explicitResolvedTitle || extractDisplayTitle(
    normalizedAnalysis?.jobTitle,
    parsedJdProfile?.title,
    parsedJdProfile?.jobTitle,
    canonicalRole
  );
  const seniorityKey = normalizeSeniorityLevelKey(settings?.seniorityLevel || settings?.level || 'junior');
  const focusAreaKey = normalizeFocusAreaKey(settings?.focusArea || 'combined');
  return {
    canonicalRole: cleanDisplayTitle(canonicalRole || displayTitle || explicitResolvedTitle || 'Interview Role'),
    displayTitle: titleCaseWords(cleanDisplayTitle(displayTitle || explicitResolvedTitle || canonicalRole || 'Interview Session')),
    compactRoleLabel: titleCaseWords(cleanDisplayTitle(displayTitle || explicitResolvedTitle || canonicalRole || 'Interview Role')),
    roleFamily: parsedJdProfile?.roleFamily || normalizedAnalysis?.matchingDetails?.rubric?.roleFamily || '',
    seniorityKey,
    focusAreaKey,
    interviewModeKey: buildInterviewModeKey({ seniorityLevel: seniorityKey, focusArea: focusAreaKey }),
  };
};

const buildOpeningQuestion = ({ roleLabel = 'the role', companyName = '', level = 'junior' } = {}) => {
  const companyClause = companyName ? ` with ${companyName}` : '';
  if (String(level) === 'advanced') {
    return `Hi, thanks for joining today${companyClause}. To get us started, could you introduce yourself and walk me through the parts of your background that best prepare you for this ${roleLabel} interview?`;
  }
  if (String(level) === 'intermediate') {
    return `Hi, thanks for being here today${companyClause}. To start, could you briefly introduce yourself and highlight the experience most relevant to this ${roleLabel} interview?`;
  }
  return `Hi, thanks for joining today${companyClause}. Let’s start with a quick introduction. Could you tell me a bit about yourself and what interested you in this ${roleLabel} interview?`;
};

const buildWrapUpQuestion = () => ({
  type: 'wrap_up',
  category: 'closing',
  stage: 'wrap_up',
  topic: 'candidate_questions',
  followUpDepth: 0,
  text: 'Before we finish, what questions do you have for me about the role or team?',
  reason: 'Close the conversation naturally.',
  priority: 999,
  basedOnSkills: [],
  sourceType: 'closing',
  matchedRequirementId: 'closing_questions',
  matchedSkill: 'candidate_questions',
  cvEvidenceRefs: [],
  generationReason: 'Finish naturally and give the candidate space for questions.',
  confidence: 1,
  planPriority: 999,
});

const buildTechnicalPrompt = ({ skill, level, roleLabel, followUpDepth }) => {
  if (followUpDepth > 0) {
    if (level === 'advanced') return `What trade-off, risk, or debugging judgement did you handle yourself around ${skill}, and how did you know your approach worked?`;
    if (level === 'intermediate') return `What was your exact approach with ${skill}, and how did you judge whether it worked?`;
    return `What was your exact approach with ${skill}, and what result came from it?`;
  }
  if (level === 'advanced') return `Tell me about a production-level example where you made an important design, trade-off, or implementation decision using ${skill} for a ${roleLabel} problem.`;
  if (level === 'intermediate') return `Tell me about a project where you used ${skill} and explain the key decisions you made.`;
  return `Tell me about a project where you used ${skill} in a practical way.`;
};

const buildBehaviouralPrompt = ({ topic, level, followUpDepth }) => {
  if (followUpDepth > 0) {
    return level === 'advanced'
      ? 'What was the situation, what decision did you personally drive, and what changed because of it?'
      : 'What was the situation, what did you do, and what was the outcome?';
  }
  if (level === 'advanced') return `Tell me about a time when you had to show ${topic} in a situation with judgement, ambiguity, or stakeholder pressure.`;
  if (level === 'intermediate') return `Tell me about a time when you had to show ${topic} in a real work or project situation.`;
  return `Tell me about a time when you had to show ${topic}.`;
};

export const buildQuestionPoolFromAnalysis = (analysisResult, settings = {}, options = {}) => {
  const hints = analysisResult?.matchingDetails?.questionPlanHints || {};
  const rubric = analysisResult?.parsedJdProfile || analysisResult?.matchingDetails?.rubric || {};
  const modeConfig = resolveInterviewModeConfig(settings);
  const roleMeta = buildCanonicalRoleMeta({
    resolvedTargetRole: options.resolvedTargetRole || analysisResult?.jobTitle || '',
    normalizedAnalysis: analysisResult,
    settings,
  });
  const roleLabel = roleMeta.displayTitle || 'the role';
  const companyName = analysisResult?.companyName || rubric?.companyName || '';
  const technicalSkills = (hints.mustProbeSkills || []).filter(Boolean);
  const behaviouralTopics = (hints.mustProbeBehavioural || ['teamwork', 'communication', 'ownership']).filter(Boolean);

  const questions = [
    {
      type: 'self_intro',
      category: 'opening',
      stage: 'opening',
      topic: 'self_intro',
      followUpDepth: 0,
      text: buildOpeningQuestion({ roleLabel, companyName, level: modeConfig.level }),
      reason: 'Warm interviewer opening with role context.',
      priority: 1,
      basedOnSkills: [],
      sourceType: 'opening',
      matchedRequirementId: 'opening_intro',
      matchedSkill: 'self_intro',
      cvEvidenceRefs: [],
      generationReason: 'Start with a natural introduction before targeted probing.',
      confidence: 1,
      planPriority: 1,
    },
  ];

  const technicalQuestionCount = Math.max(0, modeConfig.minTechnicalQuestions);
  for (let index = 0; index < technicalQuestionCount; index += 1) {
    const skill = technicalSkills[index] || technicalSkills[0] || 'a relevant technical stack';
    questions.push({
      type: 'technical_core',
      category: 'technical',
      stage: 'technical',
      topic: skill,
      followUpDepth: 0,
      text: buildTechnicalPrompt({ skill, level: modeConfig.level, roleLabel, followUpDepth: 0 }),
      reason: 'Role-aligned technical core question generated from JD requirements and matching gaps.',
      priority: index + 20,
      basedOnSkills: [skill],
      sourceType: 'cv_or_jd_skill',
      matchedRequirementId: `req_${skill}`,
      matchedSkill: skill,
      cvEvidenceRefs: [],
      generationReason: 'Probe a core requirement against the candidate CV and JD match result.',
      confidence: 0.72,
      planPriority: index + 20,
    });
    questions.push({
      type: 'technical_follow_up',
      category: 'technical',
      stage: 'technical',
      topic: skill,
      followUpDepth: 1,
      text: buildTechnicalPrompt({ skill, level: modeConfig.level, roleLabel, followUpDepth: 1 }),
      reason: 'Follow-up to keep the conversation on the same technical topic.',
      priority: index + 40,
      basedOnSkills: [skill],
      sourceType: 'follow_up',
      matchedRequirementId: `req_${skill}`,
      matchedSkill: skill,
      cvEvidenceRefs: [],
      generationReason: 'Ask for concrete evidence on the same topic before moving on.',
      confidence: 0.68,
      planPriority: index + 40,
    });
  }

  const behaviouralQuestionCount = Math.max(0, modeConfig.minBehaviouralQuestions);
  for (let index = 0; index < behaviouralQuestionCount; index += 1) {
    const topic = behaviouralTopics[index] || behaviouralTopics[0] || 'teamwork';
    questions.push({
      type: 'behavioural',
      category: 'behavioural',
      stage: 'behavioural',
      topic,
      followUpDepth: 0,
      text: buildBehaviouralPrompt({ topic, level: modeConfig.level, followUpDepth: 0 }),
      reason: 'Behavioural probe aligned to the role and NZ interview style.',
      priority: index + 80,
      basedOnSkills: [topic],
      sourceType: 'behavioural_bank',
      matchedRequirementId: `behaviour_${topic}`,
      matchedSkill: topic,
      cvEvidenceRefs: [],
      generationReason: 'Probe behavioural evidence aligned to the role profile.',
      confidence: 0.7,
      planPriority: index + 80,
    });
    questions.push({
      type: 'behavioural_follow_up',
      category: 'behavioural',
      stage: 'behavioural',
      topic,
      followUpDepth: 1,
      text: buildBehaviouralPrompt({ topic, level: modeConfig.level, followUpDepth: 1 }),
      reason: 'STAR follow-up keeps the answer structured and natural.',
      priority: index + 100,
      basedOnSkills: [topic],
      sourceType: 'follow_up',
      matchedRequirementId: `behaviour_${topic}`,
      matchedSkill: topic,
      cvEvidenceRefs: [],
      generationReason: 'Keep the behavioural answer grounded in one concrete example.',
      confidence: 0.7,
      planPriority: index + 100,
    });
  }

  questions.push(buildWrapUpQuestion());
  return questions;
};

export const normalizeAnalysisResult = (analysis) => {
  if (!analysis) return null;
  return validateAnalyzeOutput({
    ...analysis.matchSummary,
    ...analysis.toObject?.(),
    ...analysis,
  });
};

export const buildInterviewPlanPayload = ({
  normalizedAnalysis,
  settings = {},
  resolvedCandidateName,
  resolvedTargetRole,
}) => validateInterviewPlan({
  schemaVersion: normalizedAnalysis.schemaVersion || 'v3',
  candidateName: resolvedCandidateName,
  jobTitle: resolvedTargetRole,
  matchScore: normalizedAnalysis.matchScore || 0,
  decision: normalizedAnalysis.decision,
  confidence: normalizedAnalysis.confidence,
  requirementChecks: normalizedAnalysis.requirementChecks,
  explanation: normalizedAnalysis.explanation,
  strengths: normalizedAnalysis.strengths || [],
  gaps: normalizedAnalysis.gaps || [],
  interviewFocus: normalizedAnalysis.interviewFocus || [],
  planPreview: normalizedAnalysis.planPreview || '',
  strategy: resolveInterviewBlueprint(settings?.seniorityLevel || settings?.level || 'junior').strategy,
  interviewModeKey: buildInterviewModeKey(settings),
  questionPool: buildQuestionPoolFromAnalysis(normalizedAnalysis, settings, { resolvedTargetRole }),
  fallbackRules: { short_answer: 'ask_probe', time_low: 'end_early' },
  settingsSnapshot: settings,
});

export const fetchSessionRowById = async (id) => {
  const result = await query('SELECT * FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
  return result.rows[0] || null;
};

export const fetchOwnedSessionRowById = async (id, userId) => {
  const result = await query('SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1', [id, userId]);
  return result.rows[0] || null;
};
