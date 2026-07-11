import { buildDeterministicEmbedding, cosineSimilarity } from '../embeddingService.js';
import { embedTextsWithHuggingFace } from './huggingFaceEmbeddingService.js';
import { normalizeText, tokenize, unique } from './matchShared.js';

const DEFAULT_TOP_K = 3;
const DEFAULT_MIN_SCORE = 0.24;

export const SEMANTIC_ALIAS_MAP = {
  sql: ['structured query language', 'postgresql', 'postgres', 'mysql', 'database query', 'query writing'],
  postgresql: ['sql', 'postgres', 'structured query language', 'relational database'],
  postgres: ['sql', 'postgresql', 'structured query language', 'relational database'],
  'api development': ['rest endpoints', 'rest api', 'api endpoints', 'backend endpoints', 'endpoint development'],
  'rest endpoints': ['api development', 'rest api', 'api endpoints'],
  'data modelling': ['data modeling', 'dimensional modelling', 'dimensional modeling', 'data model'],
  'vector search': ['semantic retrieval', 'embedding search', 'vector database'],
  'semantic retrieval': ['vector search', 'embedding retrieval', 'retrieval augmented generation'],
  'commercial experience': ['professional experience', 'production experience', 'work experience'],
  'professional experience': ['commercial experience', 'production experience', 'work experience'],
  'stakeholder communication': ['cross functional updates', 'project updates', 'client communication', 'status reporting'],
  'customer complaint handling': ['resolved customer issues', 'handled complaints', 'customer escalation', 'difficult customer interactions'],
  'customer complaints': ['resolved customer issues', 'handled complaints', 'customer escalation', 'difficult customer interactions'],
  'campaign support': ['marketing coordination', 'content planning', 'campaign reporting', 'marketing campaign support'],
};

export const expandSemanticAliases = (text = '') => {
  const normalized = normalizeText(text);
  const additions = [];
  for (const [label, aliases] of Object.entries(SEMANTIC_ALIAS_MAP)) {
    if (normalized.includes(label) || aliases.some((alias) => normalized.includes(alias))) {
      additions.push(label, ...aliases);
    }
  }
  return unique([text, ...additions]).join(' ');
};

const getTopK = (topK) => {
  const configured = Number(topK ?? process.env.SEMANTIC_TOP_K ?? DEFAULT_TOP_K);
  return Number.isFinite(configured) && configured > 0 ? Math.min(8, Math.round(configured)) : DEFAULT_TOP_K;
};

const getMinScore = (minScore) => {
  const configured = Number(minScore ?? process.env.SEMANTIC_MIN_SCORE ?? DEFAULT_MIN_SCORE);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_MIN_SCORE;
};

const overlapScore = (requirementText = '', evidenceText = '') => {
  const requirementTokens = unique(tokenize(expandSemanticAliases(requirementText))
    .filter((token) => token.length > 1 && !['and', 'or', 'the', 'with', 'for', 'from', 'experience', 'development'].includes(token)));
  const evidenceTokens = new Set(tokenize(expandSemanticAliases(evidenceText)));
  if (!requirementTokens.length || !evidenceTokens.size) return 0;
  return requirementTokens.filter((token) => evidenceTokens.has(token)).length / requirementTokens.length;
};

const rankFromVectors = ({ requirements = [], evidence = [], requirementVectors = [], evidenceVectors = [], scorer = 'deterministic-fallback', model = 'weighted_hash_ngram_v2', topK, minScore }) => ({
  model,
  scorer,
  matches: requirements.map((requirement, requirementIndex) => {
    const requirementVector = requirementVectors[requirementIndex] || [];
    const matches = evidence
      .map((item, evidenceIndex) => {
        const cosine = cosineSimilarity(requirementVector, evidenceVectors[evidenceIndex] || []);
        const overlap = overlapScore(requirement.text || requirement.label, item.text);
        return {
          evidenceId: item.id,
          chunkId: item.chunkId || item.id,
          text: item.text,
          section: item.section,
          sourceType: item.sourceType,
          candidateEvidenceSource: item.candidateEvidenceSource || '',
          title: item.title || '',
          projectTitle: item.projectTitle,
          evidenceStrength: item.evidenceStrength,
          tools: item.tools || [],
          domain: item.domain || '',
          responsibilitySignal: Boolean(item.responsibilitySignal),
          achievementSignal: Boolean(item.achievementSignal),
          sourceTrace: item.sourceTrace || null,
          signals: item.signals || {},
          proofAngles: item.proofAngles || [],
          strengthSignals: item.strengthSignals || {},
          howToSayIt: item.howToSayIt || [],
          avoidUsingFor: item.avoidUsingFor || [],
          fitLimits: item.fitLimits || [],
          score: Math.max(cosine, overlap),
        };
      })
      .filter((item) => Number(item.score) >= minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);

    return {
      requirementId: requirement.id,
      label: requirement.label,
      category: requirement.category,
      matches,
    };
  }),
});

const rankWithDeterministicEmbeddings = ({ requirements = [], evidence = [], topK, minScore }) => {
  const requirementVectors = requirements.map((item) => buildDeterministicEmbedding(expandSemanticAliases(item.text || item.label)));
  const evidenceVectors = evidence.map((item) => buildDeterministicEmbedding(expandSemanticAliases(item.text)));
  return rankFromVectors({
    requirements,
    evidence,
    requirementVectors,
    evidenceVectors,
    scorer: 'deterministic-fallback',
    model: 'weighted_hash_ngram_v2',
    topK,
    minScore,
  });
};

const rankWithHuggingFaceEmbeddings = async ({ requirements = [], evidence = [], topK, minScore }) => {
  const texts = [
    ...requirements.map((item) => expandSemanticAliases(item.text || item.label)),
    ...evidence.map((item) => expandSemanticAliases(item.text)),
  ];
  const result = await embedTextsWithHuggingFace(texts);
  if (!result) return null;
  const requirementVectors = result.embeddings.slice(0, requirements.length);
  const evidenceVectors = result.embeddings.slice(requirements.length);
  return rankFromVectors({
    requirements,
    evidence,
    requirementVectors,
    evidenceVectors,
    scorer: result.scorer,
    model: result.model,
    topK,
    minScore,
  });
};

export const rankSemanticEvidence = async ({ requirements = [], evidence = [], topK, minScore } = {}) => {
  const resolvedTopK = getTopK(topK);
  const resolvedMinScore = getMinScore(minScore);

  if (process.env.MATCH_ENGINE === 'semantic') {
    try {
      const ranked = await rankWithHuggingFaceEmbeddings({
        requirements,
        evidence,
        topK: resolvedTopK,
        minScore: resolvedMinScore,
      });
      if (ranked) return ranked;
    } catch (error) {
      return {
        ...rankWithDeterministicEmbeddings({ requirements, evidence, topK: resolvedTopK, minScore: resolvedMinScore }),
        providerError: error?.message || 'Hugging Face embedding failed.',
      };
    }
  }

  return rankWithDeterministicEmbeddings({
    requirements,
    evidence,
    topK: resolvedTopK,
    minScore: resolvedMinScore,
  });
};
