import crypto from 'node:crypto';

const BUSINESS_MODEL_PATTERN = /\b(product|products|platform|software|service|services|solution|solutions|analytics|decision-support|dashboard|dashboards)\b/i;
const CUSTOMER_PATTERN = /\b(customer|customers|user|users|teams?|leaders?|operators?|field|energy|internal)\b/i;
const PRODUCT_PATTERN = /\b(product|products|platform|software|dashboard|dashboards|analytics|planning|tool|tools|data)\b/i;
const OPERATING_CONTEXT_PATTERN = /\b(manual|workflow|workflows|reporting|operations?|field|planning|decision|decisions|internal)\b/i;

const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const stableId = (prefix, ...parts) => {
  const digest = crypto.createHash('sha256').update(parts.map(normalizeText).join('\n')).digest('hex').slice(0, 18);
  return `${prefix}:${digest}`;
};

const toEvidenceRef = (fact = {}) => ({
  sourceType: fact.sourceType || fact.sourceTrace?.sourceType || 'company_context',
  sourceId: fact.id || null,
  sourceLabel: fact.sourceLabel || '',
  excerpt: fact.statement || fact.sourceTrace?.rawSnippet || '',
  url: fact.sourceTrace?.url || null,
  section: fact.sourceTrace?.section || null,
  sourceConfidence: fact.sourceConfidence || 'medium',
  reviewConfidence: fact.reviewConfidence || 'unreviewed',
});

const buildDetailItem = ({ prefix, fact, fallbackClaimStatus = null } = {}) => ({
  id: stableId(prefix, fact?.id || '', fact?.statement || ''),
  statement: fact.statement,
  evidenceRefs: [toEvidenceRef(fact)],
  sourceConfidence: fact.sourceConfidence || 'medium',
  reviewConfidence: fact.reviewConfidence || 'unreviewed',
  claimStatus: fallbackClaimStatus || fact.claimStatus || 'needs_confirmation',
  uncertainty: fact.uncertainty || 'Review this company understanding before using it for interview preparation.',
});

const firstFactMatching = (facts = [], pattern) => facts.find((fact) => (
  fact?.statement
  && fact.sourceType !== 'supplied_url_only'
  && pattern.test(fact.statement)
));

const buildDetailBucket = ({ facts, pattern, prefix }) => {
  const fact = firstFactMatching(facts, pattern);
  return fact ? [buildDetailItem({ prefix, fact })] : [];
};

const strongestSourceConfidence = (items = []) => {
  const confidences = items.map((item) => item.sourceConfidence).filter(Boolean);
  if (confidences.includes('high')) return 'high';
  if (confidences.includes('medium')) return 'medium';
  if (confidences.includes('low')) return 'low';
  return 'unsupported';
};

const buildHiringContextHypotheses = ({
  companyName = '',
  customersOrUsers = [],
  operatingContext = [],
  productsOrServices = [],
} = {}) => {
  const evidenceRefs = [...operatingContext, ...customersOrUsers, ...productsOrServices]
    .flatMap((item) => item.evidenceRefs || [])
    .slice(0, 4);
  if (!evidenceRefs.length) return [];

  const contextText = operatingContext[0]?.statement || productsOrServices[0]?.statement || 'the reviewed company context';
  const userText = customersOrUsers[0]?.statement || 'the target users or customers';

  return [{
    id: stableId('hiring-context', companyName, contextText, userText),
    statement: `${companyName || 'The employer'} may need this role to improve ${contextText} for ${userText}.`,
    evidenceRefs,
    sourceConfidence: strongestSourceConfidence([
      ...operatingContext,
      ...customersOrUsers,
      ...productsOrServices,
    ]),
    reviewConfidence: 'unreviewed',
    claimStatus: 'needs_confirmation',
    uncertainty: 'This hiring context is a preparation hypothesis and must be reviewed before matching or reporting.',
  }];
};

export const buildCompanyUnderstandingDetails = ({ companyName = '', facts = [] } = {}) => {
  const usableFacts = facts.filter((fact) => fact?.statement && fact.sourceType !== 'supplied_url_only');
  const businessModel = buildDetailBucket({ facts: usableFacts, pattern: BUSINESS_MODEL_PATTERN, prefix: 'business-model' });
  const customersOrUsers = buildDetailBucket({ facts: usableFacts, pattern: CUSTOMER_PATTERN, prefix: 'customers-users' });
  const productsOrServices = buildDetailBucket({ facts: usableFacts, pattern: PRODUCT_PATTERN, prefix: 'products-services' });
  const operatingContext = buildDetailBucket({ facts: usableFacts, pattern: OPERATING_CONTEXT_PATTERN, prefix: 'operating-context' });

  return {
    schemaVersion: 'company_understanding_v2',
    businessModel,
    customersOrUsers,
    productsOrServices,
    operatingContext,
    hiringContextHypotheses: buildHiringContextHypotheses({
      companyName,
      customersOrUsers,
      operatingContext,
      productsOrServices,
    }),
    reviewStatus: usableFacts.length ? 'needs_review' : 'failed',
  };
};
