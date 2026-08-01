import { DocumentContent } from '../../db/models/documentContentModel.js';
import { badRequest } from '../../utils/appError.js';
import { buildCvAnalysis } from './cvAnalysisBuilderService.js';
import { buildCvDisplayView } from './cvDisplayViewService.js';
import { buildCvEvidenceProfile } from './cvEvidenceProfileBuilder.js';
import { getOwnedCvDocumentOrThrow, getOwnedCvRecordOrThrow } from './cvOwnershipService.js';
import { normalizeText } from '../../utils/commonHelpers.js';

const REVIEW_SECTION_KEYS = new Set(['personal_statement', 'summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'key_competencies']);


const normalizeList = (items = []) => (Array.isArray(items) ? items : String(items || '').split(/\n|,/))
  .map((item) => (typeof item === 'string' ? item : item?.label || item?.name || ''))
  .map((item) => item.replace(/^[-•*]\s*/, '').trim())
  .filter(Boolean);

export const normalizeReviewedCvProfile = (reviewProfile = {}) => ({
  candidateSummary: normalizeText(reviewProfile.candidateSummary),
  coreSkills: normalizeList(reviewProfile.coreSkills),
  experienceEvidence: normalizeText(reviewProfile.experienceEvidence),
  projectEvidence: normalizeText(reviewProfile.projectEvidence),
  educationCredentials: normalizeText(reviewProfile.educationCredentials),
  certifications: normalizeText(reviewProfile.certifications || reviewProfile.certificationsCredentials),
  keyCompetencies: normalizeList(reviewProfile.keyCompetencies),
});

const hasReviewContent = (reviewProfile = {}) => Boolean(
  reviewProfile.candidateSummary
  || reviewProfile.coreSkills.length
  || reviewProfile.experienceEvidence
  || reviewProfile.projectEvidence
  || reviewProfile.educationCredentials
  || reviewProfile.certifications
  || reviewProfile.keyCompetencies.length
);

const buildSection = (key, title, content) => ({
  key,
  title,
  content,
  lineCount: String(content || '').split('\n').filter((line) => line.trim()).length,
});

const upsertReviewedSections = (existingSections = [], reviewProfile = {}) => {
  const existingMap = new Map((existingSections || []).map((sec) => [sec.key, sec]));
  const updatedMap = new Map(existingMap);

  if (reviewProfile.candidateSummary) updatedMap.set('personal_statement', buildSection('personal_statement', 'Candidate summary', reviewProfile.candidateSummary));
  if (reviewProfile.coreSkills.length) updatedMap.set('skills', buildSection('skills', 'Core skills', reviewProfile.coreSkills.join('\n')));
  if (reviewProfile.experienceEvidence) updatedMap.set('experience', buildSection('experience', 'Experience evidence', reviewProfile.experienceEvidence));
  if (reviewProfile.projectEvidence) updatedMap.set('projects', buildSection('projects', 'Project evidence', reviewProfile.projectEvidence));
  if (reviewProfile.educationCredentials) updatedMap.set('education', buildSection('education', 'Education credentials', reviewProfile.educationCredentials));
  if (reviewProfile.certifications) updatedMap.set('certifications', buildSection('certifications', 'Certifications and licenses', reviewProfile.certifications));
  if (reviewProfile.keyCompetencies.length) updatedMap.set('key_competencies', buildSection('key_competencies', 'Key competencies', reviewProfile.keyCompetencies.join('\n')));

  return Array.from(updatedMap.values());
};

const buildReviewedCvText = (baseProfile = {}, reviewProfile = {}) => {
  const sections = upsertReviewedSections(baseProfile.sections || [], reviewProfile);
  const reviewedText = sections.map((sec) => `${sec.title || sec.key}\n${sec.content}`).join('\n\n');
  return reviewedText || baseProfile.normalizedText || '';
};

export const buildReviewedCvProfile = ({ baseProfile = {}, reviewProfile = {}, reviewedAt = new Date().toISOString() } = {}) => {
  const normalizedReview = normalizeReviewedCvProfile(reviewProfile);
  if (!hasReviewContent(normalizedReview)) {
    throw badRequest('Missing CV review fields', 'At least one reviewed CV field is required.');
  }

  const sections = upsertReviewedSections(baseProfile.sections || [], normalizedReview);
  const reviewedProfile = {
    ...baseProfile,
    schemaVersion: baseProfile.schemaVersion || 'cv_profile_v1',
    personalStatement: normalizedReview.candidateSummary || baseProfile.personalStatement || baseProfile.summary || '',
    summary: normalizedReview.candidateSummary || baseProfile.summary || baseProfile.personalStatement || '',
    experience: normalizedReview.experienceEvidence || baseProfile.experience || '',
    projects: normalizedReview.projectEvidence || baseProfile.projects || '',
    education: normalizedReview.educationCredentials || baseProfile.education || '',
    certifications: normalizedReview.certifications || baseProfile.certifications || '',
    keyCompetencies: normalizedReview.keyCompetencies.length ? normalizedReview.keyCompetencies.join('\n') : baseProfile.keyCompetencies || '',
    skills: normalizedReview.coreSkills.length
      ? normalizedReview.coreSkills.map((label) => ({ label, sourceType: 'human_review', confidence: 1 }))
      : baseProfile.skills || [],
    sections,
    warnings: baseProfile.warnings || [],
    confidence: Math.max(Number(baseProfile.confidence) || 0, 0.95),
    metadata: {
      ...(baseProfile.metadata || {}),
      humanReviewStatus: 'verified',
      humanReviewedAt: reviewedAt,
      inputTrustLevel: 'human_reviewed',
    },
  };
  const reviewedText = buildReviewedCvText(baseProfile, normalizedReview);

  const evidenceProfile = buildCvEvidenceProfile(reviewedProfile, reviewedText);

  return {
    ...reviewedProfile,
    reviewedText,
    evidenceProfile,
    cvAnalysis: buildCvAnalysis({ cvProfile: reviewedProfile, evidenceProfile, normalizedText: reviewedText }),
  };
};

export const saveReviewedCvProfile = async ({ cvId, userId, reviewProfile }) => {
  const cvDocument = await getOwnedCvDocumentOrThrow({ cvId, userId });
  const cvRecord = await getOwnedCvRecordOrThrow({ cvId, userId });
  const reviewedProfile = buildReviewedCvProfile({
    baseProfile: cvDocument.cvProfile || {},
    reviewProfile,
  });
  const displayProfile = buildCvDisplayView({
    fileRecord: {
      id: cvId,
      original_filename: cvRecord.name,
      mime_type: cvRecord.type,
      uploaded_at: new Date().toISOString(),
    },
    cvProfile: reviewedProfile,
  });

  await DocumentContent.findOneAndUpdate(
    { fileId: cvId, userId },
    {
      cvProfile: reviewedProfile,
      displayProfile,
      extractedSections: reviewedProfile.sections || [],
      parseWarnings: [],
      parseConfidence: reviewedProfile.confidence,
      normalizedText: reviewedProfile.reviewedText,
      redactedText: displayProfile.summary || '',
      cvProfileVersion: 'cv_profile_human_reviewed_v1',
      parserVersion: 'cv_parser_v2_human_reviewed',
    },
    { returnDocument: 'after' }
  );

  return getOwnedCvRecordOrThrow({ cvId, userId });
};
