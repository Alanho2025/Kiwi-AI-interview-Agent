import { streamSynthesizeSpeech } from './ttsProviderRouter.js';
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

  let firstPayload = null;
  let offset = 0;

  for await (const synthesis of streamSynthesizeSpeech({ text: cleanText, voiceName, usageContext })) {
    if (speechToken && !bargeInController?.isTokenActive?.(speechToken)) break;

    const payload = {
      type: 'tts_audio_chunk',
      tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
      base64: synthesis.audioBuffer.toString('base64'),
      contentType: synthesis.contentType,
      voiceName: synthesis.voiceName,
      outputFormat: synthesis.outputFormat,
      provider: synthesis.provider,
      index: index + offset,
      chunkIndex: synthesis.chunkIndex ?? offset,
      isStreaming: Boolean(synthesis.isStreaming),
      firstByteMs: synthesis.firstByteMs ?? null,
      text: cleanText,
      timestamp: new Date().toISOString(),
    };

    if (!firstPayload) firstPayload = payload;
    sendJson(payload);
    offset += 1;
  }

  return firstPayload;
};