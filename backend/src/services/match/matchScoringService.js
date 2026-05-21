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
import { getSemanticMatchesForLabel } from './semanticEvidenceService.js';

const toPercent = (value) => clampScore(value * 100);
const STATUS_ORDER = { not_met: 0, inferred: 1, partial: 2, met: 3 };
const CORE_STACK_PATTERN = /c#|\.net|mvc|java(script)?|react|vue|angular|html|css|sql|aws|api|node|postgres/i;
const COMMERCIAL_EXPERIENCE_PATTERN = /\b\d+\+?\s+years?|professional experience|commercial experience/i;
const DEGREE_PATTERN = /computer science|software engineering|tertiary qualification|degree|bachelor|master/i;
const SECTION_EVIDENCE_STRENGTH = {
  experience: 'strong',
  projects: 'strong',
  education: 'partial',
  volunteer: 'partial',
  keyCompetencies: 'weak',
  skills: 'weak',
  personalStatement: 'weak',
};
const EVIDENCE_STRENGTH_ORDER = { missing: 0, weak: 1, partial: 2, strong: 3 };

const statusFromCombinedSignal = (status, combinedSignal) => {
  if (combinedSignal >= 1.45) return 'met';
  if (combinedSignal >= 0.9) return 'partial';
  if (combinedSignal > 0.2) return 'inferred';
  return status;
};

const statusMax = (statuses = []) => statuses.reduce((best, current) => (STATUS_ORDER[current] > STATUS_ORDER[best] ? current : best), 'not_met');
const statusMin = (statuses = []) => statuses.reduce((worst, current) => (STATUS_ORDER[current] < STATUS_ORDER[worst] ? current : worst), 'met');

const evidenceStrengthMax = (values = []) => values.reduce((best, current) => (
  (EVIDENCE_STRENGTH_ORDER[current] || 0) > (EVIDENCE_STRENGTH_ORDER[best] || 0) ? current : best
), 'missing');

const topSemanticMatch = (semanticMatches = []) => semanticMatches[0] || null;

const statusFromSemanticMatch = (match = null) => {
  if (!match) return 'not_met';
  if (match.evidenceStrength === 'strong' && match.score >= 0.74) return 'met';
  if (match.score >= 0.56) return 'partial';
  if (match.score >= 0.34) return 'inferred';
  return 'not_met';
};

const semanticBoost = (match = null) => {
  if (!match) return 0;
  if (match.evidenceStrength === 'strong' && match.score >= 0.74) return 0.8;
  if (match.score >= 0.56) return 0.45;
  if (match.score >= 0.34) return 0.22;
  return 0;
};

const semanticEvidenceStrings = (semanticMatches = []) => semanticMatches
  .slice(0, 3)
  .map((item) => `Semantic evidence (${item.evidenceStrength || 'weak'}, ${Number(item.score || 0).toFixed(2)}): ${item.text}`)
  .filter(Boolean);

const inferEvidenceStrength = ({ matchedSection = '', semanticMatches = [], status = 'not_met' } = {}) => {
  if (status === 'not_met') return 'missing';
  const sectionStrength = SECTION_EVIDENCE_STRENGTH[matchedSection] || 'weak';
  const semanticStrength = topSemanticMatch(semanticMatches)?.evidenceStrength || 'missing';
  return evidenceStrengthMax([sectionStrength, semanticStrength]);
};

