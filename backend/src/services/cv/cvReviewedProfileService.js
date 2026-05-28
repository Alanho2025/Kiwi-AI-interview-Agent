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
  keyCompetencies: normalizeList(reviewProfile.keyCompetencies),
});

const hasReviewContent = (reviewProfile = {}) => Boolean(
  reviewProfile.candidateSummary
  || reviewProfile.coreSkills.length
  || reviewProfile.experienceEvidence
  || reviewProfile.projectEvidence
  || reviewProfile.educationCredentials
  || reviewProfile.keyCompetencies.length
);

const buildSection = (key, title, content) => ({
  key,
  title,
  content,
  lineCount: String(content || '').split('\n').filter((line) => line.trim()).length,
});

const upsertReviewedSections = (existingSections = [], reviewProfile = {}) => {
  const preservedSections = existingSections.filter((section) => !REVIEW_SECTION_KEYS.has(section.key));
  const reviewedSections = [
    buildSection('personal_statement', 'Candidate summary', reviewProfile.candidateSummary),
    buildSection('skills', 'Core skills', reviewProfile.coreSkills.join('\n')),
    buildSection('experience', 'Experience evidence', reviewProfile.experienceEvidence),
    buildSection('projects', 'Project evidence', reviewProfile.projectEvidence),
    buildSection('education', 'Education and credentials', reviewProfile.educationCredentials),
    buildSection('key_competencies', 'Key competencies', reviewProfile.keyCompetencies.join('\n')),
  ].filter((section) => section.content);

  return [...preservedSections, ...reviewedSections];
};

const buildReviewedCvText = (reviewProfile = {}) => [
  'Candidate summary',
  reviewProfile.candidateSummary,
  'Core skills',
  reviewProfile.coreSkills.join('\n'),
  'Experience evidence',
  reviewProfile.experienceEvidence,
  'Project evidence',
  reviewProfile.projectEvidence,
  'Education and credentials',
  reviewProfile.educationCredentials,
  'Key competencies',
  reviewProfile.keyCompetencies.join('\n'),
].filter(Boolean).join('\n');

export const buildReviewedCvProfile = ({ baseProfile = {}, reviewProfile = {}, reviewedAt = new Date().toISOString() } = {}) => {
  const normalizedReview = normalizeReviewedCvProfile(reviewProfile);
  if (!hasReviewContent(normalizedReview)) {
    throw badRequest('Missing CV review fields', 'At least one reviewed CV field is required.');
  }

  const sections = upsertReviewedSections(baseProfile.sections || [], normalizedReview);
  const reviewedProfile = {
    ...baseProfile,
    schemaVersion: baseProfile.schemaVersion || 'cv_profile_v1',
    personalStatement: normalizedReview.candidateSummary,
    summary: normalizedReview.candidateSummary,
    experience: normalizedReview.experienceEvidence,
    projects: normalizedReview.projectEvidence,
    education: normalizedReview.educationCredentials,
    certifications: '',
    keyCompetencies: normalizedReview.keyCompetencies.join('\n'),
    skills: normalizedReview.coreSkills.map((label) => ({
      label,
      sourceType: 'human_review',
      confidence: 1,
    })),
    sections,
    warnings: [],
    confidence: Math.max(Number(baseProfile.confidence) || 0, 0.95),
    metadata: {
      ...(baseProfile.metadata || {}),
      humanReviewStatus: 'verified',
      humanReviewedAt: reviewedAt,
      inputTrustLevel: 'human_reviewed',
    },
  };
  const reviewedText = buildReviewedCvText(normalizedReview);

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
