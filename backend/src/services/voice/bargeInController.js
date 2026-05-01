/**
 * File responsibility: Duplex voice barge-in controller.
 * Main responsibilities:
 * - Track the currently speaking assistant turn.
 * - Cancel pending TTS chunks when the user starts speaking.
 * - Emit a report-friendly tool trace for interruption behaviour.
 */

import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

export const createBargeInController = ({ sendJson, logger, sessionId } = {}) => {
  let currentSpeechToken = null;
  let isAssistantSpeaking = false;

  const startAssistantSpeech = () => {
    currentSpeechToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    isAssistantSpeaking = true;
    return currentSpeechToken;
  };

  const finishAssistantSpeech = (token) => {
    if (token && token !== currentSpeechToken) return false;
    isAssistantSpeaking = false;
    currentSpeechToken = null;
    return true;
  };

  const isTokenActive = (token) => Boolean(token && token === currentSpeechToken && isAssistantSpeaking);

  const handleBargeIn = (reason = 'user_started_speaking') => {
    const interruptedToken = currentSpeechToken;
    const wasSpeaking = isAssistantSpeaking;
    isAssistantSpeaking = false;
    currentSpeechToken = null;

    const payload = {
      type: 'barge_in_ack',
      tool: AGENT_TOOL_NAMES.HANDLE_VOICE_BARGE_IN,
      interrupted: wasSpeaking,
      speechToken: interruptedToken,
      reason,
      timestamp: new Date().toISOString(),
    };

    logger?.info?.('Duplex voice barge-in handled', { sessionId, ...payload });
    sendJson?.(payload);
    return payload;
  };

  return {
    startAssistantSpeech,
    finishAssistantSpeech,
    isTokenActive,
    handleBargeIn,
    getState: () => ({ currentSpeechToken, isAssistantSpeaking }),
  };
};