const splitCompositeRequirement = (label = '') => {
  const raw = String(label || '').trim().replace(/[.;]+$/g, '');
  if (!raw) return [];

  if (/recent tertiary qualification/i.test(raw)) return ['tertiary qualification', 'computer science', 'software engineering'];
  if (/communicate clearly and learn quickly/i.test(raw)) return ['communication', 'learn quickly'];
  if (/good communication and ownership/i.test(raw)) return ['communication', 'ownership'];
  if (/azure or ci\/?cd pipelines/i.test(raw)) return ['azure', 'ci/cd pipelines'];

  const cleaned = raw
    .replace(/^foundations in\s+/i, '')
    .replace(/^strong experience with\s+/i, '')
    .replace(/^experience with\s+/i, '')
    .replace(/^exposure to\s+/i, '')
    .replace(/^ability to\s+/i, '')
    .replace(/^good\s+/i, '');

  const parts = cleaned
    .split(/,|\bor\b|\band\b|\//i)
    .map((item) => item.replace(/[.;]+$/g, '').trim())
    .filter((item) => item.length > 1);

  return [...new Set(parts.filter((item) => normalizeText(item) !== normalizeText(raw)))];
};

const describeEvidenceQuality = ({ requirementType = 'soft', status = 'not_met', matchedSection = '', matchedCapabilities = [], label = '', evidenceProfile = {}, evidenceStrength = 'missing' }) => {
  const projectOnly = matchedSection === 'projects';
  const transferableOnly = matchedCapabilities.length > 0 && !projectOnly && !['experience', 'skills', 'education'].includes(matchedSection);
  const isCommercialRequirement = COMMERCIAL_EXPERIENCE_PATTERN.test(label);
  const isDegreeRequirement = DEGREE_PATTERN.test(label);
  const hasCommercialSignals = Boolean((evidenceProfile.sections?.experience || []).length);

  if (status === 'met') return `direct evidence found; evidenceStrength=${evidenceStrength}`;
  if (isDegreeRequirement && matchedSection === 'education') return 'education evidence found';
  if (isCommercialRequirement && projectOnly) return 'project evidence is stronger than commercial delivery proof';
  if (isCommercialRequirement && !hasCommercialSignals) return 'missing direct commercial proof';
  if (transferableOnly) return 'transferable evidence only';
  if (projectOnly) return 'project-based evidence only';
  if (matchedSection === 'skills' && evidenceStrength === 'weak') return 'skills-list evidence only; interviewer should validate applied depth';
  if (status === 'partial') return requirementType === 'hard' ? 'partial direct evidence' : 'partial evidence found';
  if (status === 'inferred') return 'limited direct proof';
  return 'missing direct proof';
};

const computeEnhancedMatch = (label, criterionType, evidenceProfile, semanticEvidenceContext = {}) => {
  const sectionMatch = computeSectionAwareMatch({ label, criterionType, evidenceProfile });
  const capabilityMatch = computeCapabilityMatch({ label, evidenceProfile });
  const achievementBoost = computeAchievementBoost({ label, evidenceProfile });
  const semanticMatches = getSemanticMatchesForLabel(semanticEvidenceContext, label);
  const bestSemanticMatch = topSemanticMatch(semanticMatches);
  const semanticStatus = statusFromSemanticMatch(bestSemanticMatch);
  const combinedSignal = sectionMatch.scoreSignal + capabilityMatch.boost + achievementBoost.boost + semanticBoost(bestSemanticMatch);
  const status = statusMax([statusFromCombinedSignal(sectionMatch.status, combinedSignal), semanticStatus]);
  const evidenceStrength = inferEvidenceStrength({
    matchedSection: sectionMatch.matchedSection,
    semanticMatches,
    status,
  });
  return {
    status,
    combinedSignal,
    matchedSection: sectionMatch.matchedSection,
    matchedCapabilities: capabilityMatch.matchedCapabilities,
    evidenceStrength,
    semanticMatches,
    evidence: [
      ...sectionMatch.evidence,
      ...capabilityMatch.evidence,
      ...achievementBoost.evidence.map((item) => `Achievement evidence: ${item}`),
      ...semanticEvidenceStrings(semanticMatches),
    ].filter(Boolean),
  };
};

const applyEvidenceStrengthPolicy = ({ requirement = {}, finalStatus = 'not_met', matchedSection = '', evidenceStrength = 'missing', semanticMatches = [] } = {}) => {
  let nextStatus = finalStatus;
  const bestSemantic = topSemanticMatch(semanticMatches);

  if (requirement.type === 'hard' && matchedSection === 'skills' && evidenceStrength === 'weak') {
    nextStatus = nextStatus === 'met' ? 'partial' : nextStatus;
  }

  if (requirement.type === 'hard' && bestSemantic?.sourceType === 'skill' && !['experience', 'project_outcome', 'project_responsibility'].includes(bestSemantic.sourceType)) {
    nextStatus = nextStatus === 'met' ? 'partial' : nextStatus;
  }

  if (COMMERCIAL_EXPERIENCE_PATTERN.test(requirement.label) && matchedSection === 'projects') {
    nextStatus = nextStatus === 'met' ? 'partial' : nextStatus;
  }

  return nextStatus;
};

const computeRequirementStatus = (requirement, evidenceProfile = {}, semanticEvidenceContext = {}) => {
  const childLabels = splitCompositeRequirement(requirement.label);
  const baseMatch = computeEnhancedMatch(requirement.label, 'requirement', evidenceProfile, semanticEvidenceContext);

  if (!childLabels.length) {
    const finalStatus = applyEvidenceStrengthPolicy({
      requirement,
      finalStatus: baseMatch.status,
      matchedSection: baseMatch.matchedSection,
      evidenceStrength: baseMatch.evidenceStrength,
      semanticMatches: baseMatch.semanticMatches,
    });
    return {
      ...baseMatch,
      finalStatus,
      detailNote: describeEvidenceQuality({
        requirementType: requirement.type,
        status: finalStatus,
        matchedSection: baseMatch.matchedSection,
        matchedCapabilities: baseMatch.matchedCapabilities,
        label: requirement.label,
        evidenceProfile,
        evidenceStrength: baseMatch.evidenceStrength,
      }),
    };
  }

  const childMatches = childLabels.map((label) => ({ label, ...computeEnhancedMatch(label, 'requirement', evidenceProfile, semanticEvidenceContext) }));
  const statuses = childMatches.map((item) => item.status);
  const metCount = childMatches.filter((item) => item.status === 'met').length;
  const partialishCount = childMatches.filter((item) => ['met', 'partial'].includes(item.status)).length;

  let finalStatus = 'not_met';
  if (metCount === childMatches.length) finalStatus = 'met';
  else if (partialishCount >= Math.max(1, Math.ceil(childMatches.length / 2))) finalStatus = 'partial';
  else if (statusMax(statuses) !== 'not_met') finalStatus = 'inferred';

  if (COMMERCIAL_EXPERIENCE_PATTERN.test(requirement.label) && childMatches.some((item) => item.status === 'not_met')) {
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
  const semanticMatches = [
    ...baseMatch.semanticMatches,
    ...childMatches.flatMap((item) => item.semanticMatches || []),
  ];
  const evidenceStrength = evidenceStrengthMax([
    baseMatch.evidenceStrength,
    ...childMatches.map((item) => item.evidenceStrength),
  ]);
  finalStatus = applyEvidenceStrengthPolicy({
    requirement,
    finalStatus,
    matchedSection,
    evidenceStrength,
    semanticMatches,
  });

  return {
    ...baseMatch,
    finalStatus,
    matchedSection,
    matchedCapabilities,
    evidenceStrength,
    semanticMatches,
    evidence: allEvidence,
    detailNote: `${describeEvidenceQuality({
      requirementType: requirement.type,
      status: finalStatus,
      matchedSection,
      matchedCapabilities,
      label: requirement.label,
      evidenceProfile,
      evidenceStrength,
    })}; coverage: ${childSummary}`,
  };
};

export const buildMacroScores = (macroCriteria = [], _cvText, weights = {}, evidenceProfile = {}, semanticEvidenceContext = {}) =>
  macroCriteria.map((criterion) => {
    const match = computeEnhancedMatch(criterion.label, 'macro', evidenceProfile, semanticEvidenceContext);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.68 : match.status === 'inferred' ? 0.38 : 0),
      weight: weights?.macro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: `${match.status}; section=${match.matchedSection}; capabilities=${match.matchedCapabilities.join(', ')}; evidenceStrength=${match.evidenceStrength}`,
      criterionType: 'macro',
    });
  });

