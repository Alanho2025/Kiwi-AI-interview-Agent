import { htmlToReadableText } from '../company/companyPageFetchService.js';
import { isPublicHttpUrl, normalizeSafeHttpUrl } from '../company/urlSafetyService.js';

const MAX_BYTES = 500000;
const MAX_SNIPPETS = 5;
const MAX_SNIPPET_CHARS = 320;
const MIN_SNIPPET_CHARS = 40;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_PAGES = 2;
const COMPANY_EVIDENCE_PATHS = ['', '/about', '/careers', '/about-us'];
const BLOCKING_PAGE_CODES = new Set(['redirect_blocked', 'content_type', 'max_bytes']);

const buildEvidence = ({
  userId = null,
  normalizedUrl = '',
  fetchStatus = 'not_attempted',
  safetyBlocks = [],
  pages = [],
} = {}) => ({
  schemaVersion: 'company_website_evidence_v1',
  userId,
  normalizedUrl,
  fetchStatus,
  safetyBlocks,
  pages,
  containsSensitiveData: true,
  accessScope: 'private',
});

const buildSafetyBlock = (code, message, url = null) => ({
  code,
  message,
  ...(url ? { url } : {}),
});

const extractTitle = (html = '') => {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToReadableText(match[1]).slice(0, 120) : null;
};

const buildSnippets = (text = '') => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const parts = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= MIN_SNIPPET_CHARS)
    .map((part) => part.slice(0, MAX_SNIPPET_CHARS));

  if (parts.length) return parts.slice(0, MAX_SNIPPETS);
  return normalized ? [normalized.slice(0, MAX_SNIPPET_CHARS)] : [];
};

const isAllowedContentType = (contentType = '') => {
  const normalized = String(contentType || '').toLowerCase();
  return normalized.includes('text/html')
    || normalized.includes('text/plain')
    || normalized.includes('application/xhtml+xml');
};

const isRedirectResponse = (status) => Number(status) >= 300 && Number(status) < 400;

const trimTrailingSlash = (url = '') => String(url || '').replace(/\/$/, '');

const buildCandidateUrls = ({ parsedUrl, maxPages = DEFAULT_MAX_PAGES } = {}) => {
  const candidates = [
    trimTrailingSlash(parsedUrl.toString()),
    ...COMPANY_EVIDENCE_PATHS.map((path) => trimTrailingSlash(new URL(path || '/', parsedUrl.origin).toString())),
  ];

  return [...new Set(candidates)].slice(0, Math.max(1, Number(maxPages) || DEFAULT_MAX_PAGES));
};

const fetchEvidencePage = async ({
  pageUrl,
  fetchImpl,
  timeoutMs,
  maxBytes,
} = {}) => {
  const response = await fetchImpl(pageUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': 'KiwiAIInterviewAgent/1.0 RoleFitWebsiteEvidence',
      Accept: 'text/html,text/plain,application/xhtml+xml',
    },
  });

  if (isRedirectResponse(response.status)) {
    return {
      safetyBlock: buildSafetyBlock('redirect_blocked', 'Company website redirects are not followed during role-fit evidence capture.', pageUrl),
    };
  }

  if (!response.ok) {
    return {
      safetyBlock: buildSafetyBlock('http_error', `Company website returned HTTP ${response.status}.`, pageUrl),
    };
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (!isAllowedContentType(contentType)) {
    return {
      safetyBlock: buildSafetyBlock('content_type', 'Company website did not return HTML or text content.', pageUrl),
    };
  }

  const contentLength = Number(response.headers?.get?.('content-length') || 0);
  if (contentLength > maxBytes) {
    return {
      safetyBlock: buildSafetyBlock('max_bytes', 'Company website response is too large for role-fit evidence capture.', pageUrl),
    };
  }

  const rawContent = await response.text();
  const readableText = htmlToReadableText(rawContent).slice(0, maxBytes);
  const snippets = buildSnippets(readableText);
  if (!snippets.length) {
    return {
      safetyBlock: buildSafetyBlock('no_visible_text', 'Company website did not contain usable visible text.', pageUrl),
    };
  }

  return {
    page: {
      url: trimTrailingSlash(response.url || pageUrl),
      title: contentType.includes('text/html') ? extractTitle(rawContent) : null,
      snippets,
      fetchedAt: new Date().toISOString(),
    },
  };
};

export const fetchCompanyWebsiteEvidence = async ({
  userId = null,
  companyWebsiteUrl = '',
  fetchImpl = globalThis.fetch,
  publicUrlChecker = isPublicHttpUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = MAX_BYTES,
  maxPages = DEFAULT_MAX_PAGES,
} = {}) => {
  const parsed = normalizeSafeHttpUrl(companyWebsiteUrl);
  if (!parsed) {
    return buildEvidence({
      userId,
      fetchStatus: 'blocked',
      safetyBlocks: [buildSafetyBlock('invalid_url', 'Company website must be a valid HTTP or HTTPS URL.')],
    });
  }

  const normalizedUrl = trimTrailingSlash(parsed.toString());
  if (!(await publicUrlChecker(normalizedUrl))) {
    return buildEvidence({
      userId,
      normalizedUrl,
      fetchStatus: 'blocked',
      safetyBlocks: [buildSafetyBlock('private_or_non_public_host', 'Company website host is not public or safe to fetch.')],
    });
  }

  if (typeof fetchImpl !== 'function') {
    return buildEvidence({
      userId,
      normalizedUrl,
      fetchStatus: 'failed',
      safetyBlocks: [buildSafetyBlock('fetch_unavailable', 'Website fetch is unavailable in this runtime.')],
    });
  }

  const candidateUrls = buildCandidateUrls({ parsedUrl: parsed, maxPages });
  const pages = [];
  const safetyBlocks = [];

  try {
    for (const pageUrl of candidateUrls) {
      const result = await fetchEvidencePage({ pageUrl, fetchImpl, timeoutMs, maxBytes });
      if (result.page) pages.push(result.page);
      if (result.safetyBlock) safetyBlocks.push(result.safetyBlock);
    }

    if (pages.length) {
      return buildEvidence({ userId, normalizedUrl, fetchStatus: 'fetched', safetyBlocks, pages });
    }

    return buildEvidence({
      userId,
      normalizedUrl,
      fetchStatus: safetyBlocks.some((block) => BLOCKING_PAGE_CODES.has(block.code)) ? 'blocked' : 'failed',
      safetyBlocks,
    });
  } catch (error) {
    return buildEvidence({
      userId,
      normalizedUrl,
      fetchStatus: 'failed',
      safetyBlocks: [buildSafetyBlock(error?.name === 'TimeoutError' ? 'timeout' : 'fetch_failed', error?.message || 'Company website fetch failed.')],
    });
  }
};
