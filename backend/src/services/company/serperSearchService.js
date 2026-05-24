import { getEnv } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const SERPER_SEARCH_URL = 'https://google.serper.dev/search';

export const searchWithSerper = async ({ query, num = 5, timeoutMs = 10000 } = {}) => {
  const apiKey = getEnv('SERPER_API_KEY');
  if (!apiKey) {
    logger.warn('Serper search skipped because SERPER_API_KEY is missing', {
      queryLength: String(query || '').length,
    });
    return { ok: false, reason: 'missing_serper_api_key', results: [] };
  }

  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return { ok: false, reason: 'missing_query', results: [] };
  }

  try {
    logger.info('Serper search request started', {
      query: normalizedQuery,
      resultLimit: num,
    });
    const response = await fetch(SERPER_SEARCH_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: normalizedQuery, num }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      logger.warn('Serper search request failed', {
        query: normalizedQuery,
        status: response.status,
      });
      return { ok: false, reason: `serper_http_${response.status}`, results: [] };
    }

    const data = await response.json();
    logger.info('Serper search request completed', {
      query: normalizedQuery,
      organicResultCount: (data.organic || []).length,
    });
    return {
      ok: true,
      results: (data.organic || []).map((item) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        source: 'serper',
      })),
    };
  } catch (error) {
    logger.warn('Serper search request errored', {
      query: normalizedQuery,
      error,
    });
    return {
      ok: false,
      reason: error?.name === 'TimeoutError' ? 'serper_timeout' : 'serper_request_failed',
      results: [],
    };
  }
};
