/**
 * File responsibility: Text-to-speech streaming helper for duplex voice.
 * Main responsibilities:
 * - Convert text or sentence chunks into assistant audio chunks.
 * - Stop sending chunks when barge-in cancels the active speech token.
 * - Add formal tool names to all emitted TTS messages.
 */

import { synthesizeSpeech } from './azureSpeechService.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

export const streamAssistantSpeech = async ({
  text,
  voiceName,
  sendJson,
  bargeInController,
  index = 0,
  speechToken = null,
} = {}) => {
  const cleanText = String(text || '').trim();
  if (!cleanText || !sendJson) return null;
  if (speechToken && !bargeInController?.isTokenActive?.(speechToken)) return null;

  const synthesis = await synthesizeSpeech({ text: cleanText, voiceName });
  if (speechToken && !bargeInController?.isTokenActive?.(speechToken)) return null;

  const payload = {
    type: 'tts_audio_chunk',
    tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
    base64: synthesis.audioBuffer.toString('base64'),
    contentType: synthesis.contentType,
    voiceName: synthesis.voiceName,
    outputFormat: synthesis.outputFormat,
    index,
    text: cleanText,
    timestamp: new Date().toISOString(),
  };
  sendJson(payload);
  return payload;
};
