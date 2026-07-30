/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionViewBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { validateAnalyzeOutput, validateInterviewPlan } from '../schemaValidationService.js';
import {
  buildCanonicalRoleMeta,
  buildInterviewPlanPayload,
  extractDisplayTitle,
  mapSessionRow,
  normalizeAnalysisResult,
  titleCaseWords,
} from './sessionShared.js';
import { sanitizeRoleFitDiagnostics } from '../roleFit/roleFitDiagnosticsService.js';

export const sanitizeQuestionPoolForClient = (questionPool = []) => questionPool.map((item = {}) => ({
  text: item.text || '',
  fallbackText: item.fallbackText || '',
  category: item.category || '',
  stage: item.stage || '',
  questionRole: item.questionRole || '',
}));

export const sanitizeRoleFitForClient = (roleFit = {}) => {
  if (roleFit?.readiness && typeof roleFit.enabled === 'boolean') return roleFit;
  const proofStrategy = roleFit?.proofStrategy || {};
  const mustCover = Array.isArray(proofStrategy.mustCover) ? proofStrategy.mustCover : [];
  const proofStrategyStatus = proofStrategy.artifactStatus || (Object.keys(proofStrategy).length ? 'degraded' : 'not_started');
  return {
    enabled: Boolean(Object.keys(proofStrategy).length),
    readiness: {
      proofStrategyStatus,
      degradedReason: proofStrategy.degradedReason || null,
      coverageCount: mustCover.length,
      coveredCount: mustCover.filter((item) => item.status === 'covered').length,
    },
    diagnostics: sanitizeRoleFitDiagnostics(proofStrategy.roleFitDiagnostics || roleFit.roleFitDiagnostics || {}),
  };
};

export const sanitizeTranscriptMetadataForClient = (metadata = {}) => {
  const safeMetadata = {};
  if (typeof metadata?.topic === 'string') safeMetadata.topic = metadata.topic;
  if (metadata?.latency && typeof metadata.latency === 'object') safeMetadata.latency = metadata.latency;
  return safeMetadata;
};

export const sanitizeAnalysisForSession = (analysisResult, sessionStatus) => {
  if (!analysisResult || !['in_progress', 'paused', 'completed'].includes(sessionStatus)) return analysisResult;
  const roleEvidenceMap = analysisResult.roleEvidenceMap || {};
  return {
    ...analysisResult,
    roleFitDiagnostics: sanitizeRoleFitDiagnostics(analysisResult.roleFitDiagnostics || {}),
    roleEvidenceMap: Object.keys(roleEvidenceMap).length
      ? {
        schemaVersion: roleEvidenceMap.schemaVersion || '',
        intentCoverage: roleEvidenceMap.intentCoverage || {},
        classificationCounts: roleEvidenceMap.classificationCounts || {},
        artifactStatus: roleEvidenceMap.artifactStatus || 'ready',
        degradedReason: roleEvidenceMap.degradedReason || null,
      }
      : {},
  };
};

export const sanitizeLiveSessionForClient = (session = {}) => ({
  ...session,
  analysisResult: sanitizeAnalysisForSession(session.analysisResult, session.status),
  interviewPlan: session.interviewPlan ? {
    ...session.interviewPlan,
    roleFit: sanitizeRoleFitForClient(session.interviewPlan.roleFit),
    questionPool: sanitizeQuestionPoolForClient(session.interviewPlan.questionPool || []),
  } : session.interviewPlan,
  transcript: Array.isArray(session.transcript)
    ? session.transcript.map((turn) => {
      const {
        questionId: _questionId,
        preparedQuestionId: _preparedQuestionId,
        rootQuestionId: _rootQuestionId,
        ...safeTurn
      } = turn;
      return {
        ...safeTurn,
        metadata: sanitizeTranscriptMetadataForClient(turn.metadata),
      };
    })
    : [],
});
const isNonEmptyObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
const buildAnalysisSetupCv = (cvDocument) => {
  if (!cvDocument) return null;

  const display = cvDocument.displayProfile || {};
  const profile = cvDocument.cvProfile || null;
  const fileId = cvDocument.fileId || display.fileId || null;
  if (!fileId) return null;

  return {
    id: fileId,
    name: display.name || 'Selected CV',
    size: '',
    updated: display.uploadedAt || '',
    type: display.type || '',
    parseStatus: cvDocument.parseStatus || display.parseStatus || 'completed',
    profileStatus: profile ? 'completed' : display.profileStatus || 'pending',
    parseConfidence: cvDocument.parseConfidence ?? profile?.confidence ?? null,
    parseWarnings: cvDocument.parseWarnings || [],
    candidateName: profile?.candidateName || display.candidateName || 'Candidate',
    topSkills: display.topSkills || [],
    summary: display.summary || profile?.summary || '',
    warnings: display.warnings || cvDocument.parseWarnings || [],
    profile,
    display,
  };
};

