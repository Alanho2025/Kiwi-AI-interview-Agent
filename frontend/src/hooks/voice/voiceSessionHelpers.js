const normaliseText = (value, fallback = '') => {
  if (value instanceof Error) return value.message || fallback;
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
};

export const buildVoiceStatus = (type, title, message) => ({
  type,
  title: normaliseText(title, 'Voice status'),
  message: normaliseText(message, 'Voice mode is updating.'),
});

export const formatDurationLabel = (valueMs = 0) => {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const getLatestTurnByRole = (transcript = [], role) => {
  const filteredTurns = transcript.filter((message) => message.role === role);
  return filteredTurns[filteredTurns.length - 1] || null;
};

export const resolveSessionId = (session, explicitSessionId) => explicitSessionId || session?.id || session?._id || session?.sessionId || '';

export const getLatestAssistantQuestionText = (sourceSession, preferDisplayText = true) => {
  const latestQuestion = getLatestTurnByRole(sourceSession?.transcript || [], 'ai');
  const displayText = String(latestQuestion?.displayText || '').trim();
  const rawText = String(latestQuestion?.text || '').trim();
  return preferDisplayText ? (displayText || rawText) : (rawText || displayText);
};

export const buildTranscriptFromTurnPayload = (payload = {}) => {
  const text = payload?.transcription?.text;
  if (!text) return null;

  const confidence = payload.transcription.confidence ?? null;
  return {
    displayText: text,
    normalizedText: text,
    rawText: text,
    confidence,
    confidenceStatus: confidence != null ? `${Math.round(confidence * 100)}%` : 'unknown',
  };
};

export const getVoiceStateLabel = (voiceState) => {
  switch (voiceState) {
    case 'requesting_permission': return 'Requesting mic access';
    case 'permission_denied': return 'Microphone blocked';
    case 'ready': return 'Duplex voice ready';
    case 'starting': return 'Starting duplex voice';
    case 'ai_speaking': return 'KiwiCoach speaking';
    case 'arming_mic': return 'Opening microphone';
    case 'listening': return 'Listening';
    case 'user_speaking': return 'Answering';
    case 'interrupted': return 'Interrupted';
    case 'agent_thinking': return 'Processing answer';
    case 'repair_prompt': return 'Please repeat';
    case 'ending': return 'Ending voice session';
    case 'error': return 'Voice error';
    default: return 'Idle';
  }
};
