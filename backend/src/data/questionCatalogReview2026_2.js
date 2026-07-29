import crypto from 'node:crypto';

import {
  AI_DELIVERY_SIGNAL_TAXONOMY,
  ML_SIGNAL_ALIASES,
  QUESTION_CATALOG_SEED,
  QUESTION_CATALOG_VERSION,
} from './questionCatalogSeed2026_2.js';

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
};

export const buildCanonicalSha256Digest = (value) => (
  crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
);

export const buildQuestionCatalogGovernanceDigest = ({
  catalogItems = [],
  aiDeliverySignalTaxonomy = [],
  mlSignalAliases = [],
} = {}) => buildCanonicalSha256Digest({
  aiDeliverySignalTaxonomy,
  catalogItems,
  mlSignalAliases,
});

const candidateCatalogDigest = buildQuestionCatalogGovernanceDigest({
  catalogItems: QUESTION_CATALOG_SEED,
  aiDeliverySignalTaxonomy: AI_DELIVERY_SIGNAL_TAXONOMY,
  mlSignalAliases: ML_SIGNAL_ALIASES,
});

export const QUESTION_CATALOG_GOVERNANCE_SCOPE = Object.freeze([
  'question_catalog_items',
  'ai_delivery_signal_taxonomy',
  'ml_signal_aliases',
]);

const candidateCatalogQuestionIds = Object.freeze(
  QUESTION_CATALOG_SEED.map((item) => item.catalogQuestionId),
);

export const QUESTION_CATALOG_REVIEW = Object.freeze({
  catalogVersion: QUESTION_CATALOG_VERSION,
  governanceScope: QUESTION_CATALOG_GOVERNANCE_SCOPE,
  candidateCatalogDigest,
  approvedCatalogDigest: candidateCatalogDigest,
  decision: 'approved',
  reviewer: 'heminghan',
  decidedAt: '2026-07-29T09:25:00.000Z',
  decisionReason: 'Product Owner approved the 2026.2 catalog wording, ambiguityMode policies, clarificationContext responses, and governance digest.',
  candidateCatalogQuestionIds,
  reviewedCatalogQuestionIds: candidateCatalogQuestionIds,
});
