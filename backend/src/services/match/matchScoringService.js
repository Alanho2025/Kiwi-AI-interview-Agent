import {
  buildExplanationItem,
  buildExplanationObject,
  buildRequirementItem,
  buildScoreItem,
  clampScore,
  requirementStatusToScore,
  roundScore,
} from '../scoringSchemaService.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { normalizeText, sumWeightedScores } from './matchShared.js';
import { computeSectionAwareMatch } from './sectionAwareMatchService.js';
import { computeCapabilityMatch } from './capabilityMatchService.js';
import { computeAchievementBoost } from './achievementBoostService.js';

const toPercent = (value) => clampScore(value * 100);
const STATUS_ORDER = { not_met: 0, inferred: 1, partial: 2, met: 3 };
const CORE_STACK_PATTERN = /c#|\.net|mvc|java(script)?|react|vue|angular|html|css|sql|aws|api|node|postgres/i;
const COMMERCIAL_EXPERIENCE_PATTERN = /\b\d+\+?\s+years?|professional experience|commercial experience/i;

const statusFromCombinedSignal = (status, combinedSignal) => {
  if (combinedSignal >= 1.45) return 'met';
  if (combinedSignal >= 0.9) return 'partial';
  if (combinedSignal > 0.2) return 'inferred';
  return status;
};

const statusMax = (statuses = []) => statuses.reduce((best, current) => (STATUS_ORDER[current] > STATUS_ORDER[best] ? current : best), 'not_met');
const statusMin = (statuses = []) => statuses.reduce((worst, current) => (STATUS_ORDER[current] < STATUS_ORDER[worst] ? current : worst), 'met');

