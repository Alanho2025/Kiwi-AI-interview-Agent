import { enqueueBackgroundJob } from '../../jobs/backgroundJobQueue.js';
import { logger } from '../../utils/logger.js';
import {
  getCompanyValuesProfileByFingerprint,
  markCompanyValuesStatus,
  saveCompanyValuesProfile,
} from './companyValuesRepository.js';
import { resolveCompanyWebsite } from './companyWebsiteResolverService.js';
import { fetchCompanyValuePages } from './companyPageFetchService.js';
import { extractCompanyValuesFromPages } from './companyValuesExtractorService.js';
import { buildGeneralCompanyValuesFallback } from './companyGeneralValuesFallback.js';

const summarizeFetchedPages = (pages = []) => pages.map((page) => ({
  url: page.url,
  status: page.status,
  textPreview: page.textPreview || '',
  errorMessage: page.errorMessage || undefined,
}));

const inferCompanyLabelFromWebsite = (manualWebsiteUrl = '') => {
  try {
    return new URL(manualWebsiteUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const runCompanyValuesEnrichment = async ({
  userId,
  jdFingerprint,
  sessionId = null,
  companyName,
  location,
  jdText,
  manualWebsiteUrl = '',
} = {}) => {
  if (!userId || !jdFingerprint) return null;
  const resolvedCompanyName = companyName || inferCompanyLabelFromWebsite(manualWebsiteUrl);

  if (!resolvedCompanyName && !manualWebsiteUrl) {
    return saveCompanyValuesProfile({
      userId,
      jdFingerprint,
      sessionId,
      ...buildGeneralCompanyValuesFallback({ reason: 'missing_company_name' }),
    });
  }

  await markCompanyValuesStatus({
    userId,
    jdFingerprint,
    sessionId,
    companyName: resolvedCompanyName,
    location,
    manualWebsiteUrl: manualWebsiteUrl || undefined,
    status: 'searching',
  });

  try {
    const resolved = await resolveCompanyWebsite({
      companyName: resolvedCompanyName,
      location,
      jdText,
      manualWebsiteUrl,
    });

    if (!resolved.websiteUrl) {
      return saveCompanyValuesProfile({
        userId,
        jdFingerprint,
        sessionId,
        companyName: resolvedCompanyName,
        location,
        manualWebsiteUrl: manualWebsiteUrl || undefined,
        ...buildGeneralCompanyValuesFallback({
          companyName: resolvedCompanyName,
          reason: resolved.fallbackReason || 'no_reliable_official_website',
        }),
        searchQueries: resolved.searchQueries || [],
        searchResults: resolved.searchResults || [],
      });
    }

    await markCompanyValuesStatus({
      userId,
      jdFingerprint,
      sessionId,
      companyName: resolvedCompanyName,
      location,
      status: 'fetching',
      websiteUrl: resolved.websiteUrl,
      manualWebsiteUrl: manualWebsiteUrl || undefined,
      source: resolved.source,
      confidence: resolved.confidence,
    });

    const pages = await fetchCompanyValuePages({ websiteUrl: resolved.websiteUrl });
    if (!pages.some((page) => page.text && page.text.length >= 300)) {
      return saveCompanyValuesProfile({
        userId,
        jdFingerprint,
        sessionId,
        companyName: resolvedCompanyName,
        location,
        websiteUrl: resolved.websiteUrl,
        manualWebsiteUrl: manualWebsiteUrl || undefined,
        ...buildGeneralCompanyValuesFallback({
          companyName: resolvedCompanyName,
          reason: 'company_pages_not_fetchable',
        }),
        searchQueries: resolved.searchQueries || [],
        searchResults: resolved.searchResults || [],
        fetchedPages: summarizeFetchedPages(pages),
      });
    }

    await markCompanyValuesStatus({ userId, jdFingerprint, sessionId, companyName: resolvedCompanyName, status: 'extracting' });
    const extracted = await extractCompanyValuesFromPages({
      companyName: resolvedCompanyName,
      websiteUrl: resolved.websiteUrl,
      pages,
    });
    const minConfidence = Number(process.env.COMPANY_VALUES_MIN_CONFIDENCE || 0.65);

    if (!extracted.values?.length || extracted.confidence < minConfidence) {
      return saveCompanyValuesProfile({
        userId,
        jdFingerprint,
        sessionId,
        companyName: resolvedCompanyName,
        location,
        websiteUrl: resolved.websiteUrl,
        manualWebsiteUrl: manualWebsiteUrl || undefined,
        ...buildGeneralCompanyValuesFallback({
          companyName: resolvedCompanyName,
          reason: 'low_confidence_or_no_values_extracted',
        }),
        searchQueries: resolved.searchQueries || [],
        searchResults: resolved.searchResults || [],
        fetchedPages: summarizeFetchedPages(pages),
      });
    }

    return saveCompanyValuesProfile({
      userId,
      jdFingerprint,
      sessionId,
      companyName: resolvedCompanyName,
      location,
      websiteUrl: resolved.websiteUrl,
      manualWebsiteUrl: manualWebsiteUrl || undefined,
      status: 'ready',
      source: resolved.source === 'manual' ? 'manual' : 'official_website',
      confidence: extracted.confidence,
      mission: extracted.mission,
      values: extracted.values,
      cultureNotes: extracted.cultureNotes,
      searchQueries: resolved.searchQueries || [],
      searchResults: resolved.searchResults || [],
      fetchedPages: summarizeFetchedPages(pages),
      completedAt: new Date(),
    });
  } catch (error) {
    logger.error('Company values enrichment failed', {
      userId,
      sessionId,
      jdFingerprint,
      companyName: resolvedCompanyName,
      error,
    });
    return saveCompanyValuesProfile({
      userId,
      jdFingerprint,
      sessionId,
      companyName: resolvedCompanyName,
      location,
      manualWebsiteUrl: manualWebsiteUrl || undefined,
      ...buildGeneralCompanyValuesFallback({
        companyName: resolvedCompanyName,
        reason: 'enrichment_error',
      }),
      errorMessage: error?.message || 'enrichment_error',
    });
  }
};

export const startCompanyValuesEnrichment = async ({
  userId,
  jdFingerprint,
  sessionId = null,
  companyName,
  location,
  jdText,
  manualWebsiteUrl = '',
} = {}) => {
  if (!userId || !jdFingerprint) return null;

  await markCompanyValuesStatus({
    userId,
    jdFingerprint,
    sessionId,
    companyName,
    location,
    manualWebsiteUrl: manualWebsiteUrl || undefined,
    status: 'pending',
  });

  enqueueBackgroundJob(
    'company-values-enrichment',
    () => runCompanyValuesEnrichment({
      userId,
      jdFingerprint,
      sessionId,
      companyName,
      location,
      jdText,
      manualWebsiteUrl,
    }),
    { userId, sessionId, jdFingerprint, companyName }
  );

  return getCompanyValuesProfileByFingerprint({ userId, jdFingerprint });
};

export const runCompanyValuesEnrichmentNow = runCompanyValuesEnrichment;
