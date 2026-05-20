import { buildDeterministicEmbedding, cosineSimilarity } from '../embeddingService.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { rankEvidenceWithSentenceTransformers } from '../pythonNlpService.js';
import { normalizeText, tokenize, unique } from './matchShared.js';

const TOP_K = 3;
const SEMANTIC_ALIAS_MAP = {
  'api development': ['rest endpoints', 'rest api', 'api endpoints', 'backend endpoints', 'endpoint development'],
  'rest endpoints': ['api development', 'rest api', 'api endpoints'],
  'data modelling': ['data modeling', 'dimensional modelling', 'dimensional modeling', 'data model'],
  'vector search': ['semantic retrieval', 'embedding search', 'vector database'],
  'semantic retrieval': ['vector search', 'embedding retrieval', 'retrieval augmented generation'],
  'commercial experience': ['professional experience', 'production experience', 'work experience'],
  'professional experience': ['commercial experience', 'production experience', 'work experience'],
};

const SCORE_FLOOR = 0.24;

const expandSemanticAliases = (text = '') => {
  const normalized = normalizeText(text);
  const additions = [];
  for (const [label, aliases] of Object.entries(SEMANTIC_ALIAS_MAP)) {
    if (normalized.includes(label) || aliases.some((alias) => normalized.includes(alias))) {
      additions.push(label, ...aliases);
    }
  }
  return unique([text, ...additions]).join(' ');
};

const overlapScore = (requirementText = '', evidenceText = '') => {
  const requirementTokens = unique(tokenize(expandSemanticAliases(requirementText))
    .filter((token) => token.length > 1 && !['and', 'or', 'the', 'with', 'for', 'from', 'experience', 'development'].includes(token)));
  const evidenceTokens = new Set(tokenize(expandSemanticAliases(evidenceText)));
  if (!requirementTokens.length || !evidenceTokens.size) return 0;
  return requirementTokens.filter((token) => evidenceTokens.has(token)).length / requirementTokens.length;
};

const buildRequirementCandidates = (rubric = {}) => {
  const candidates = [
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
      projectTitle: item.projectTitle || '',
      evidenceStrength: item.evidenceStrength || 'weak',
    }))
    .filter((item) => item.text.trim());
};

const rankWithDeterministicEmbeddings = ({ requirements = [], evidence = [] }) => {
  const evidenceVectors = evidence.map((item) => buildDeterministicEmbedding(expandSemanticAliases(item.text)));
  return {
    model: 'weighted_hash_ngram_v2',
    scorer: 'deterministic-fallback',
    matches: requirements.map((requirement) => {
      const requirementText = expandSemanticAliases(requirement.text || requirement.label);
      const requirementVector = buildDeterministicEmbedding(requirementText);
      const matches = evidence
        .map((item, index) => {
          const cosine = cosineSimilarity(requirementVector, evidenceVectors[index]);
          const overlap = overlapScore(requirement.text || requirement.label, item.text);
          return {
            evidenceId: item.id,
            text: item.text,
            sourceType: item.sourceType,
            projectTitle: item.projectTitle,
            evidenceStrength: item.evidenceStrength,
            score: Math.max(cosine, overlap),
          };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, TOP_K);

      return {
        requirementId: requirement.id,
        label: requirement.label,
        matches,
      };
    }),
  };
};

const toMatchMap = (ranked = {}) => {
  const byLabel = {};
  const matches = (ranked.matches || []).map((item) => {
    const filteredMatches = (item.matches || [])
      .filter((match) => Number(match.score) >= SCORE_FLOOR)
      .map((match) => ({
        ...match,
        score: Number(Number(match.score || 0).toFixed(4)),
      }));
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

  const pythonRanked = await rankEvidenceWithSentenceTransformers({ requirements, evidence, topK: TOP_K });
  const ranked = pythonRanked || rankWithDeterministicEmbeddings({ requirements, evidence });
  const { byLabel, matches } = toMatchMap(ranked);

  return {
    model: ranked.model,
    scorer: ranked.scorer,
    matches,
    byLabel,
    evidenceStrengthBreakdown: summarizeEvidenceStrength(matches),
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
