import { getMongoReadyState } from '../../db/mongo.js';
import { QuestionCatalogItem } from '../../db/models/questionCatalogItemModel.js';
import {
  AI_DELIVERY_SIGNAL_TAXONOMY,
  ML_SIGNAL_ALIASES,
  QUESTION_CATALOG_SEED,
  QUESTION_CATALOG_VERSION,
} from '../../data/questionCatalogSeed2026_1.js';
import { QUESTION_CATALOG_REVIEW } from '../../data/questionCatalogReview2026_1.js';
import { QUESTION_CATALOG_VERSION as QUESTION_CATALOG_VERSION_2026_2 } from '../../data/questionCatalogSeed2026_2.js';
import { ensureArray } from '../../utils/commonHelpers.js';
import {
  buildQuestionCatalogSeedUpserts,
  validateQuestionCatalogReview,
} from './questionCatalogService.js';
import {
  QUESTION_SELECTION_POLICY_REVIEW,
  validateQuestionSelectionPolicyReview,
} from './questionCatalogPolicyReviewService.js';

export const QUESTION_CATALOG_VERSION_PREFERENCE = Object.freeze([
  QUESTION_CATALOG_VERSION_2026_2,
  QUESTION_CATALOG_VERSION,
]);

const resolveCatalogVersionCandidates = () => QUESTION_CATALOG_VERSION_PREFERENCE;

export const loadApprovedQuestionCatalogItems = async ({
  model = QuestionCatalogItem,
  getMongoReady = getMongoReadyState,
} = {}) => {
  if (getMongoReady() !== 1) return { status: 'catalog_unavailable', items: [] };
  try {
    const versions = resolveCatalogVersionCandidates();
    for (const version of versions) {
      const items = await model.find({ catalogVersion: version, lifecycle: 'approved' }).lean();
      if (items.length) return { status: 'ready', items, catalogVersion: version };
    }
    return { status: 'inactive', items: [], catalogVersion: versions[0] || null };
  } catch (error) {
    return { status: 'catalog_unavailable', items: [], error: error?.message || String(error) };
  }
};

export const seedQuestionCatalog = async ({ model = QuestionCatalogItem, items = QUESTION_CATALOG_SEED } = {}) => (
  model.bulkWrite(buildQuestionCatalogSeedUpserts(items), { ordered: false })
);

export const approveQuestionCatalogVersion = async ({
  catalogVersion = QUESTION_CATALOG_VERSION,
  reviewer = '',
  reviewRecord = QUESTION_CATALOG_REVIEW,
  policyReviewRecord = QUESTION_SELECTION_POLICY_REVIEW,
  catalogItems = QUESTION_CATALOG_SEED,
  aiDeliverySignalTaxonomy = AI_DELIVERY_SIGNAL_TAXONOMY,
  mlSignalAliases = ML_SIGNAL_ALIASES,
  model = QuestionCatalogItem,
} = {}) => {
  const normalizedReviewer = String(reviewer || '').trim();
  if (!normalizedReviewer) throw new Error('QUESTION_CATALOG_REVIEWER is required to approve a catalog version');
  const reviewValidation = validateQuestionCatalogReview({
    reviewRecord,
    catalogItems,
    aiDeliverySignalTaxonomy,
    mlSignalAliases,
    catalogVersion,
  });
  if (!reviewValidation.valid) {
    throw new Error(`Catalog activation requires an approved human review record: ${reviewValidation.errors.join(', ')}`);
  }
  const policyReviewValidation = validateQuestionSelectionPolicyReview({
    reviewRecord: policyReviewRecord,
  });
  if (!policyReviewValidation.valid) {
    throw new Error(`Catalog activation requires an approved Voice selection policy review record: ${policyReviewValidation.errors.join(', ')}`);
  }
  if (reviewRecord.catalogVersion !== catalogVersion) throw new Error('Catalog review version does not match the requested activation version');
  if (String(reviewRecord.reviewer || '').trim() !== normalizedReviewer) throw new Error('QUESTION_CATALOG_REVIEWER must match the approved review record');
  if (policyReviewRecord.policyVersion !== catalogVersion) throw new Error('Voice selection policy review version does not match the requested activation version');
  if (String(policyReviewRecord.reviewer || '').trim() !== normalizedReviewer) throw new Error('QUESTION_CATALOG_REVIEWER must match the approved Voice selection policy review record');
  const reviewedCatalogQuestionIds = ensureArray(reviewRecord.reviewedCatalogQuestionIds);
  const activationFilter = {
    catalogVersion,
    catalogQuestionId: { $in: reviewedCatalogQuestionIds },
    lifecycle: 'draft',
    'humanReview.decision': 'pending',
  };
  const matchingDraftCount = await model.countDocuments(activationFilter);
  if (matchingDraftCount !== reviewedCatalogQuestionIds.length) {
    throw new Error('Catalog activation preflight failed because the reviewed draft set is incomplete or has changed');
  }

  return model.updateMany(
    activationFilter,
    {
      $set: {
        lifecycle: 'approved',
        'humanReview.reviewer': normalizedReviewer,
        'humanReview.decision': 'approved',
        'humanReview.approvedAt': new Date(),
        'humanReview.decisionReason': reviewRecord.decisionReason,
      },
    },
  );
};