const splitCompositeRequirement = (label = '') => {
  const raw = String(label || '').trim();
  if (!raw) return [];

  const extracted = [];
  const yearsMatch = raw.match(/\b\d+\+?\s+years? of professional experience/i);
  if (yearsMatch) extracted.push(yearsMatch[0]);

  const techWithMatch = raw.match(/with\s+(.+)$/i);
  if (techWithMatch?.[1]) {
    techWithMatch[1]
      .split(/,| and /i)
      .map((item) => item.replace(/[.;]+$/g, '').trim())
      .filter(Boolean)
      .forEach((item) => extracted.push(item));
  }

  if (!extracted.length && /,| and |\//i.test(raw)) {
    raw.split(/,| and |\//i)
      .map((item) => item.replace(/[.;]+$/g, '').trim())
      .filter((item) => item.length > 2)
      .forEach((item) => extracted.push(item));
  }

  return [...new Set(extracted.filter((item) => normalizeText(item) !== normalizeText(raw)))];
};

const describeEvidenceQuality = ({ requirementType = 'soft', status = 'not_met', matchedSection = '', matchedCapabilities = [], label = '', evidenceProfile = {} }) => {
  const projectOnly = matchedSection === 'projects';
  const transferableOnly = matchedCapabilities.length > 0 && !projectOnly && !['experience', 'skills'].includes(matchedSection);
  const isCommercialRequirement = COMMERCIAL_EXPERIENCE_PATTERN.test(label) || /c#|\.net|mvc/i.test(label);
  const hasCommercialSignals = Boolean((evidenceProfile.sections?.experience || []).length);

  if (status === 'met') return 'direct evidence found';
  if (isCommercialRequirement && projectOnly) return 'project-based evidence only';
  if (isCommercialRequirement && !hasCommercialSignals) return 'missing direct commercial proof';
  if (transferableOnly) return 'transferable evidence only';
  if (projectOnly) return 'project-based evidence only';
  if (status === 'partial') return requirementType === 'hard' ? 'partial direct evidence' : 'partial evidence found';
  if (status === 'inferred') return 'limited direct proof';
  return 'missing direct proof';
};

const computeEnhancedMatch = (label, criterionType, evidenceProfile) => {
  const sectionMatch = computeSectionAwareMatch({ label, criterionType, evidenceProfile });
  const capabilityMatch = computeCapabilityMatch({ label, evidenceProfile });
  const achievementBoost = computeAchievementBoost({ label, evidenceProfile });
  const combinedSignal = sectionMatch.scoreSignal + capabilityMatch.boost + achievementBoost.boost;
  const status = statusFromCombinedSignal(sectionMatch.status, combinedSignal);
  return {
    status,
    combinedSignal,
    matchedSection: sectionMatch.matchedSection,
    matchedCapabilities: capabilityMatch.matchedCapabilities,
    evidence: [
      ...sectionMatch.evidence,
      ...capabilityMatch.evidence,
      ...achievementBoost.evidence.map((item) => `Achievement evidence: ${item}`),
    ].filter(Boolean),
  };
};

const computeRequirementStatus = (requirement, evidenceProfile = {}) => {
  const childLabels = splitCompositeRequirement(requirement.label);
  const baseMatch = computeEnhancedMatch(requirement.label, 'requirement', evidenceProfile);

  if (!childLabels.length) {
    return {
      ...baseMatch,
      finalStatus: baseMatch.status,
      detailNote: describeEvidenceQuality({
        requirementType: requirement.type,
        status: baseMatch.status,
        matchedSection: baseMatch.matchedSection,
        matchedCapabilities: baseMatch.matchedCapabilities,
        label: requirement.label,
        evidenceProfile,
      }),
    };
  }

  const childMatches = childLabels.map((label) => ({ label, ...computeEnhancedMatch(label, 'requirement', evidenceProfile) }));
  const statuses = childMatches.map((item) => item.status);
  const metCount = childMatches.filter((item) => item.status === 'met').length;
  const partialishCount = childMatches.filter((item) => ['met', 'partial'].includes(item.status)).length;

  let finalStatus = 'not_met';
  if (metCount === childMatches.length) finalStatus = 'met';
  else if (partialishCount >= Math.max(1, Math.ceil(childMatches.length / 2))) finalStatus = 'partial';
  else if (statusMax(statuses) !== 'not_met') finalStatus = 'inferred';

  if (COMMERCIAL_EXPERIENCE_PATTERN.test(requirement.label) && childMatches.some((item) => /c#|\.net|mvc/i.test(item.label) && item.status === 'not_met')) {
    finalStatus = finalStatus === 'met' ? 'partial' : statusMin([finalStatus, 'partial']);
  }

  if (CORE_STACK_PATTERN.test(requirement.label) && childMatches.filter((item) => item.status === 'not_met').length >= 2) {
    finalStatus = finalStatus === 'met' ? 'partial' : finalStatus;
  }

  const allEvidence = [
    ...baseMatch.evidence,
    ...childMatches.flatMap((item) => item.evidence.map((entry) => `${item.label}: ${entry}`)),
  ];

  const matchedSection = childMatches.find((item) => item.status === 'met')?.matchedSection
    || childMatches.find((item) => item.status === 'partial')?.matchedSection
    || baseMatch.matchedSection;
  const matchedCapabilities = [...new Set(childMatches.flatMap((item) => item.matchedCapabilities || []))];
  const childSummary = childMatches.map((item) => `${item.label}=${item.status}`).join('; ');

  return {
    ...baseMatch,
    finalStatus,
    matchedSection,
    matchedCapabilities,
    evidence: allEvidence,
    detailNote: `${describeEvidenceQuality({
      requirementType: requirement.type,
      status: finalStatus,
      matchedSection,
      matchedCapabilities,
      label: requirement.label,
      evidenceProfile,
    })}; coverage: ${childSummary}`,
  };
};

export const buildMacroScores = (macroCriteria = [], _cvText, weights = {}, evidenceProfile = {}) =>
  macroCriteria.map((criterion) => {
    const match = computeEnhancedMatch(criterion.label, 'macro', evidenceProfile);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.68 : match.status === 'inferred' ? 0.38 : 0),
      weight: weights?.macro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: `${match.status}; section=${match.matchedSection}; capabilities=${match.matchedCapabilities.join(', ')}`,
      criterionType: 'macro',
    });
  });

export const buildMicroScores = (microCriteria = [], _cvText, weights = {}, evidenceProfile = {}) =>
  microCriteria.map((criterion) => {
    const match = computeEnhancedMatch(criterion.label, 'micro', evidenceProfile);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.7 : match.status === 'inferred' ? 0.4 : 0),
      weight: weights?.micro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: `${match.status}; section=${match.matchedSection}; capabilities=${match.matchedCapabilities.join(', ')}`,
      criterionType: 'micro',
    });
  });

export const buildRequirementChecks = (requirements = [], _cvText, evidenceProfile = {}) =>
  requirements.map((requirement) => {
    const match = computeRequirementStatus(requirement, evidenceProfile);
    return buildRequirementItem({
      label: requirement.label,
      type: requirement.type || 'soft',
      importance: requirement.importance || 'medium',
      status: match.finalStatus,
      evidence: [...(requirement.evidence || []), ...match.evidence],
      sourceChunks: requirement.sourceChunks || [],
      notes: `section=${match.matchedSection}; capabilities=${match.matchedCapabilities.join(', ') || 'none'}; ${match.detailNote}`,
    });
  });