const resolveStructuredJdRubric = (normalizedAnalysis = {}, analysis = {}) => [
  normalizedAnalysis?.parsedJdProfile,
  normalizedAnalysis?.matchingDetails?.rubric,
  analysis?.jdRubric,
].find(isNonEmptyObject) || {};

const buildAnalysisSetup = ({ baseSession, plan, analysis, normalizedAnalysis, cvDocument, jobDescriptionInput }) => {
  const selectedCV = buildAnalysisSetupCv(cvDocument);
  const rawJD = jobDescriptionInput?.raw_text || jobDescriptionInput?.redacted_text || '';
  const structuredJD = analysis?.jdStructuredText || '';
  const structuredJDRubric = resolveStructuredJdRubric(normalizedAnalysis, analysis);

  return {
    selectedCV,
    rawJD,
    structuredJD,
    structuredJDRubric,
    summarizedRawJD: rawJD,
    cvReviewStatus: selectedCV ? 'verified' : 'unreviewed',
    cvHumanReviewedFileId: selectedCV?.id || baseSession.cvFileId || '',
    jdReviewStatus: Object.keys(structuredJDRubric).length ? 'verified' : 'unreviewed',
    jdHumanReviewedRawJD: rawJD,
    settings: plan?.settingsSnapshot || baseSession.settings,
    sessionMode: baseSession.mode || 'text',
    roleFitDiagnostics: sanitizeRoleFitDiagnostics(normalizedAnalysis.roleFitDiagnostics || {}),
  };
};

const buildTranscriptDisplayText = (turn = {}) => {
  const preamble = String(turn?.metadata?.preamble || '').trim();
  const text = String(turn?.text || '').trim();
  if (turn?.role === 'ai' && preamble && text) return `${preamble}

${text}`;
  return text;
};

const mapTranscriptTurns = (transcript) => transcript?.turns?.map((turn) => ({
  role: turn.role,
  text: turn.text,
  displayText: buildTranscriptDisplayText(turn),
  timestamp: new Date(turn.timestamp).toISOString(),
  metadata: sanitizeTranscriptMetadataForClient(turn.metadata),
})) || [];

export const buildSessionDetails = ({ row, plan, transcript, analysis, report, cvDocument, jobDescriptionInput }) => {
  const baseSession = mapSessionRow(row);
  const normalizedAnalysis = normalizeAnalysisResult(analysis);
  const clientAnalysis = sanitizeAnalysisForSession(normalizedAnalysis, baseSession.status);
  const validatedPlan = plan ? validateInterviewPlan(plan) : null;
  const roleMeta = buildCanonicalRoleMeta({
    resolvedTargetRole: row.target_role,
    normalizedAnalysis,
    settings: plan?.settingsSnapshot || baseSession.settings,
  });

  return {
    ...baseSession,
    displayTitle: roleMeta.displayTitle,
    compactRoleLabel: roleMeta.compactRoleLabel,
    canonicalRole: roleMeta.canonicalRole,
    roleFamily: roleMeta.roleFamily,
    interviewModeKey: roleMeta.interviewModeKey,
    settings: plan?.settingsSnapshot || baseSession.settings,
    analysisResult: clientAnalysis,
    interviewPlan: validatedPlan ? {
      ...validatedPlan,
      roleFit: sanitizeRoleFitForClient(validatedPlan.roleFit),
      questionPool: sanitizeQuestionPoolForClient(validatedPlan.questionPool || []),
    } : null,
    hasReport: Boolean(report?.report),
    reportStatus: report?.latestStatus || null,
    cvProfile: cvDocument?.cvProfile || null,
    cvDisplay: cvDocument?.displayProfile || null,
    analysisSetup: buildAnalysisSetup({ baseSession, plan, analysis, normalizedAnalysis, cvDocument, jobDescriptionInput }),
    transcript: mapTranscriptTurns(transcript),
  };
};

