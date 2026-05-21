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
  usageContext = null,
} = {}) => {
  const cleanText = String(text || '').trim();
  if (!cleanText || !sendJson) return null;
  if (speechToken && !bargeInController?.isTokenActive?.(speechToken)) return null;

  try {
    console.log(`[TTS-TRACE] Requesting speech synthesis for text: "${cleanText.substring(0, 30)}..."`);
    const synthesis = await synthesizeSpeech({ text: cleanText, voiceName, usageContext });
    console.log(`[TTS-TRACE] Synthesis received, audio length: ${synthesis.audioBuffer.length} bytes`);
    if (speechToken && !bargeInController?.isTokenActive?.(speechToken)) {
      console.log(`[TTS-TRACE] Token inactive after synthesis, discarding audio.`);
      return null;
    }

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
    console.log(`[TTS-TRACE] Sending TTS audio chunk (index: ${index}) to frontend.`);
    sendJson(payload);
    return payload;
  } catch (error) {
    console.error(`[TTS-TRACE] TTS Stream failed: ${error.message}`);
    sendJson?.({
      type: 'error',
      tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
      code: 'TTS_STREAM_FAILED',
      message: error.message || 'TTS Synthesis failed',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};