export const calculateScoreBreakdown = ({ rubric, macroScores, microScores, requirementChecks }) => {
  const macroScore = sumWeightedScores(macroScores);
  const microScore = sumWeightedScores(microScores);
  const requirementScore = requirementChecks.length === 0
    ? 0
    : sumWeightedScores(
        requirementChecks.map((item) => ({
          score: requirementStatusToScore(item.status) * 100,
          weight: item.importance === 'high' ? 1.5 : item.importance === 'low' ? 0.75 : 1,
        }))
      );
  const overallScore = macroScore * (rubric.weights?.overall?.macro ?? 0.45)
    + microScore * (rubric.weights?.overall?.micro ?? 0.35)
    + requirementScore * (rubric.weights?.overall?.requirements ?? 0.2);

  return { macroScore, microScore, requirementScore, overallScore };
};

export const buildLegacyWeightedBreakdown = ({ macroScore, microScore, requirementScore, requirementChecks }) => {
  const hardItems = requirementChecks.filter((item) => item.type === 'hard');
  const softItems = requirementChecks.filter((item) => item.type !== 'hard');
  const metHard = hardItems.filter((item) => item.status === 'met').length;
  const metSoft = softItems.filter((item) => item.status === 'met').length;
  return {
    softSkills: { label: 'Soft Skill Requirement', weight: 25, rawRatio: roundScore(microScore / 100, 4), score: clampScore(microScore * 0.25), matchedCount: metSoft, totalCount: softItems.length },
    technicalSkills: { label: 'Technical Skill Requirement', weight: 35, rawRatio: roundScore(microScore / 100, 4), score: clampScore(microScore * 0.35), matchedCount: metHard, totalCount: hardItems.length || softItems.length },
    qualificationMatch: { label: 'Qualification / Requirement Match', weight: 20, rawRatio: roundScore(requirementScore / 100, 4), score: clampScore(requirementScore * 0.2), matchedCount: metHard, totalCount: hardItems.length },
    rolesMatch: { label: 'Role / Macro Match', weight: 20, rawRatio: roundScore(macroScore / 100, 4), score: clampScore(macroScore * 0.2), matchedCount: Math.round((macroScore / 100) * 4), totalCount: 4 },
  };
};

export const buildExplanation = ({ microScores, requirementChecks, cvEvidenceProfile = {} }) => {
  const achievementLabels = new Set((cvEvidenceProfile.achievements || []).map((item) => item.text));
  const capabilityStrengths = (cvEvidenceProfile.functionalCapabilities || []).slice(0, 3).map((item) => buildExplanationItem({ label: item.replace(/_/g, ' '), detail: 'Transferable capability signal' }));
  const strengths = [
    ...microScores
      .filter((item) => item.score >= 75)
      .slice(0, 4)
      .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Strong matched criterion' })),
    ...capabilityStrengths,
  ].slice(0, 5);

  const gaps = requirementChecks
    .filter((item) => item.status !== 'met')
    .filter((item) => item.status === 'not_met' || item.importance === 'high' || /missing direct commercial proof|limited direct proof|project-based evidence only/.test(item.notes || ''))
    .slice(0, 5)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: item.status === 'not_met' ? 'Direct evidence not found' : item.notes || 'Direct proof is limited' }));

  const risks = requirementChecks
    .filter((item) => item.type === 'hard' && item.status !== 'met')
    .concat(
      requirementChecks.filter((item) => item.status === 'inferred' && /c#|\.net|mvc|professional experience|commercial experience/i.test(item.label))
    )
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: item.status === 'inferred' ? 'Core requirement relies on limited proof' : 'Hard requirement risk' }));

  const summary = strengths.length > 0
    ? `Top matched areas: ${strengths.map((item) => item.label).join(', ')}. Transferable and project-based evidence were included, but direct proof gaps still matter for core stack requirements.`
    : 'Limited strong matches were found, so the interview should probe direct stack evidence, transferable experience, and project depth.';
  const explanation = buildExplanationObject({ strengths, gaps, risks, summary, achievementCount: achievementLabels.size });
  return { strengths, gaps, risks, explanation };
};
