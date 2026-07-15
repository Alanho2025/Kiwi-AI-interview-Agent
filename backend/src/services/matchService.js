/**
 * File responsibility: Service module.
 */
import { buildCvProfile } from './match/matchShared.js';
import { normalizeRubric } from './match/matchRubricService.js';
import {
  buildMacroScores,
  buildMicroScores,
  buildRequirementChecks,
  calculateScoreBreakdown,
} from './match/matchScoringService.js';
import { buildExplanation } from './match/matchResultFormatter.js';
import { buildCapabilityScoreBreakdown } from './match/capabilityScoreService.js';
import { buildQuestionPlanHints } from './match/questionPlanService.js';
import { buildAnalyzeResult } from './match/matchResultBuilder.js';
import { buildCvAnalysis, buildJdMatchedCvAnalysis } from './cv/cvAnalysisBuilderService.js';
import { buildCvEvidenceProfile } from './cv/cvEvidenceProfileBuilder.js';
import { buildTransitionProfile } from './match/transitionAwareScoring.js';
import { buildSemanticEvidenceContext } from './match/semanticEvidenceService.js';
import { buildUniversalRoleProfile } from './jobDescription/jdUniversalParserService.js';
import { judgeRequirementEvidenceBatch } from './match/evidenceJudgeService.js';
import { buildRoleEvidenceMap } from './match/roleEvidenceMapService.js';
import { markMatchStep, measureMatchStep } from './match/matchPerformanceTraceService.js';

const isSemanticEngineEnabled = (settings = {}) => settings.matchEngine === 'semantic' || process.env.MATCH_ENGINE === 'semantic';

