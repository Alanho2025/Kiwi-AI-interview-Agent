const normalizeText = (value = '') => String(value || '').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export const deriveAbductiveState = ({ latestAnswer = '', currentTopic: _currentTopic = '', candidateState = {}, dynamicSlotState = {} } = {}) => {
  const tokens = tokenize(latestAnswer);
  let surprisingFact = null;
  let hiddenGap = null;
  let probeTopic = null;

  if (tokens.includes('production') && tokens.includes('not')) {
    surprisingFact = 'candidate has project exposure but lacks production shipping evidence';
    hiddenGap = 'deployment_depth';
    probeTopic = 'deployment';
  } else if (tokens.includes('jwt') || tokens.includes('security')) {
    surprisingFact = 'candidate mentions security controls';
    hiddenGap = candidateState?.specificityLevel === 'low' ? 'security_tradeoff_depth' : null;
    probeTopic = 'api_security';
  } else if (tokens.includes('team') && tokens.includes('own')) {
    surprisingFact = 'candidate describes teamwork but ownership boundary is unclear';
    hiddenGap = 'ownership_boundary';
    probeTopic = 'ownership';
  } else if (Array.isArray(dynamicSlotState.activeSlotTopics) && dynamicSlotState.activeSlotTopics.includes('decision_tradeoff')) {
    surprisingFact = 'decision trade-off signal emerged';
    hiddenGap = 'tradeoff_reasoning';
    probeTopic = 'decision_tradeoff';
  }

  return {
    surprisingFact,
    hiddenGap,
    probeTopic,
    shouldProbe: Boolean(hiddenGap && probeTopic),
  };
};
