import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { rankEvidenceWithSentenceTransformers } from '../pythonNlpService.js';
import { rankSemanticEvidence } from './semanticMatchService.js';

const TOP_K = 3;
const SCORE_FLOOR = 0.24;
const EVIDENCE_STRENGTH_RANK = { strong: 3, partial: 2, weak: 1, missing: 0 };

const buildRequirementCandidates = (rubric = {}) => {
  const candidates = [
    ...(rubric.universalRoleProfile?.requirements || []).map((item) => ({
      id: item.id || `universal:${normalizeTaxonomyLabel(item.text || item.label)}`,
      label: item.text || item.label,
      text: item.evidenceNeeded ? `${item.text || item.label}. Evidence needed: ${item.evidenceNeeded}` : (item.text || item.label),
      category: item.category,
      sourceType: 'universal_requirement',
    })),
    ...(rubric.requirements || []).map((item) => ({ id: `requirement:${item.id || normalizeTaxonomyLabel(item.label)}`, label: item.label, text: item.label, sourceType: 'requirement' })),
    ...(rubric.microCriteria || []).map((item) => ({ id: `micro:${item.id || normalizeTaxonomyLabel(item.label)}`, label: item.label, text: item.label, sourceType: 'micro' })),
    ...(rubric.macroCriteria || []).map((item) => ({ id: `macro:${item.id || normalizeTaxonomyLabel(item.label)}`, label: item.label, text: item.label, sourceType: 'macro' })),
  ].filter((item) => item.label);

  const seen = new Set();
  return candidates.filter((item) => {
    const key = normalizeTaxonomyLabel(item.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildEvidenceCandidates = (evidenceProfile = {}) => {
  const items = evidenceProfile.evidenceItems || [];
  return items
    .map((item, index) => ({
      id: item.id || `evidence:${index}`,
      text: item.text || '',
      sourceType: item.sourceType || '',
      section: item.section || '',
      chunkId: item.chunkId || item.id || `cv_${index + 1}`,
      projectTitle: item.projectTitle || '',
      evidenceStrength: item.evidenceStrength || 'weak',
      tools: item.tools || [],
      domain: item.domain || '',
      responsibilitySignal: Boolean(item.responsibilitySignal),
      achievementSignal: Boolean(item.achievementSignal),
    }))
    .filter((item) => item.text.trim());
};

const toMatchMap = (ranked = {}) => {
  const byLabel = {};
  const matches = (ranked.matches || []).map((item) => {
    const filteredMatches = (item.matches || [])
      .filter((match) => Number(match.score) >= SCORE_FLOOR)
      .map((match) => ({
        ...match,
        score: Number(Number(match.score || 0).toFixed(4)),
      }))
      .sort((a, b) => (
        (EVIDENCE_STRENGTH_RANK[b.evidenceStrength] || 0) - (EVIDENCE_STRENGTH_RANK[a.evidenceStrength] || 0)
        || Number(b.score || 0) - Number(a.score || 0)
      ));
    const normalized = {
      requirementId: item.requirementId,
      label: item.label,
      matches: filteredMatches,
    };
    byLabel[normalizeTaxonomyLabel(item.label)] = filteredMatches;
    return normalized;
  });
  return { byLabel, matches };
};

export const buildSemanticEvidenceContext = async ({ rubric = {}, evidenceProfile = {} } = {}) => {
  const requirements = buildRequirementCandidates(rubric);
  const evidence = buildEvidenceCandidates(evidenceProfile);
  if (!requirements.length || !evidence.length) {
    return {
      model: 'none',
      scorer: 'none',
      matches: [],
      byLabel: {},
      evidenceStrengthBreakdown: { strong: 0, partial: 0, weak: 0, missing: requirements.length },
    };
  }

  const pythonRanked = process.env.MATCH_ENGINE === 'semantic'
    ? null
    : await rankEvidenceWithSentenceTransformers({ requirements, evidence, topK: TOP_K });
  const ranked = pythonRanked || await rankSemanticEvidence({ requirements, evidence, topK: TOP_K, minScore: SCORE_FLOOR });
  const { byLabel, matches } = toMatchMap(ranked);

  return {
    model: ranked.model,
    scorer: ranked.scorer,
    matches,
    byLabel,
    evidenceStrengthBreakdown: summarizeEvidenceStrength(matches),
    providerError: ranked.providerError,
  };
};

export const getSemanticMatchesForLabel = (semanticEvidenceContext = {}, label = '') =>
  semanticEvidenceContext.byLabel?.[normalizeTaxonomyLabel(label)] || [];

export const summarizeEvidenceStrength = (matches = []) => {
  const summary = { strong: 0, partial: 0, weak: 0, missing: 0 };
  for (const item of matches) {
    const topMatch = (item.matches || [])[0];
    if (!topMatch) {
      summary.missing += 1;
      continue;
    }
    if (topMatch.evidenceStrength === 'strong' && topMatch.score >= 0.58) {
      summary.strong += 1;
      continue;
    }
    if (topMatch.evidenceStrength === 'partial' || topMatch.score >= 0.48) {
      summary.partial += 1;
      continue;
    }
    summary.weak += 1;
  }
  return summary;
};
