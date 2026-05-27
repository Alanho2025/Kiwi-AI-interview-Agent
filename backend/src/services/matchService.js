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

export const compareCvToJobDescription = async (cvInput, rawJD, jdRubric, settings = {}) => {
  const baseRubric = await normalizeRubric(rawJD, jdRubric);
  const semanticEngineEnabled = isSemanticEngineEnabled(settings);
  const universalRoleProfile = semanticEngineEnabled
    ? await buildUniversalRoleProfile({ rawJD, rubric: baseRubric })
    : null;
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
  const baseSemanticEvidenceContext = await buildSemanticEvidenceContext({ rubric, evidenceProfile: cvEvidenceProfile });
  const evidenceJudgements = semanticEngineEnabled
    ? await judgeRequirementEvidenceBatch({ requirements: rubric.requirements, semanticEvidenceContext: baseSemanticEvidenceContext })
    : {};
  const semanticEvidenceContext = {
    ...baseSemanticEvidenceContext,
    evidenceJudgements,
  };

  const macroScores = buildMacroScores(rubric.macroCriteria, rawCvText, rubric.weights, cvEvidenceProfile, semanticEvidenceContext);
  const microScores = buildMicroScores(rubric.microCriteria, rawCvText, rubric.weights, cvEvidenceProfile, semanticEvidenceContext);
  const requirementChecks = buildRequirementChecks(rubric.requirements, rawCvText, cvEvidenceProfile, semanticEvidenceContext);
  const baseScoreBreakdown = calculateScoreBreakdown({ rubric, macroScores, microScores, requirementChecks });
  const scoreBreakdown = semanticEngineEnabled
    ? buildCapabilityScoreBreakdown({ rubric, requirementChecks, fallbackScoreBreakdown: baseScoreBreakdown })
    : baseScoreBreakdown;
  const transitionProfile = buildTransitionProfile({ evidenceProfile: cvEvidenceProfile, parsedCvProfile });
  const { strengths, gaps, risks, explanation } = buildExplanation({ microScores, requirementChecks, cvEvidenceProfile });
  const cvAnalysis = buildJdMatchedCvAnalysis({ cvAnalysis: baseCvAnalysis, requirementChecks, microScores });
  const questionPlanHints = buildQuestionPlanHints({ rubric, requirementChecks, microScores, settings, cvEvidenceProfile, transitionProfile, cvAnalysis });

  return buildAnalyzeResult({
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
  });
};