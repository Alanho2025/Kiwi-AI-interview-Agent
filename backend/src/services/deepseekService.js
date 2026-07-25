/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: deepseekService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request storage for usage tracking context (userId, sessionId).
 * Set by API middleware; consumed by autoRecordUsage.
 */
const usageContextStorage = new AsyncLocalStorage();

export const LLM_CONFIGS = Object.freeze({
  JSON_STRICT: Object.freeze({ temperature: 0, top_p: 1 }),
  EVALUATOR: Object.freeze({ temperature: 0, top_p: 1 }),
  GROUNDED_WRITING: Object.freeze({ temperature: 0.2, top_p: 0.9 }),
  INTERVIEWER_NATURAL: Object.freeze({ temperature: 0.4, top_p: 0.9 }),
});

const isMockAiMode = () => process.env.AI_TEST_MODE === 'mock';
const isRealAiMode = () => process.env.AI_TEST_MODE === 'real';
const buildMockDeepSeekResponse = () => 'This is a mock response from DeepSeek. Please set DEEPSEEK_API_KEY to run real AI eval.';

const getDeepSeekTimeoutMs = () => {
  const configured = Number(process.env.DEEPSEEK_TIMEOUT_MS || 30000);
  return Number.isFinite(configured) && configured > 0 ? configured : 30000;
};

const buildTimeoutSignal = (overrideTimeoutMs) => (
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(overrideTimeoutMs || getDeepSeekTimeoutMs())
    : undefined
);

const resolveDeepSeekApiKey = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) return apiKey;
  if (isMockAiMode()) return null;
  if (isRealAiMode()) {
    throw new Error('DEEPSEEK_API_KEY is required when AI_TEST_MODE=real. Real eval must not silently use mock output.');
  }
  console.warn('DEEPSEEK_API_KEY is missing. Using mock response.');
  return null;
};

const normalizeGenerationConfig = (config = {}) => {
  const normalized = {};
  if (Number.isFinite(Number(config.temperature))) normalized.temperature = Number(config.temperature);
  if (Number.isFinite(Number(config.top_p))) normalized.top_p = Number(config.top_p);
  return normalized;
};

const chooseDefaultGenerationConfig = ({ usageMetadata = {}, streaming = false } = {}) => {
  const stage = String(usageMetadata.stage || '').toLowerCase();
  const operation = String(usageMetadata.operation || '').toLowerCase();
  const feature = String(usageMetadata.feature || '').toLowerCase();

  if (operation === 'llm_json') return LLM_CONFIGS.JSON_STRICT;

  if (
    stage === 'cv_jd_match'
    || stage === 'jd_parse'
    || feature.includes('extract')
    || feature.includes('parse')
    || feature.includes('judge')
    || feature.includes('critic')
    || feature.includes('selector')
    || feature.includes('understanding')
    || feature.includes('interview_plan')
    || feature.includes('values_enrichment')
    || feature.includes('motivation_fit')
    || feature.includes('baseline')
    || feature.includes('evaluation')
  ) {
    return LLM_CONFIGS.EVALUATOR;
  }

  if (
    stage === 'report_generated'
    || stage === 'report_qa'
    || feature.includes('candidate_feedback')
    || feature.includes('report_rewrite')
    || feature.includes('coaching')
  ) {
    return LLM_CONFIGS.GROUNDED_WRITING;
  }

  if (streaming || stage === 'interview') return LLM_CONFIGS.INTERVIEWER_NATURAL;

  return LLM_CONFIGS.GROUNDED_WRITING;
};

const resolveGenerationConfig = ({ usageMetadata = {}, temperature, top_p, generationConfig = {}, streaming = false } = {}) => ({
  ...chooseDefaultGenerationConfig({ usageMetadata, streaming }),
  ...normalizeGenerationConfig(generationConfig),
  ...normalizeGenerationConfig({ temperature, top_p }),
});

const buildChatPayload = ({ prompt, systemInstruction, usageMetadata = {}, temperature, top_p, generationConfig, stream = false, streamOptions = null } = {}) => {
  const payload = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemInstruction || 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ],
    ...resolveGenerationConfig({ usageMetadata, temperature, top_p, generationConfig, streaming: stream }),
  };

  if (stream) payload.stream = true;
  if (streamOptions) payload.stream_options = streamOptions;
  return payload;
};

/**
 * Extract token usage from a DeepSeek API response.
 * Returns { promptTokens, completionTokens } or null if unavailable.
 */
