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

