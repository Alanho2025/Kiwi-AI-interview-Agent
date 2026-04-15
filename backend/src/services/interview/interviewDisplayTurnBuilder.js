const FEEDBACK_VARIANTS = {
  deepen: [
    'Thanks, that gives me enough context.',
    'That helps. I want to go a bit deeper there.',
    'I can see the outline. Let me push one layer further.'
  ],
  probe: [
    'Thanks, that helps.',
    'I see what you mean.',
    'That gives me a starting point.'
  ],
  rephrase: [
    'I think we may be crossing wires on that one.',
    'Let me make that clearer.',
    'I want to restate that more simply.'
  ],
  shift_section: [
    'Good, that gives me enough on that area.',
    'Thanks. I have enough context there.',
    'That helps. Let us move to the next area.'
  ],
  technical_shift: [
    'Thanks. Let us shift to the technical side of your work.',
    'That helps. I want to test the technical part more directly now.',
    'Good. I now want to focus on implementation and technical decisions.'
  ],
  validation: [
    'That is useful, but I want to validate one part of it.',
    'I want to test that claim a bit more directly.',
    'That helps. I want one sharper piece of evidence there.'
  ],
  wrap: [
    'We are close to the end, so I have one final question.',
    'Before we wrap up, I want to finish with one last point.',
    'That gives me enough context. Let me close with one final question.'
  ],
};

const normalizeMode = (value = '') => String(value || '').trim().toLowerCase();

const pickVariant = (list = [], seed = '') => {
  if (!list.length) return '';
  const hash = Array.from(String(seed || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return list[hash % list.length];
};

const resolveFeedbackMode = ({ actionType = '', questionCategory = '', stage = '', suggestedNextMode = '', shouldCloseSoon = false } = {}) => {
  const normalizedAction = normalizeMode(actionType);
  const normalizedCategory = normalizeMode(questionCategory);
  const normalizedStage = normalizeMode(stage);
  const normalizedSuggestedMode = normalizeMode(suggestedNextMode);

  if (shouldCloseSoon || normalizedAction.includes('wrap') || normalizedStage.includes('wrap')) return 'wrap';
  if (normalizedAction.includes('rephrase') || normalizedSuggestedMode === 'rephrase') return 'rephrase';
  if (normalizedAction.includes('shift')) return normalizedCategory === 'technical' || normalizedStage.includes('technical') ? 'technical_shift' : 'shift_section';
  if (normalizedAction.includes('validation')) return 'validation';
  if (normalizedAction.includes('probe') || normalizedSuggestedMode === 'probe') return 'probe';
  if (normalizedAction.includes('deep') || normalizedSuggestedMode === 'deepen') return 'deepen';
  if (normalizedCategory === 'technical' || normalizedStage.includes('technical')) return 'technical_shift';
  return 'probe';
};

export const buildInterviewDisplayTurn = ({
  question = '',
  actionType = '',
  questionCategory = '',
  stage = '',
  targetTopic = '',
  suggestedNextMode = '',
  shouldCloseSoon = false,
} = {}) => {
  const feedbackMode = resolveFeedbackMode({ actionType, questionCategory, stage, suggestedNextMode, shouldCloseSoon });
  const preamble = pickVariant(FEEDBACK_VARIANTS[feedbackMode] || FEEDBACK_VARIANTS.probe, `${feedbackMode}:${targetTopic}:${question}`);
  const displayText = preamble ? `${preamble}\n\n${question}` : question;
  return {
    feedbackMode,
    preamble,
    question,
    displayText,
  };
};