export const buildSessionListItem = ({ row, plan, report, analysis }) => {
  const normalizedAnalysis = normalizeAnalysisResult(analysis);
  const matchSummary = normalizedAnalysis?.matchSummary || {};
  const roleMeta = buildCanonicalRoleMeta({
    resolvedTargetRole: row.target_role || plan?.jobTitle || matchSummary.jobTitle || '',
    normalizedAnalysis,
    settings: plan?.settingsSnapshot || { seniorityLevel: row.seniority_level, focusArea: row.focus_area },
  });
  const roleLabel = roleMeta.compactRoleLabel || row.target_role || matchSummary.jobTitle || plan?.jobTitle || 'Interview Session';
  const displayTitle = extractDisplayTitle(
    roleMeta.displayTitle,
    matchSummary.jobTitle,
    plan?.jobTitle,
    normalizedAnalysis?.parsedJdProfile?.title,
    normalizedAnalysis?.parsedJdProfile?.jobTitle,
    roleLabel
  );
  const reportOverallScore = report?.report?.scores?.overall;
  const displayScore = Number.isFinite(Number(reportOverallScore))
    ? Number(reportOverallScore)
    : Number.isFinite(Number(row.overall_score))
      ? Number(row.overall_score)
      : Number.isFinite(Number(matchSummary.matchScore))
        ? Number(matchSummary.matchScore)
        : null;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    targetRole: roleLabel,
    candidateName: row.candidate_name,
    overallScore: reportOverallScore ?? row.overall_score,
    displayScore,
    totalQuestions: row.total_questions,
    currentQuestionIndex: row.current_question_index,
    controlMode: row.control_mode || 'question_limited',
    questionType: row.question_type || row.focus_area || 'combined',
    questionLimit: row.question_limit || row.total_questions,
    timeLimitSeconds: row.time_limit_seconds || null,
    completedBecause: row.completed_because || null,
    durationSeconds: row.duration_seconds ?? row.elapsed_seconds ?? 0,
    planPreview: plan?.planPreview || matchSummary.planPreview || normalizedAnalysis?.explanation?.summary || '',
    scoreBand: report?.report?.candidateFeedback?.scoreBand || '',
    reportStatus: report?.latestStatus || null,
    hasReport: Boolean(report?.report),
    matchScore: matchSummary.matchScore ?? null,
    displayTitle: roleMeta.displayTitle || titleCaseWords(displayTitle),
    compactRoleLabel: roleMeta.compactRoleLabel || roleLabel,
    interviewModeKey: roleMeta.interviewModeKey,
  };
};

export const buildSessionPlanUpdatePayload = ({ current, data }) => {
  const normalizedAnalysis = data.analysisResult ? validateAnalyzeOutput(data.analysisResult) : current.analysisResult;
  if (!data.settings && !normalizedAnalysis) return null;

  return validateInterviewPlan({
    ...(data.settings ? { settingsSnapshot: data.settings } : {}),
    ...(normalizedAnalysis
      ? {
          candidateName: normalizedAnalysis.candidateName,
          jobTitle: normalizedAnalysis.jobTitle,
          matchScore: normalizedAnalysis.matchScore,
          confidence: normalizedAnalysis.confidence,
          decision: normalizedAnalysis.decision,
          requirementChecks: normalizedAnalysis.requirementChecks,
          explanation: normalizedAnalysis.explanation,
          strengths: normalizedAnalysis.strengths,
          gaps: normalizedAnalysis.gaps,
          interviewFocus: normalizedAnalysis.interviewFocus,
          planPreview: normalizedAnalysis.planPreview,
          questionPool: buildInterviewPlanPayload({
            normalizedAnalysis,
            settings: data.settings || current.settings || {},
            resolvedCandidateName: normalizedAnalysis.candidateName || current.candidateName,
            resolvedTargetRole: current.displayTitle || normalizedAnalysis.jobTitle || current.targetRole,
          }).questionPool,
        }
      : {}),
  });
};
