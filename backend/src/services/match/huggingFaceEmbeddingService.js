const DEFAULT_MODEL = 'BAAI/bge-small-en-v1.5';
const DEFAULT_PROVIDER = 'hf-inference';
const DEFAULT_TIMEOUT_MS = 12000;

const getTimeoutSignal = () => (
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(Number(process.env.HF_EMBEDDING_TIMEOUT_MS || DEFAULT_TIMEOUT_MS))
    : undefined
);

const normalizeVector = (vector = []) => {
  const values = Array.isArray(vector) ? vector.map(Number).filter(Number.isFinite) : [];
  if (!values.length) return [];
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => Number((value / magnitude).toFixed(6)));
};

const meanPoolTokenVectors = (tokenVectors = []) => {
  const rows = Array.isArray(tokenVectors) ? tokenVectors.filter(Array.isArray) : [];
  if (!rows.length || !Array.isArray(rows[0])) return [];
  const dimensions = rows[0].length;
  const pooled = new Array(dimensions).fill(0);
  for (const row of rows) {
    for (let index = 0; index < dimensions; index += 1) {
      pooled[index] += Number(row[index]) || 0;
    }
  }
  return pooled.map((value) => value / rows.length);
};

const normalizeEmbeddingResponse = (payload, expectedCount) => {
  if (!Array.isArray(payload)) return [];
  if (expectedCount === 1 && payload.every((item) => typeof item === 'number')) {
    return [normalizeVector(payload)];
  }
  if (payload.length === expectedCount && payload.every((item) => Array.isArray(item) && item.every((value) => typeof value === 'number'))) {
    return payload.map(normalizeVector);
  }
  if (payload.length === expectedCount && payload.every((item) => Array.isArray(item))) {
    return payload.map((item) => normalizeVector(meanPoolTokenVectors(item)));
  }
  if (expectedCount === 1 && payload.every(Array.isArray)) {
    return [normalizeVector(meanPoolTokenVectors(payload))];
  }
  return [];
};

const buildEndpoint = ({ model, provider }) => {
  const configured = process.env.HF_EMBEDDING_ENDPOINT;
  const modelPath = String(model || '').split('/').map(encodeURIComponent).join('/');
  if (configured) return configured.replace('{model}', modelPath).replace('{provider}', provider);
  return `https://router.huggingface.co/${provider}/models/${modelPath}/pipeline/feature-extraction`;
};

export const getHuggingFaceEmbeddingConfig = () => ({
  token: process.env.HF_TOKEN || '',
  model: process.env.HF_EMBEDDING_MODEL || DEFAULT_MODEL,
  provider: process.env.HF_INFERENCE_PROVIDER || DEFAULT_PROVIDER,
});

export const embedTextsWithHuggingFace = async (texts = []) => {
  const inputs = (texts || []).map((item) => String(item || '').trim()).filter(Boolean);
  const { token, model, provider } = getHuggingFaceEmbeddingConfig();

  if (!inputs.length || !token || process.env.AI_TEST_MODE === 'mock') {
    return null;
  }

  const response = await fetch(buildEndpoint({ model, provider }), {
    method: 'POST',
    signal: getTimeoutSignal(),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      normalize: true,
      truncate: true,
      truncation_direction: 'right',
    }),
  });

  if (!response.ok) {
    throw new Error(`Hugging Face embedding API error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const embeddings = normalizeEmbeddingResponse(payload, inputs.length);
  if (embeddings.length !== inputs.length || embeddings.some((vector) => !vector.length)) {
    throw new Error('Hugging Face embedding API returned an unexpected vector shape.');
  }

  return {
    embeddings,
    model,
    provider,
    scorer: 'huggingface-feature-extraction',
  };
};
