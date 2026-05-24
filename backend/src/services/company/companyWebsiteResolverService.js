import { searchWithSerper } from './serperSearchService.js';
import { isPublicHttpUrl, normalizeSafeHttpUrl } from './urlSafetyService.js';

const BLOCKED_DOMAINS = [
  'seek.co.nz',
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'facebook.com',
  'instagram.com',
  'wikipedia.org',
  'youtube.com',
  'trademe.co.nz',
];

const normalize = (value = '') => String(value || '').toLowerCase();

const tokenizeCompanyName = (companyName = '') =>
  normalize(companyName)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

export const buildCompanySearchQueries = ({ companyName, location } = {}) => {
  const base = String(companyName || '').trim();
  const loc = String(location || '').trim();
  const maxQueries = Number(process.env.COMPANY_SEARCH_MAX_QUERIES_PER_SESSION || 2);

  if (!base) return [];

  return [
    loc ? `${base} ${loc} official website` : `${base} official website`,
    `${base} careers values culture`,
  ].slice(0, maxQueries);
};

export const scoreSearchResult = ({ result, companyName }) => {
  const url = result.url || '';
  const text = normalize(`${result.title} ${result.snippet} ${url}`);
  const tokens = tokenizeCompanyName(companyName);

  let score = 0;
  if (tokens.some((token) => text.includes(token))) score += 0.35;
  if (/official|home|about|careers|jobs|company/.test(text)) score += 0.2;
  if (/\/about|\/careers|\/culture|\/values|\/who-we-are/.test(url)) score += 0.15;
  if (url.startsWith('https://')) score += 0.05;

  if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) score -= 0.7;
  if (/recruit|staffing|agency|job board/.test(text)) score -= 0.3;

  return Math.max(0, Math.min(1, score));
};

export const resolveCompanyWebsite = async ({
  companyName,
  location,
  manualWebsiteUrl = '',
} = {}) => {
  const manualUrl = normalizeSafeHttpUrl(manualWebsiteUrl);
  if (manualUrl) {
    const allowed = await isPublicHttpUrl(manualUrl.toString());
    return allowed
      ? {
          websiteUrl: manualUrl.origin,
          confidence: 1,
          source: 'manual',
          searchQueries: [],
          searchResults: [],
        }
      : {
          websiteUrl: null,
          confidence: 0,
          source: 'manual',
          searchQueries: [],
          searchResults: [],
          fallbackReason: 'manual_company_website_not_allowed',
        };
  }

  const queries = buildCompanySearchQueries({ companyName, location });
  const resultsPerQuery = Number(process.env.COMPANY_SEARCH_RESULTS_PER_QUERY || 5);
  if (!queries.length) {
    return {
      websiteUrl: null,
      confidence: 0,
      searchQueries: [],
      searchResults: [],
      fallbackReason: 'missing_company_name',
    };
  }

  const allResults = [];
  for (const query of queries) {
    const search = await searchWithSerper({ query, num: resultsPerQuery });
    if (!search.ok) {
      allResults.push({
        title: '',
        url: '',
        snippet: search.reason,
        score: 0,
        rejectedReason: search.reason,
      });
      continue;
    }

    for (const result of search.results) {
      const score = scoreSearchResult({ result, companyName });
      allResults.push({ ...result, score });
    }
  }

  const sorted = allResults
    .filter((item) => item.url)
    .sort((a, b) => b.score - a.score);
  const minConfidence = Number(process.env.COMPANY_VALUES_MIN_CONFIDENCE || 0.65);

  for (const candidate of sorted) {
    if (candidate.score < minConfidence) break;
    const parsed = normalizeSafeHttpUrl(candidate.url);
    if (!parsed) {
      candidate.rejectedReason = 'unsafe_url';
      continue;
    }
    if (!(await isPublicHttpUrl(parsed.toString()))) {
      candidate.rejectedReason = 'non_public_url';
      continue;
    }
    return {
      websiteUrl: parsed.origin,
      confidence: candidate.score,
      source: 'serper',
      searchQueries: queries,
      searchResults: sorted,
    };
  }

  return {
    websiteUrl: null,
    confidence: sorted[0]?.score || 0,
    searchQueries: queries,
    searchResults: sorted,
    fallbackReason: 'no_reliable_official_website',
  };
};
