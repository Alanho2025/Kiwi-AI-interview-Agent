const DEFAULT_ACKNOWLEDGEMENTS = [
  'Got it.',
  'Thanks, give me a moment.',
  'Let me think about that.',
  'I am looking at your example.',
];

export const isLatencyAcknowledgementAvailable = () => (
  typeof window !== 'undefined' &&
  typeof window.SpeechSynthesisUtterance === 'function' &&
  window.speechSynthesis &&
  typeof window.speechSynthesis.speak === 'function'
);

export const playLatencyAcknowledgement = ({ index = 0, volume = 0.72, rate = 1.02 } = {}) => {
  if (!isLatencyAcknowledgementAvailable()) return false;

  const phrase = DEFAULT_ACKNOWLEDGEMENTS[Math.abs(index) % DEFAULT_ACKNOWLEDGEMENTS.length];
  const utterance = new window.SpeechSynthesisUtterance(phrase);
  utterance.lang = 'en-NZ';
  utterance.volume = volume;
  utterance.rate = rate;
  window.speechSynthesis.cancel?.();
  window.speechSynthesis.speak(utterance);
  return true;
};

export const cancelLatencyAcknowledgement = () => {
  if (!isLatencyAcknowledgementAvailable()) return;
  window.speechSynthesis.cancel?.();
};
