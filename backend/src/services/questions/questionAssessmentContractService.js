import { normalizeKey } from '../../utils/commonHelpers.js';

const ROLE_SPECIFIC_DIMENSIONS = {
  validation: ['validationVerification', 'outcomeValue'],
  technical_depth: ['approach', 'validationVerification'],
  tradeoff: ['judgementTradeoffs', 'validationVerification'],
  constraint: ['judgementTradeoffs', 'riskQualityEthics'],
  failure: ['approach', 'outcomeValue'],
};

const BEHAVIOURAL_DIMENSIONS = {
  ownership: ['action'],
  behavioural_action: ['action'],
  result: ['resultOrReaction'],
  reflection: ['reflection'],
};

export const SIGNAL_ALIAS_MAP = new Map([
  ['ownership', 'personal_ownership'],
  ['personal_ownership', 'personal_ownership'],
  ['result', 'result_or_validation'],
  ['measurable_result', 'result_or_validation'],
  ['result_or_validation', 'result_or_validation'],
  ['tradeoff', 'tradeoff_or_constraint'],
  ['tradeoff_or_constraint', 'tradeoff_or_constraint'],
]);

export const normalizeEvidenceSignalId = (id = '') =>
  SIGNAL_ALIAS_MAP.get(String(id || '').toLowerCase()) || String(id || '').toLowerCase();

export const resolveFollowUpAssessmentContract = ({
  intent = '',
  parentQuestionFamily = '',
  parentEvidenceMode = 'past_example',
} = {}) => {
  const normalizedIntent = normalizeKey(intent).replaceAll('-', '_');
  const normalizedParentFamily = normalizeKey(parentQuestionFamily).replace('behavioral', 'behavioural');

  if (ROLE_SPECIFIC_DIMENSIONS[normalizedIntent]) {
    return {
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      targetedDimensions: ROLE_SPECIFIC_DIMENSIONS[normalizedIntent],
    };
  }

  if (BEHAVIOURAL_DIMENSIONS[normalizedIntent] && normalizedParentFamily === 'behavioural') {
    return {
      questionFamily: 'behavioural',
      evidenceMode: 'past_example',
      targetedDimensions: BEHAVIOURAL_DIMENSIONS[normalizedIntent],
    };
  }

  return {
    questionFamily: normalizedParentFamily || 'role_specific',
    evidenceMode: normalizeKey(parentEvidenceMode) || 'past_example',
    targetedDimensions: [],
  };
};

export const resolveQuestionAssessmentContract = ({
  questionId = '',
  intent = '',
  parentQuestionFamily = '',
  parentEvidenceMode = 'past_example',
  requiredSignals = [],
  collectedSignals = [],
} = {}) => {
  const baseContract = resolveFollowUpAssessmentContract({ intent, parentQuestionFamily, parentEvidenceMode });

  // 1. Deduplicate normalized required signals
  const normalizedRequired = [...new Set((requiredSignals || []).map(normalizeEvidenceSignalId))];
  const supportedSignalMap = new Map();
  const conflictSignals = [];

  (collectedSignals || []).forEach((cs) => {
    if (cs?.signalId) {
      const normalized = normalizeEvidenceSignalId(cs.signalId);
      if (cs.status === 'supported') {
        const existing = supportedSignalMap.get(normalized);
        if (!existing || (cs.confidence || 0) > (existing.confidence || 0)) {
          supportedSignalMap.set(normalized, cs);
        }
      } else if (cs.status === 'contradicted') {
        conflictSignals.push(normalized);
      }
    }
  });

  const missingSignals = normalizedRequired.filter((req) => !supportedSignalMap.has(req));
  const matchedEvidence = normalizedRequired.map((sig) => supportedSignalMap.get(sig)).filter(Boolean);

  let satisfactionStatus = 'unsatisfied';
  if (!normalizedRequired.length) {
    satisfactionStatus = 'unverifiable';
  } else if (conflictSignals.length > 0) {
    satisfactionStatus = 'partially_satisfied';
  } else if (missingSignals.length === 0) {
    satisfactionStatus = 'satisfied';
  } else if (matchedEvidence.length > 0) {
    satisfactionStatus = 'partially_satisfied';
  }

  // 2. Aggregate confidence ONLY from matched required signals (Not unrelated collected signals!)
  const confidence = matchedEvidence.length
    ? Number((matchedEvidence.reduce((sum, item) => sum + (item.confidence ?? 0.8), 0) / matchedEvidence.length).toFixed(2))
    : null;

  return {
    ...baseContract,
    questionId,
    requiredSignals: normalizedRequired,
    collectedSignals,
    missingSignals,
    satisfactionStatus,
    conflictSignals,
    requiresClarification: conflictSignals.length > 0,
    confidence,
  };
};

export default resolveQuestionAssessmentContract;
