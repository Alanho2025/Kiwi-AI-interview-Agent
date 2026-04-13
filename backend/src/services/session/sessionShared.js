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

/**
 * Purpose: Execute the main responsibility for buildFullTranscript.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildFullTranscript = (turns) => turns.map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`).join('\n\n');

export const retentionDate = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

/**
 * Purpose: Execute the main responsibility for clampVarchar.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const clampVarchar = (value, maxLength = 255, fallback = '') => {
  const text = String(value ?? fallback ?? '').trim() || fallback;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

/**
 * Purpose: Execute the main responsibility for titleCaseWords.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const titleCaseWords = (value = '') => value
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ');

/**
 * Purpose: Execute the main responsibility for cleanDisplayTitle.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const cleanDisplayTitle = (value = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?-]+\s*$/, '')
    .trim();

/**
 * Purpose: Execute the main responsibility for extractDisplayTitle.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const extractDisplayTitle = (...candidates) => {
  for (const candidate of candidates) {
    const text = String(candidate || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const directTitleMatch = text.match(/(?:job\s*title|position|role)\s*:\s*([^\n.]{3,120})/i);
    if (directTitleMatch?.[1]) {
      return cleanDisplayTitle(directTitleMatch[1]);
    }

    const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) || '';
    if (firstLine && firstLine.length <= 120 && !/^(we|our|about)\b/i.test(firstLine)) {
      return cleanDisplayTitle(firstLine);
    }

    const commonRoleMatch = text.match(/\b((?:Junior|Senior|Lead|Principal|Staff|Graduate|Mid-Level|Solutions|Software|Backend|Frontend|Full[-\s]?Stack|Mobile|DevOps|Data|Civil|Platform|QA|Test|Product)?\s*(?:Software Engineer|Solutions Engineer|Backend Engineer|Frontend Engineer|Full Stack Engineer|Mobile Developer|React Native Developer|DevOps Engineer|Data Engineer|Civil Engineer|Platform Engineer|QA Engineer|Test Engineer|Product Manager|Developer))\b/i);
    if (commonRoleMatch?.[1]) {
      return cleanDisplayTitle(commonRoleMatch[1]);
    }

    const sentenceMatch = text.match(/^([^.!?]{8,140}?)(?:[.!?]|$)/);
    if (sentenceMatch?.[1] && !/^(we|our)\b/i.test(sentenceMatch[1].trim())) {
      return cleanDisplayTitle(sentenceMatch[1]);
    }

    const titleLikeMatch = text.match(/\b([A-Z][A-Za-z/&()-]+(?:\s+[A-Z][A-Za-z/&()-]+){1,5})\b/);
    if (titleLikeMatch?.[1] && !/^(We|Our)\b/.test(titleLikeMatch[1])) {
      return cleanDisplayTitle(titleLikeMatch[1]);
    }

    return cleanDisplayTitle(text.slice(0, 80));
  }

  return 'Interview Session';
};

/**
 * Purpose: Execute the main responsibility for mapSessionRow.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
    enableNZCultureFit: row.enable_nz_culture_fit,
  },
});

/**
 * Purpose: Execute the main responsibility for buildQuestionPoolFromAnalysis.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildQuestionPoolFromAnalysis = (analysisResult) => {
  const hints = analysisResult?.matchingDetails?.questionPlanHints || {};
  const rubric = analysisResult?.parsedJdProfile || analysisResult?.matchingDetails?.rubric || {};
  const roleLabel = prettifyCanonicalRole(hints.roleCanonical || rubric.roleCanonical || '') || analysisResult?.jobTitle || 'the role';
  const technicalCore = (hints.mustProbeSkills || []).slice(0, 3).flatMap((skill, index) => ([
    { type: 'technical_core', stage: 'technical_core', topic: skill, followUpDepth: 0, text: `Tell me about a project where you used ${skill} in a ${roleLabel} context.`, reason: 'Role-aligned technical core question generated from JD requirements and matching gaps.', priority: index + 2, basedOnSkills: [skill], sourceType: 'cv_or_jd_skill', matchedRequirementId: `req_${skill}`, matchedSkill: skill, cvEvidenceRefs: [], generationReason: 'Probe a core requirement against the candidate CV and JD match result.', confidence: 0.72, planPriority: index + 2 },
    { type: 'technical_follow_up', stage: 'technical_core', topic: skill, followUpDepth: 1, text: `What was your exact approach with ${skill}, and how did you know it worked?`, reason: 'Follow-up to keep the conversation on the same technical topic.', priority: index + 20, basedOnSkills: [skill], sourceType: 'follow_up', matchedRequirementId: `req_${skill}`, matchedSkill: skill, cvEvidenceRefs: [], generationReason: 'Ask for concrete evidence on the same topic before moving on.', confidence: 0.68, planPriority: index + 20 },
  ]));
  const experienceDeepDive = (hints.mustProbeExperience || []).slice(0, 2).flatMap((topic, index) => ([
    { type: 'experience_deep_dive', stage: 'experience_deep_dive', topic, followUpDepth: 0, text: `Can you walk me through a specific example that shows ${topic}?`, reason: 'Experience probe generated from JD requirements and CV-JD comparison.', priority: index + 40, basedOnSkills: [topic], sourceType: 'cv_gap_or_partial', matchedRequirementId: `req_${topic}`, matchedSkill: topic, cvEvidenceRefs: [], generationReason: 'Clarify incomplete evidence found during the CV and JD comparison.', confidence: 0.64, planPriority: index + 40 },
    { type: 'experience_follow_up', stage: 'experience_deep_dive', topic, followUpDepth: 1, text: 'What was your role, what action did you take, and what result came from it?', reason: 'STAR-style follow-up to gather evidence before changing topic.', priority: index + 60, basedOnSkills: [topic], sourceType: 'follow_up', matchedRequirementId: `req_${topic}`, matchedSkill: topic, cvEvidenceRefs: [], generationReason: 'Convert a broad answer into evidence that can be assessed.', confidence: 0.66, planPriority: index + 60 },
  ]));
  const behavioural = (hints.mustProbeBehavioural || ['teamwork', 'communication']).slice(0, 2).flatMap((topic, index) => ([
    { type: 'behavioural', stage: 'behavioural', topic, followUpDepth: 0, text: `Tell me about a time when you had to show ${topic}.`, reason: 'Behavioural probe aligned to the role and NZ interview style.', priority: index + 80, basedOnSkills: [topic], sourceType: 'behavioural_bank', matchedRequirementId: `behaviour_${topic}`, matchedSkill: topic, cvEvidenceRefs: [], generationReason: 'Probe behavioural evidence aligned to the role profile.', confidence: 0.7, planPriority: index + 80 },
    { type: 'behavioural_follow_up', stage: 'behavioural', topic, followUpDepth: 1, text: 'What was the situation, what did you do, and what was the outcome?', reason: 'STAR follow-up keeps the answer structured and natural.', priority: index + 100, basedOnSkills: [topic], sourceType: 'follow_up', matchedRequirementId: `behaviour_${topic}`, matchedSkill: topic, cvEvidenceRefs: [], generationReason: 'Keep the behavioural answer grounded in one concrete example.', confidence: 0.7, planPriority: index + 100 },
  ]));
  return [
    { type: 'self_intro', stage: 'opening', topic: 'self_introduction', followUpDepth: 0, text: 'Please introduce yourself.', reason: 'default opener', priority: 1, basedOnSkills: [], sourceType: 'opening', matchedRequirementId: 'opening_intro', matchedSkill: 'self_introduction', cvEvidenceRefs: [], generationReason: 'Start with a natural introduction before targeted probing.', confidence: 1, planPriority: 1 },
    ...technicalCore,
    ...experienceDeepDive,
    ...behavioural,
    { type: 'wrap_up', stage: 'wrap_up', topic: 'candidate_questions', followUpDepth: 0, text: 'Before we finish, what questions do you have for me about the role or team?', reason: 'Close the conversation naturally.', priority: 999, basedOnSkills: [], sourceType: 'closing', matchedRequirementId: 'closing_questions', matchedSkill: 'candidate_questions', cvEvidenceRefs: [], generationReason: 'Finish naturally and give the candidate space for questions.', confidence: 1, planPriority: 999 },
  ];
};

/**
 * Purpose: Execute the main responsibility for normalizeAnalysisResult.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeAnalysisResult = (analysis) => {
  if (!analysis) {
    return null;
  }

  return validateAnalyzeOutput({
    ...analysis.matchSummary,
    ...analysis.toObject?.(),
    ...analysis,
  });
};

/**
 * Purpose: Execute the main responsibility for buildInterviewPlanPayload.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
  strategy: { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
  questionPool: buildQuestionPoolFromAnalysis(normalizedAnalysis),
  fallbackRules: { short_answer: 'ask_probe', time_low: 'end_early' },
  settingsSnapshot: settings,
});

/**
 * Purpose: Execute the main responsibility for fetchSessionRowById.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const fetchSessionRowById = async (id) => {
  const result = await query('SELECT * FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
  return result.rows[0] || null;
};

/**
 * Purpose: Execute the main responsibility for fetchOwnedSessionRowById.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const fetchOwnedSessionRowById = async (id, userId) => {
  const result = await query('SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1', [id, userId]);
  return result.rows[0] || null;
};
