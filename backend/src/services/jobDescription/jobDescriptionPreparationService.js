import {
  buildGuardedStructuredJobDescriptionRubric,
  formatStructuredJobDescription,
} from '../jobDescriptionService.js';
import { extractCompanyValuesContextFromJd } from '../company/companyValuesFingerprintService.js';
import { saveCompanyRoleFitDraft } from '../company/companyValuesRepository.js';
import { recordLocalUsage } from '../aiUsageTrackingService.js';
import { badRequest } from '../../utils/appError.js';
import { buildRoleFitProfile } from './roleFitProfileBuilder.js';
import { captureUrlContent } from './urlCaptureService.js';
import { fetchCompanyWebsiteEvidence } from './companyWebsiteEvidenceService.js';

const getJobDescriptionText = async (rawJD = '') => {
  const target = rawJD.trim();
  if (!/^https?:\/\//i.test(target)) {
    return { targetRawJD: target, sourceUrl: '' };
  }

  const captured = await captureUrlContent(target);
  return {
    targetRawJD: captured.visibleText,
    sourceUrl: captured.finalUrl,
  };
};

export const prepareJobDescriptionForReview = async ({
  rawJD,
  userId,
  companyWebsiteUrl = '',
  userCompanyContext = '',
} = {}) => {
  const { targetRawJD, sourceUrl } = await getJobDescriptionText(rawJD);
  const parsedRubric = await buildGuardedStructuredJobDescriptionRubric(targetRawJD);
  const companyWebsiteEvidence = companyWebsiteUrl
    ? await fetchCompanyWebsiteEvidence({ userId, companyWebsiteUrl })
    : null;
  const roleFit = buildRoleFitProfile({
    rawJD: targetRawJD,
    rubric: parsedRubric,
    companyWebsiteUrl,
    userCompanyContext,
    companyWebsiteEvidence,
  });

  if (roleFit.companyContext.status !== 'ready') {
    throw badRequest(
      'Missing company context',
      'Provide a valid company website URL or manual company context before summarising the JD.',
      {
        securityFlags: roleFit.securityFlags,
        roleFitDiagnostics: roleFit.roleFitDiagnostics,
      }
    );
  }

  const draftRubric = {
    ...parsedRubric,
    jobOverview: {
      ...(parsedRubric.jobOverview || {}),
      ...(roleFit.companyContext.websiteUrl ? { companyWebsiteUrl: roleFit.companyContext.websiteUrl } : {}),
    },
    roleFit,
  };
  const { jdFingerprint } = extractCompanyValuesContextFromJd({
    rawJD: targetRawJD,
    jdRubric: draftRubric,
    companyWebsiteUrl: roleFit.companyContext.websiteUrl,
  });
  const roleFitWithIdentity = { ...roleFit, jdFingerprint };
  const structuredJDRubric = {
    ...draftRubric,
    roleFit: roleFitWithIdentity,
    metadata: {
      ...(draftRubric.metadata || {}),
      jdFingerprint,
    },
  };

  await saveCompanyRoleFitDraft({
    userId,
    jdFingerprint,
    roleFitProfile: roleFitWithIdentity,
    rawJD: targetRawJD,
    sourceUrl,
  });
  await recordLocalUsage({
    userId,
    stage: 'jd_parse',
    operation: 'local_parse',
    metadata: {
      rawTextLength: targetRawJD.length,
      safeguardStatus: structuredJDRubric?.safeguard?.finalStatus || null,
    },
  });

  return {
    structuredJD: formatStructuredJobDescription(structuredJDRubric),
    structuredJDRubric,
    roleFit: roleFitWithIdentity,
    rawJD: targetRawJD,
    sourceUrl,
  };
};
