const INTERVIEWER_BRIDGE_PHRASES = {
  general: [
    'Thank you.',
    'I see.',
    'Understood.',
    'That helps.',
    'Thanks for that.',
    'That is useful context.',
    'I follow.',
    'That is clear.',
  ],
  project: [
    'I see your approach.',
    'That explains your method.',
    'I understand the project.',
  ],
  behavioural: [
    'That gives me context.',
    'I see the situation.',
  ],
  followUp: [
    'Let me ask about that.',
    'I will ask one follow-up.',
  ],
};

const FORBIDDEN_BRIDGE_TERMS = [
  'cv',
  'resume',
  'jd',
  'job description',
  'profile',
  'match',
  'analysis',
  'check',
  'review your',
  'compare',
];

const CLEAR_NEXT_ACTIONS = new Set([
  'ASK_NEXT_PLANNED_QUESTION',
  'ASK_INTRO_QUESTION',
  'ASK_CLOSING_QUESTION',
]);

const FOLLOW_UP_ACTION_PREFIXES = ['PROBE_', 'FOLLOW_UP_', 'CLARIFY_'];

const normalize = (value = '') => String(value || '').trim().toLowerCase();

export const containsForbiddenBridgeText = (phrase = '') => {
  const text = normalize(phrase);
  return FORBIDDEN_BRIDGE_TERMS.some((term) => text.includes(term));
};

const unique = (items = []) => [...new Set(items.filter(Boolean))];

export const getBridgePhrasePool = ({
  expectedNextAction = null,
  currentSection = null,
  questionType = null,
} = {}) => {
  const action = String(expectedNextAction || '').trim();
  const section = normalize(currentSection);
  const type = normalize(questionType);

  if (CLEAR_NEXT_ACTIONS.has(action)) {
    return INTERVIEWER_BRIDGE_PHRASES.general;
  }

  const isFollowUp = FOLLOW_UP_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
  if (isFollowUp) {
    return unique([
      ...INTERVIEWER_BRIDGE_PHRASES.general,
      ...INTERVIEWER_BRIDGE_PHRASES.followUp,
    ]);
  }

  if (type === 'technical' || section.includes('project')) {
    return unique([
      ...INTERVIEWER_BRIDGE_PHRASES.general,
      ...INTERVIEWER_BRIDGE_PHRASES.project,
    ]);
  }

  if (type === 'behavioural' || type === 'behavioral') {
    return unique([
      ...INTERVIEWER_BRIDGE_PHRASES.general,
      ...INTERVIEWER_BRIDGE_PHRASES.behavioural,
    ]);
  }

  return unique([
    ...INTERVIEWER_BRIDGE_PHRASES.general,
    ...INTERVIEWER_BRIDGE_PHRASES.project,
    ...INTERVIEWER_BRIDGE_PHRASES.behavioural,
  ]);
};

export const pickUnusedBridgePhrase = ({
  usedPhrases = [],
  expectedNextAction = null,
  currentSection = null,
  questionType = null,
} = {}) => {
  const used = new Set(usedPhrases);
  const pool = getBridgePhrasePool({ expectedNextAction, currentSection, questionType });
  const safePool = pool.filter((phrase) => !containsForbiddenBridgeText(phrase));
  const unused = safePool.filter((phrase) => !used.has(phrase));
  const candidates = unused.length > 0 ? unused : safePool;
  const index = Math.floor(Math.random() * candidates.length);

  return candidates[index] || 'Thank you.';
};

export const isLatencyAcknowledgementAvailable = () => (
  typeof window !== 'undefined' &&
  typeof window.SpeechSynthesisUtterance === 'function' &&
  window.speechSynthesis &&
  typeof window.speechSynthesis.speak === 'function'
);

export const playLatencyAcknowledgement = ({
  usedPhrases = [],
  expectedNextAction = null,
  currentSection = null,
  questionType = null,
  volume = 0.72,
  rate = 1.02,
} = {}) => {
  if (import.meta.env.VITE_VOICE_LATENCY_FILLERS !== 'true') return null;
  if (!isLatencyAcknowledgementAvailable()) return null;

  const phrase = pickUnusedBridgePhrase({
    usedPhrases,
    expectedNextAction,
    currentSection,
    questionType,
  });

  const utterance = new window.SpeechSynthesisUtterance(phrase);
  utterance.lang = 'en-NZ';
  utterance.volume = volume;
  utterance.rate = rate;
  window.speechSynthesis.cancel?.();
  window.speechSynthesis.speak(utterance);
  return phrase;
};

export const cancelLatencyAcknowledgement = () => {
  if (!isLatencyAcknowledgementAvailable()) return;
  window.speechSynthesis.cancel?.();
};
