/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionShared should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused, and move extra branching or formatting into dedicated helpers when it starts growing.
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
import { buildCapabilityPrompt, isTechnicalCapabilityGroup } from './capabilityQuestionPromptService.js';
import {
  buildFullTranscript,
  retentionDate,
  clampVarchar,
  titleCaseWords,
  cleanDisplayTitle,
  extractDisplayTitle,
  findUniversalRequirementTarget,
} from '../../utils/sessionHelpers.js';
import {
  buildOpeningQuestion,
  buildWrapUpQuestion,
  buildRoleCompetencyPrompt,
  buildBehaviouralPrompt,
} from '../../utils/questionBuilders.js';

// Re-export helper functions for backward compatibility
export {
  buildFullTranscript,
  retentionDate,
  clampVarchar,
  titleCaseWords,
  cleanDisplayTitle,
  extractDisplayTitle,
};

export const normalizeStressLevelKey = (value = 'standard') => {
  const normalized = String(value || 'standard').trim().toLowerCase();
  if (['supportive', 'gentle', 'coaching'].includes(normalized)) return 'supportive';
  if (['high_pressure', 'high', 'stress', 'hardcore', 'hard'].includes(normalized)) return 'high_pressure';
  return 'standard';
};

export const mapSessionRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  status: row.status,
  mode: row.mode,
  cvFileId: row.cv_file_id,
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
    stressLevel: normalizeStressLevelKey(row.stress_level || row.settings?.stressLevel || 'standard'),
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

// buildOpeningQuestion and buildWrapUpQuestion are now imported from questionBuilders.js (line 32-33)

// buildTechnicalPrompt, findUniversalRequirementTarget, and buildRoleCompetencyPrompt
// are now imported from questionBuilders.js and sessionHelpers.js (lines 29-36)

const isTechnicalRequirementCategory = (category = '', capabilityGroup = '') => isTechnicalCapabilityGroup(capabilityGroup, category);

// buildBehaviouralPrompt is now imported from questionBuilders.js (line 36)

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
  const companyName = analysisResult?.companyName || rubric?.jobOverview?.companyName || rubric?.companyName || '';
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
    {
      type: 'company_motivation',
      category: 'motivation',
      stage: 'motivation',
      topic: 'company_and_role_motivation',
      followUpDepth: 0,
      text: 'What attracted you to this company and role?',
      reason: 'Capture company and role motivation for report coaching.',
      priority: 2,
      basedOnSkills: [],
      sourceType: 'company_motivation',
      matchedRequirementId: 'company_role_motivation',
      matchedSkill: 'company_and_role_motivation',
      cvEvidenceRefs: [],
      generationReason: 'Ask an early motivation question independent of company values enrichment readiness.',
      confidence: 1,
      planPriority: 2,
    },
  ];

  const technicalQuestionCount = Math.max(0, modeConfig.minTechnicalQuestions);
  for (let index = 0; index < technicalQuestionCount; index += 1) {
    const skill = technicalSkills[index] || technicalSkills[0] || 'a relevant role capability';
    const requirementTarget = findUniversalRequirementTarget({ topic: skill, rubric });
    const promptText = buildRoleCompetencyPrompt({
      target: requirementTarget,
      skill,
      level: modeConfig.level,
      roleLabel,
      followUpDepth: 0,
      isTechnicalRequirementCategory,
      buildCapabilityPrompt,
    });
    const followUpText = buildRoleCompetencyPrompt({
      target: requirementTarget,
      skill,
      level: modeConfig.level,
      roleLabel,
      followUpDepth: 1,
      isTechnicalRequirementCategory,
      buildCapabilityPrompt,
    });
    const isTechnical = requirementTarget ? isTechnicalRequirementCategory(requirementTarget.category, requirementTarget.capabilityGroup) : true;
    const competencyType = requirementTarget && !isTechnical ? 'role_competency_core' : 'technical_core';
    questions.push({
      type: competencyType,
      category: isTechnical ? 'technical' : 'role_competency',
      stage: isTechnical ? 'technical' : 'role_competency',
      topic: skill,
      followUpDepth: 0,
      text: promptText,
      reason: 'Role-aligned competency question generated from JD requirements and matching gaps.',
      priority: index + 20,
      basedOnSkills: [skill],
      sourceType: requirementTarget ? 'universal_requirement_competency' : 'cv_or_jd_skill',
      matchedRequirementId: `req_${skill}`,
      matchedSkill: skill,
      cvEvidenceRefs: [],
      generationReason: 'Probe a core requirement against the candidate CV and JD match result.',
      confidence: 0.72,
      planPriority: index + 20,
    });
    questions.push({
      type: competencyType === 'role_competency_core' ? 'role_competency_follow_up' : 'technical_follow_up',
      category: isTechnical ? 'technical' : 'role_competency',
      stage: isTechnical ? 'technical' : 'role_competency',
      topic: skill,
      followUpDepth: 1,
      text: followUpText,
      reason: 'Follow-up to keep the conversation on the same role requirement.',
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