const isCompanyContextRequirement = (item = {}) => {
  const text = String(item.text || item.label || '').replace(/\s+/g, ' ').trim();
  if (item.category === 'company_context') return true;
  if (!/\b(this organisation|this organization|we are|we're|our company|our team|business unit|hiring team|about the hiring team|about us|well-established|auckland based technology business|investing heavily|strong engineering and product focus)\b/i.test(text)) {
    return false;
  }
  return !/\b(you will|you'll|you are|you have|candidate|engineer who|engineers who|looking for|must|required|responsible for|experience with|strong experience|ability to|proficient|familiar|knowledge of)\b/i.test(text);
};

const buildSemanticRequirements = (roleProfile = {}, fallbackRequirements = []) => {
  const universalRequirements = Array.isArray(roleProfile.requirements) ? roleProfile.requirements : [];
  if (!universalRequirements.length) return fallbackRequirements;
  return universalRequirements.filter((item) => !isCompanyContextRequirement(item)).map((item) => ({
    id: item.id,
    label: item.text || item.label,
    type: item.mustHave ? 'hard' : 'soft',
    importance: item.importance || (item.mustHave ? 'high' : 'medium'),
    category: item.category,
    capabilityGroup: item.capabilityGroup,
    mustHave: Boolean(item.mustHave),
    evidenceNeeded: item.evidenceNeeded,
    normalizedCapability: item.normalizedCapability,
    evidence: [],
    sourceChunks: [],
  }));
};

export const compareCvToJobDescription = async (cvInput, rawJD, jdRubric, settings = {}, context = {}) => {
  const performanceTrace = context.performanceTrace || null;
  const baseRubric = await measureMatchStep(
    performanceTrace,
    'normalize_jd_rubric',
    () => normalizeRubric(rawJD, jdRubric),
    { hasJdRubric: Boolean(jdRubric) },
  );
  const semanticEngineEnabled = isSemanticEngineEnabled(settings);
  const universalRoleProfile = semanticEngineEnabled
    ? await measureMatchStep(
        performanceTrace,
        'semantic_role_profile',
        () => buildUniversalRoleProfile({ rawJD, rubric: baseRubric }),
        { matchEngine: 'semantic' },
      )
    : null;
  if (!semanticEngineEnabled) {
    markMatchStep(performanceTrace, 'semantic_role_profile_skipped', { matchEngine: settings.matchEngine || 'default' });
  }
  const rubric = semanticEngineEnabled
    ? {
        ...baseRubric,
        universalRoleProfile,
        requirements: buildSemanticRequirements(universalRoleProfile, baseRubric.requirements || []),
        metadata: {
          ...(baseRubric.metadata || {}),
          matchEngine: 'semantic',
          universalRoleProfile,
        },
      }
    : baseRubric;
  const rawCvText = typeof cvInput === 'string' ? cvInput : cvInput?.normalizedText || '';
  const parsedCvProfile = cvInput?.cvProfile || buildCvProfile(rawCvText);
  const cvEvidenceProfile = cvInput?.evidenceProfile || parsedCvProfile.evidenceProfile || buildCvEvidenceProfile(parsedCvProfile, rawCvText);
  const baseCvAnalysis = parsedCvProfile.cvAnalysis || buildCvAnalysis({ cvProfile: parsedCvProfile, evidenceProfile: cvEvidenceProfile, normalizedText: rawCvText });
  const baseSemanticEvidenceContext = await measureMatchStep(
    performanceTrace,
    'semantic_evidence_context',
    () => buildSemanticEvidenceContext({ rubric, evidenceProfile: cvEvidenceProfile }),
    {
      requirementCount: Array.isArray(rubric.requirements) ? rubric.requirements.length : 0,
      cvEvidenceCount: Array.isArray(cvEvidenceProfile.functionalCapabilities) ? cvEvidenceProfile.functionalCapabilities.length : 0,
    },
  );
  const evidenceJudgements = semanticEngineEnabled
    ? await measureMatchStep(
        performanceTrace,
        'semantic_evidence_judge',
        () => judgeRequirementEvidenceBatch({ requirements: rubric.requirements, semanticEvidenceContext: baseSemanticEvidenceContext }),
        { requirementCount: Array.isArray(rubric.requirements) ? rubric.requirements.length : 0 },
      )
    : {};
  if (!semanticEngineEnabled) {
    markMatchStep(performanceTrace, 'semantic_evidence_judge_skipped', { matchEngine: settings.matchEngine || 'default' });
  }
  const semanticEvidenceContext = {
    ...baseSemanticEvidenceContext,
    evidenceJudgements,
  };

  const { macroScores, microScores, requirementChecks } = await measureMatchStep(performanceTrace, 'match_score_build', () => ({
    macroScores: buildMacroScores(rubric.macroCriteria, rawCvText, rubric.weights, cvEvidenceProfile, semanticEvidenceContext),
    microScores: buildMicroScores(rubric.microCriteria, rawCvText, rubric.weights, cvEvidenceProfile, semanticEvidenceContext),
    requirementChecks: buildRequirementChecks(rubric.requirements, rawCvText, cvEvidenceProfile, semanticEvidenceContext),
  }), {
    macroCount: Array.isArray(rubric.macroCriteria) ? rubric.macroCriteria.length : 0,
    microCount: Array.isArray(rubric.microCriteria) ? rubric.microCriteria.length : 0,
    requirementCount: Array.isArray(rubric.requirements) ? rubric.requirements.length : 0,
  });
  const roleEvidenceMap = await measureMatchStep(performanceTrace, 'role_evidence_map_build', () => buildRoleEvidenceMap({
    roleFitProfile: rubric.roleFit,
    requirementChecks,
    semanticEvidenceContext,
  }), { requirementCheckCount: requirementChecks.length });
  const baseScoreBreakdown = calculateScoreBreakdown({ rubric, macroScores, microScores, requirementChecks });
  const scoreBreakdown = semanticEngineEnabled
    ? buildCapabilityScoreBreakdown({ rubric, requirementChecks, fallbackScoreBreakdown: baseScoreBreakdown })
    : baseScoreBreakdown;
  const transitionProfile = buildTransitionProfile({ evidenceProfile: cvEvidenceProfile, parsedCvProfile });
  const { strengths, gaps, risks, explanation } = buildExplanation({ microScores, requirementChecks, cvEvidenceProfile });
  const cvAnalysis = buildJdMatchedCvAnalysis({ cvAnalysis: baseCvAnalysis, requirementChecks, microScores });
  const questionPlanHints = buildQuestionPlanHints({ rubric, requirementChecks, microScores, settings, cvEvidenceProfile, transitionProfile, cvAnalysis });

  return measureMatchStep(performanceTrace, 'match_result_build', () => buildAnalyzeResult({
    parsedCvProfile: {
      ...parsedCvProfile,
      evidenceProfile: cvEvidenceProfile,
      cvAnalysis,
    },
    rubric,
    macroScores,
    microScores,
    requirementChecks,
    scoreBreakdown,
    explanation,
    strengths,
    gaps,
    risks,
    questionPlanHints,
    transitionProfile,
    cvEvidenceProfile,
    cvAnalysis,
    semanticEvidenceContext,
    roleEvidenceMap,
  }), {
    strengthsCount: strengths.length,
    gapsCount: gaps.length,
  });
};
