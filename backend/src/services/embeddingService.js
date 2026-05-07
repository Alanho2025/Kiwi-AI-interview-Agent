/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: embeddingService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export const EMBEDDING_DIMENSION = 256;
export const EMBEDDING_MODEL = 'weighted_hash_ngram_v2';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'our', 'the', 'their', 'this', 'to', 'with', 'you', 'your',
]);

const LOW_SIGNAL_WORDS = new Set([
  'ability', 'applicant', 'candidate', 'company', 'develop', 'development', 'experience', 'experienced', 'good', 'great', 'join', 'knowledge', 'role', 'skills', 'strong', 'support', 'team', 'work', 'working',
]);

const HIGH_SIGNAL_TERMS = new Set([
  'ai', 'api', 'aws', 'azure', 'ci', 'cicd', 'cd', 'cloud', 'css', 'data', 'databricks', 'devops', 'docker', 'etl', 'express', 'gcp', 'git', 'html', 'javascript', 'kafka', 'kubernetes', 'linux', 'llm', 'mongodb', 'node', 'postgres', 'postgresql', 'python', 'rag', 'react', 'sql', 'typescript',
]);

/**
 * Purpose: Execute the main responsibility for tokenize.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const tokenize = (text = '') =>
  String(text)
    .toLowerCase()
    .replace(/\bci\s*\/\s*cd\b/g, 'cicd')
    .replace(/\bnode\.js\b/g, 'node')
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const hashString = (value = '', seed = 2166136261) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

const estimateIdfWeight = (token = '') => {
  if (!token || STOP_WORDS.has(token)) return 0.15;
  if (LOW_SIGNAL_WORDS.has(token)) return 0.45;
  if (HIGH_SIGNAL_TERMS.has(token)) return 2.2;
  if (/\d/.test(token) || /[+#]/.test(token)) return 1.9;
  if (token.length >= 12) return 1.7;
  if (token.length >= 8) return 1.35;
  if (token.length <= 2) return 0.55;
  return 1;
};

const addFeature = (vector, feature, weight = 1) => {
  if (!feature || weight <= 0) return;
  const primaryHash = hashString(feature);
  const signHash = hashString(feature, 16777619);
  const index = primaryHash % EMBEDDING_DIMENSION;
  const sign = signHash % 2 === 0 ? 1 : -1;
  vector[index] += sign * weight;
};

const buildWordNgrams = (tokens = [], size = 2) => {
  const features = [];
  for (let index = 0; index <= tokens.length - size; index += 1) {
    features.push(tokens.slice(index, index + size).join('_'));
  }
  return features;
};

const buildCharacterNgrams = (token = '') => {
  if (token.length < 5) return [];
  const padded = `_${token}_`;
  const features = [];
  for (const size of [3, 4]) {
    for (let index = 0; index <= padded.length - size; index += 1) {
      features.push(padded.slice(index, index + size));
    }
  }
  return features;
};

/**
 * Purpose: Execute the main responsibility for buildDeterministicEmbedding.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildDeterministicEmbedding = (text = '') => {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const tokenWeight = estimateIdfWeight(token);
    addFeature(vector, `tok:${token}`, tokenWeight);

    for (const ngram of buildCharacterNgrams(token)) {
      addFeature(vector, `char:${ngram}`, tokenWeight * 0.22);
    }
  }

  for (const bigram of buildWordNgrams(tokens, 2)) {
    const weight = bigram.split('_').reduce((sum, token) => sum + estimateIdfWeight(token), 0) / 2;
    addFeature(vector, `bi:${bigram}`, weight * 1.25);
  }

  for (const trigram of buildWordNgrams(tokens, 3)) {
    const weight = trigram.split('_').reduce((sum, token) => sum + estimateIdfWeight(token), 0) / 3;
    addFeature(vector, `tri:${trigram}`, weight * 1.1);
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
};

/**
 * Purpose: Execute the main responsibility for cosineSimilarity.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const cosineSimilarity = (vectorA = [], vectorB = []) => {
  if (!vectorA.length || !vectorB.length || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i += 1) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB) || 1;
  return Number((dotProduct / denominator).toFixed(6));
};

/**
 * Purpose: Execute the main responsibility for embedText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const embedText = async (text = '') => buildDeterministicEmbedding(text);
export const embedBatch = async (texts = []) => Promise.all((texts || []).map((item) => embedText(item)));
export const normalizeForRetrieval = (text = '') => tokenize(text).join(' ');
