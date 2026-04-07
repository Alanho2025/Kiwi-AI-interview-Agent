import { buildStructuredJobDescriptionRubric } from './jobDescriptionService.js';
import {
  buildAnalyzeOutput,
  buildExplanationItem,
  buildExplanationObject,
  buildRequirementItem,
  buildScoreItem,
  clampScore,
  deriveDecision,
  requirementStatusToScore,
  roundScore,
} from './scoringSchemaService.js';
import { validateAnalyzeOutput } from './schemaValidationService.js';
import { normalizeTaxonomyLabel } from './taxonomyService.js';

const normalizeText = (text = '') => String(text || '').toLowerCase();
const tokenize = (text = '') => normalizeText(text).split(/[^a-z0-9+#.]+/).filter(Boolean);
const unique = (items = []) => [...new Set(items.filter(Boolean))];
const tokenSet = (text = '') => new Set(tokenize(text));

const extractCandidateName = (cvText = '') => {
  const firstLine = (cvText || '').split('\n').map((line) => line.trim()).find(Boolean) || '';
  if (/^[A-Za-z][A-Za-z' -]{1,60}$/.test(firstLine) && firstLine.split(/\s+/).length <= 4) return firstLine;
  return 'Candidate';
};

const computeItemMatch = (label, cvText) => {
  const normalizedCv = normalizeText(cvText);
  const labelText = String(label || '').toLowerCase().trim();
  const labelTokens = unique(tokenize(labelText));
  const cvTokens = tokenSet(normalizedCv);
  const directMatch = labelText.length > 2 && normalizedCv.includes(labelText);
  const overlap = labelTokens.filter((token) => cvTokens.has(token));
  const overlapRatio = labelTokens.length > 0 ? overlap.length / labelTokens.length : 0;

  let status = 'not_met';
  if (directMatch || overlapRatio >= 0.8) status = 'met';
  else if (overlapRatio >= 0.5) status = 'partial';
  else if (overlapRatio > 0) status = 'inferred';

  return {
    status,
    overlap,
    evidence: overlap.length > 0 ? [`Matched tokens: ${overlap.join(', ')}`] : [],
  };
};

const buildCvProfile = (cvText) => ({
  rawLength: cvText?.length || 0,
  tokenCount: tokenize(cvText).length,
  candidateName: extractCandidateName(cvText),
  evidencePreview: normalizeText(cvText).slice(0, 300),
});

const sumWeightedScores = (items = []) => {
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0) || 1;
  const weighted = items.reduce((sum, item) => sum + (Number(item.score) || 0) * (Number(item.weight) || 0), 0);
  return weighted / totalWeight;
};

const toPercent = (value) => clampScore(value * 100);

const buildLegacyWeightedBreakdown = ({ macroScore, microScore, requirementScore, requirementChecks }) => {
  const hardItems = requirementChecks.filter((item) => item.type === 'hard');
  const softItems = requirementChecks.filter((item) => item.type !== 'hard');
  const metHard = hardItems.filter((item) => item.status === 'met').length;
  const metSoft = softItems.filter((item) => item.status === 'met').length;
  return {
    softSkills: { label: 'Soft Skill Requirement', weight: 25, rawRatio: roundScore(microScore / 100, 4), score: clampScore(microScore * 0.25), matchedCount: metSoft, totalCount: softItems.length },
    technicalSkills: { label: 'Technical Skill Requirement', weight: 35, rawRatio: roundScore(microScore / 100, 4), score: clampScore(microScore * 0.35), matchedCount: metSoft, totalCount: softItems.length },
    qualificationMatch: { label: 'Qualification / Requirement Match', weight: 20, rawRatio: roundScore(requirementScore / 100, 4), score: clampScore(requirementScore * 0.2), matchedCount: metHard, totalCount: hardItems.length },
    rolesMatch: { label: 'Role / Macro Match', weight: 20, rawRatio: roundScore(macroScore / 100, 4), score: clampScore(macroScore * 0.2), matchedCount: Math.round((macroScore / 100) * 4), totalCount: 4 },
  };
};

const normalizeRubric = async (rawJD, jdRubric) => {
  if (jdRubric?.schemaVersion === 'v3' && jdRubric?.macroCriteria && jdRubric?.microCriteria) return jdRubric;
  if (jdRubric) {
    return await buildStructuredJobDescriptionRubric(rawJD || [jdRubric.title, ...(jdRubric.roleSummary || []), ...(jdRubric.qualifications || []), ...(jdRubric.mustHaveRequirements || []), ...(jdRubric.niceToHaveExperience || [])].join('\n'));
  }
  return buildStructuredJobDescriptionRubric(rawJD || '');
};

const buildQuestionPlanHints = ({ rubric, requirementChecks, microScores, settings = {} }) => {
  const mustProbeSkills = unique([
    ...(rubric.interviewTargets?.prioritySkills || []).slice(0, 4),
    ...requirementChecks.filter((item) => item.status !== 'met').slice(0, 3).map((item) => item.label),
    ...microScores.filter((item) => item.score >= 45 && item.score < 80).slice(0, 3).map((item) => item.label),
  ]).slice(0, 6);

  const mustProbeExperience = unique([
    ...(rubric.interviewTargets?.experienceFocus || []).slice(0, 4),
    ...requirementChecks.filter((item) => /experience|project|production|stakeholder/i.test(item.label)).map((item) => item.label),
  ]).slice(0, 5);

  const mustProbeBehavioural = unique([
    ...(rubric.interviewTargets?.behaviouralFocus || []).slice(0, 4),
    ...(settings.enableNZCultureFit ? ['teamwork', 'communication', 'adaptability'] : []),
  ]).slice(0, 5);

  return {
    roleCanonical: rubric.roleCanonical,
    roleFamily: rubric.roleFamily,
    roleLevel: rubric.roleLevel,
    mustProbeSkills,
    mustProbeExperience,
    mustProbeBehavioural,
    avoidTopics: [],
    followUpAnchors: unique([...mustProbeSkills.slice(0, 3), ...mustProbeExperience.slice(0, 2)]),
    orderedStages: ['opening', 'technical_core', 'experience_deep_dive', 'behavioural', 'gap_probe', 'wrap_up'],
  };
};

export const compareCvToJobDescription = async (cvText, rawJD, jdRubric, settings = {}) => {
  const rubric = await normalizeRubric(rawJD, jdRubric);
  const parsedCvProfile = buildCvProfile(cvText);

  const macroScores = (rubric.macroCriteria || []).map((criterion) => {
    const match = computeItemMatch(criterion.label, cvText);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.6 : match.status === 'inferred' ? 0.3 : 0),
      weight: rubric.weights?.macro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: match.status,
      criterionType: 'macro',
    });
  });

  const microScores = (rubric.microCriteria || []).map((criterion) => {
    const match = computeItemMatch(criterion.label, cvText);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.65 : match.status === 'inferred' ? 0.35 : 0),
      weight: rubric.weights?.micro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: match.status,
      criterionType: 'micro',
    });
  });

  const requirementChecks = (rubric.requirements || []).map((requirement) => {
    const match = computeItemMatch(requirement.label, cvText);
    const status = requirement.status && requirement.status !== 'not_met' ? requirement.status : match.status;
    return buildRequirementItem({
      label: requirement.label,
      type: requirement.type || 'soft',
      importance: requirement.importance || 'medium',
      status,
      evidence: [...(requirement.evidence || []), ...match.evidence],
      sourceChunks: requirement.sourceChunks || [],
    });
  });

  const macroScore = sumWeightedScores(macroScores);
  const microScore = sumWeightedScores(microScores);
  const requirementScore = requirementChecks.length === 0 ? 0 : sumWeightedScores(requirementChecks.map((item) => ({ score: requirementStatusToScore(item.status) * 100, weight: item.importance === 'high' ? 1.5 : item.importance === 'low' ? 0.75 : 1 })));
  const overallScore = macroScore * (rubric.weights?.overall?.macro ?? 0.45) + microScore * (rubric.weights?.overall?.micro ?? 0.35) + requirementScore * (rubric.weights?.overall?.requirements ?? 0.2);

  const strengths = microScores.filter((item) => item.score >= 80).slice(0, 4).map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Strong matched micro criterion' }));
  const gaps = requirementChecks.filter((item) => item.status === 'not_met').slice(0, 4).map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Requirement not met' }));
  const risks = requirementChecks.filter((item) => item.type === 'hard' && item.status !== 'met').slice(0, 4).map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Hard requirement risk' }));

  const confidence = roundScore(Math.min(0.95, 0.35 + Math.min(0.25, ((macroScores.length + microScores.length) / 20) * 0.25) + Math.min(0.2, requirementChecks.filter((item) => item.evidence.length > 0).length * 0.04) + Math.min(0.15, parsedCvProfile.tokenCount / 8000)), 2);
  const questionPlanHints = buildQuestionPlanHints({ rubric, requirementChecks, microScores, settings });
  const explanation = buildExplanationObject({
    strengths,
    gaps,
    risks,
    summary: strengths.length > 0 ? `Top matched areas: ${strengths.map((item) => item.label).join(', ')}.` : 'Limited strong matches were found, so the interview should probe fundamentals and evidence depth.',
  });
  const decision = deriveDecision({ overallScore, confidence, hardGateFailed: risks.length > 0 });
  const interviewFocus = unique([...questionPlanHints.mustProbeSkills.slice(0, 3), ...questionPlanHints.mustProbeExperience.slice(0, 2), ...questionPlanHints.mustProbeBehavioural.slice(0, 2)]).slice(0, 6);

  const matchingDetails = {
    weightedBreakdown: buildLegacyWeightedBreakdown({ macroScore, microScore, requirementScore, requirementChecks }),
    rubric,
    macroScore,
    microScore,
    requirementScore,
    questionPlanHints,
  };

  return validateAnalyzeOutput(buildAnalyzeOutput({
    candidateName: parsedCvProfile.candidateName,
    jobTitle: rubric.title || rubric.jobTitle || 'Target Role',
    overallScore,
    confidence,
    decision,
    parsedCvProfile,
    parsedJdProfile: rubric,
    macroScores,
    microScores,
    requirementChecks,
    scoreBreakdown: { macro: clampScore(macroScore), micro: clampScore(microScore), requirements: clampScore(requirementScore) },
    explanation,
    evidenceMap: [...strengths.map((item) => ({ type: 'strength', ...item })), ...gaps.map((item) => ({ type: 'gap', ...item }))],
    sourceSnapshots: [{ sourceType: 'jd_rubric', title: rubric.title, criteriaCount: (rubric.microCriteria || []).length + (rubric.macroCriteria || []).length }],
    matchingDetails,
    legacy: {
      interviewFocus,
      planPreview: `Interview emphasis: ${interviewFocus.join(', ') || 'role-specific problem solving'}.`,
    },
  }));
};