export const buildMicroScores = (microCriteria = [], _cvText, weights = {}, evidenceProfile = {}, semanticEvidenceContext = {}) =>
  microCriteria.map((criterion) => {
    const match = computeEnhancedMatch(criterion.label, 'micro', evidenceProfile, semanticEvidenceContext);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.7 : match.status === 'inferred' ? 0.4 : 0),
      weight: weights?.micro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: `${match.status}; section=${match.matchedSection}; capabilities=${match.matchedCapabilities.join(', ')}; evidenceStrength=${match.evidenceStrength}`,
      criterionType: 'micro',
    });
  });

export const buildRequirementChecks = (requirements = [], _cvText, evidenceProfile = {}, semanticEvidenceContext = {}) =>
  requirements.map((requirement) => {
    const match = computeRequirementStatus(requirement, evidenceProfile, semanticEvidenceContext);
    return buildRequirementItem({
      label: requirement.label,
      type: requirement.type || 'soft',
      importance: requirement.importance || 'medium',
      status: match.finalStatus,
      evidence: [...(requirement.evidence || []), ...match.evidence],
      sourceChunks: requirement.sourceChunks || [],
      notes: `section=${match.matchedSection}; capabilities=${match.matchedCapabilities.join(', ') || 'none'}; evidenceStrength=${match.evidenceStrength}; ${match.detailNote}`,
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

const CAPABILITY_EVIDENCE_PATTERNS = {
  documentation: /document|runbook|knowledge base|procedure/i,
  ownership: /owned|owning|responsible|end-to-end/i,
  automation: /automate|automation|pipeline|ci\/cd/i,
  stakeholder_collaboration: /stakeholder|communicat|presented|status updates|cross-functional/i,
  troubleshooting: /troubleshoot|incident|root cause|debug/i,
};

const buildCapabilityStrengths = (cvEvidenceProfile = {}) => {
  const capabilityLabels = cvEvidenceProfile.functionalCapabilities || [];
  const evidenceItems = cvEvidenceProfile.evidenceItems || [];
  return capabilityLabels
    .map((capability) => {
      const pattern = CAPABILITY_EVIDENCE_PATTERNS[capability];
      if (!pattern) return null;
      const evidence = evidenceItems.filter((item) => pattern.test(item.text || '')).slice(0, 2).map((item) => item.text);
      if (!evidence.length) return null;
      return buildExplanationItem({ label: capability.replace(/_/g, ' '), evidence, detail: 'Grounded transferable capability' });
    })
    .filter(Boolean);
};

const buildStrengths = (microScores = [], requirementChecks = [], cvEvidenceProfile = {}) => {
  const groundedMicro = microScores
    .filter((item) => item.score >= 72 && (item.evidence || []).length > 0)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Direct matched evidence found' }));
  const capabilityStrengths = buildCapabilityStrengths(cvEvidenceProfile);
  const requirementStrengths = requirementChecks
    .filter((item) => ['met', 'partial'].includes(item.status) && (item.evidence || []).length > 0)
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: item.status === 'met' ? 'Requirement is well supported' : 'Requirement is mostly supported' }));
  const seen = new Set();
  return [...groundedMicro.slice(0, 5), ...capabilityStrengths, ...requirementStrengths].filter((item) => {
    const key = normalizeTaxonomyLabel(item.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
};

const buildGapLabel = (item = {}) => {
  if (/communication and ownership/i.test(item.label)) return 'Limited direct evidence of communication and ownership';
  if (/communicate clearly and learn quickly/i.test(item.label)) return 'Limited direct evidence of communication and learning agility';
  if (/recent tertiary qualification/i.test(item.label)) return 'Qualification evidence needs clearer education grounding';
  return item.status === 'not_met' ? `Missing evidence for ${item.label}` : `Limited direct evidence for ${item.label}`;
};

const buildRiskLabel = (item = {}) => {
  if (/communication and ownership/i.test(item.label)) return 'Readiness risk for communication-heavy ownership work';
  if (/communicate clearly and learn quickly/i.test(item.label)) return 'Interview should validate communication and learning speed';
  if (/recent tertiary qualification/i.test(item.label)) return 'Resume should surface the degree evidence more clearly';
  if (/production/i.test(item.label)) return `Interview should validate ${item.label}`;
  if (/commercial experience|professional experience/i.test(item.label)) return 'May need ramp-up before owning commercial delivery independently';
  if (/skills-list evidence only/.test(item.notes || '')) return `Interview should validate applied ${item.label} experience`;
  return `Interview should validate readiness for ${item.label}`;
};

export const buildExplanation = ({ microScores, requirementChecks, cvEvidenceProfile = {} }) => {
  const achievementLabels = new Set((cvEvidenceProfile.achievements || []).map((item) => item.text));
  const strengths = buildStrengths(microScores, requirementChecks, cvEvidenceProfile);

  const gaps = requirementChecks
    .filter((item) => item.status !== 'met')
    .filter((item) => item.status === 'not_met' || item.importance === 'high' || /missing direct commercial proof|limited direct proof|project-based evidence only|partial direct evidence|skills-list evidence only/.test(item.notes || ''))
    .slice(0, 5)
    .map((item) => buildExplanationItem({ label: buildGapLabel(item), evidence: item.evidence, detail: item.notes || 'Direct proof is limited' }));

  const risks = requirementChecks
    .filter((item) => item.type === 'hard' && (
      ['not_met', 'inferred'].includes(item.status)
      || /skills-list evidence only/.test(item.notes || '')
      || (item.status !== 'met' && /production|commercial experience|professional experience/i.test(item.label || ''))
    ))
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: buildRiskLabel(item), evidence: item.evidence, detail: item.status === 'not_met' ? 'This could block independent performance early on' : 'This still needs interview validation' }));

  const hasProjectHeavyGap = requirementChecks.some((item) => /project-based evidence only/.test(item.notes || ''));
  const summary = strengths.length > 0
    ? `Top matched areas: ${strengths.map((item) => item.label).join(', ')}. ${hasProjectHeavyGap ? 'Project-based evidence is helping, but direct commercial proof still needs validation.' : 'The profile shows useful evidence, but interviewers should still check any direct-proof gaps before treating it as fully job-ready.'}`
    : 'Limited strong matches were found, so the interview should probe direct stack evidence, transferable experience, and project depth.';
  const explanation = buildExplanationObject({ strengths, gaps, risks, summary, achievementCount: achievementLabels.size });
  return { strengths, gaps, risks, explanation };
};