export const extractUsage = (data) => {
  if (data?.usage?.prompt_tokens != null && data?.usage?.completion_tokens != null) {
    return {
      promptTokens:     data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      promptCacheHitTokens: data.usage.prompt_cache_hit_tokens || data.usage.prompt_tokens_details?.cached_tokens || 0,
      promptCacheMissTokens: data.usage.prompt_cache_miss_tokens ?? null,
    };
  }
  return null;
};

/** Return the current request's usage context store. */
export const getUsageContextStore = () => usageContextStorage.getStore();

export const runWithUsageContextPatch = (context = {}, execute) => {
  const currentContext = getUsageContextStore() || {};
  return usageContextStorage.run({ ...currentContext, ...context }, execute);
};

/**
 * Express middleware that wraps downstream handlers in an AsyncLocalStorage run context.
 * Usage: api.use(usageContextMiddleware);
 */
export const usageContextMiddleware = (req, _res, next) => {
  const ctx = req.user?.id
    ? { userId: req.user.id, sessionId: req.params?.sessionId || req.body?.sessionId || null }
    : null;
  usageContextStorage.run(ctx, () => next());
};


export const autoRecordUsage = async (usage, action = 'callDeepSeek', metadata = {}) => {
  if (!usage) return;
  const ctx = getUsageContextStore();
  if (!ctx?.userId) return;
  const stage = metadata.stage || ctx.stage || 'interview';
  const operation = metadata.operation || (action === 'callDeepSeekJson' ? 'llm_json' : 'llm_chat');

  try {
    const [{ recordTokenUsage }, { recordLlmUsage }] = await Promise.all([
      import('./usageTrackingService.js'),
      import('./aiUsageTrackingService.js'),
    ]);

    const [, llmUsageEvent] = await Promise.all([
      recordTokenUsage({
        userId: ctx.userId,
        sessionId: ctx.sessionId || null,
        action,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      }),
      recordLlmUsage({
        userId: ctx.userId,
        sessionId: ctx.sessionId || null,
        stage,
        operation,
        action,
        usage,
        metadata,
      }),
    ]);
    if (typeof ctx.harnessUsageCollector === 'function') {
      ctx.harnessUsageCollector({
        provider: 'deepseek',
        model: 'deepseek-chat',
        capabilityId: ctx.harnessCapabilityId || null,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        estimatedCost: llmUsageEvent?.estimatedCost ?? null,
      });
    }
  } catch (err) {
    console.warn('Failed to record AI usage:', err?.message);
  }
};

export const callDeepSeek = async (
  prompt,
  systemInstruction = '',
  {
    skipAutoRecord = false,
    usageMetadata = {},
    temperature,
    top_p,
    generationConfig,
    timeoutMs,
  } = {},
) => {
  try {
    const apiKey = resolveDeepSeekApiKey();
    if (!apiKey) {
      return { content: buildMockDeepSeekResponse(), usage: null };
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: buildTimeoutSignal(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(buildChatPayload({
        prompt,
        systemInstruction,
        usageMetadata,
        temperature,
        top_p,
        generationConfig,
      }))
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();
    const usage = extractUsage(data);
    if (!skipAutoRecord) await autoRecordUsage(usage, 'callDeepSeek', usageMetadata);
    return {
      content: data.choices[0].message.content,
      usage,
    };
  } catch (error) {
    console.error('DeepSeek API Error:', error);
    throw error;
  }
};

/**
 * Purpose: Execute the main responsibility for callDeepSeekStream.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns an async generator yielding text chunks as they arrive from the DeepSeek stream.
 */
export const callDeepSeekStream = async function* (
  prompt,
  systemInstruction = '',
  {
    usageMetadata = {},
    temperature,
    top_p,
    generationConfig,
    timeoutMs,
  } = {},
) {
  const apiKey = resolveDeepSeekApiKey();
  if (!apiKey) {
    yield buildMockDeepSeekResponse();
    return;
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    signal: buildTimeoutSignal(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(buildChatPayload({
      prompt,
      systemInstruction,
      usageMetadata,
      temperature,
      top_p,
      generationConfig,
      stream: true,
      streamOptions: { include_usage: true },
    }))
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let streamUsage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmed.slice(6));
          const chunk = data.choices?.[0]?.delta?.content || '';
          if (chunk) yield chunk;
          // Capture usage from the final chunk (DeepSeek sends it when stream_options.include_usage is true)
          if (data.usage) {
            streamUsage = extractUsage(data);
          }
        } catch {
          // ignore incomplete JSON chunks
        }
      }
    }
  }

  // Record streaming usage after the generator completes
  await autoRecordUsage(streamUsage, 'callDeepSeek', usageMetadata);
};
