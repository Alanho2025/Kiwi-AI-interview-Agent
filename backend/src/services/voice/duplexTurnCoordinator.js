/**
 * File responsibility: Duplex voice turn coordinator.
 * Main responsibilities:
 * - Submit final STT text into the adaptive interview engine.
 * - Stream generated assistant sentences as text and TTS chunks.
 * - Return the final session update through the duplex WebSocket.
 */

import { processRealtimeVoiceTurn } from './realtimeVoiceTurnService.js';
import { streamAssistantSpeech } from './ttsStreamQueue.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

export const createDuplexTurnCoordinator = ({
  session,
  userId,
  voiceName,
  language,
  sendJson,
  bargeInController,
  logger,
} = {}) => {
  let sentenceIndex = 0;

  const processFinalTranscript = async ({ transcriptText, asrConfidence = null, vad = null } = {}) => {
    const cleanTranscript = String(transcriptText || '').trim();
    if (!cleanTranscript) return null;

    sendJson?.({
      type: 'agent_thinking',
      tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
      timestamp: new Date().toISOString(),
    });

    const speechToken = bargeInController?.startAssistantSpeech?.();
    sentenceIndex = 0;

    const result = await processRealtimeVoiceTurn({
      session,
      userId,
      transcriptText: cleanTranscript,
      language,
      asrConfidence,
      asrSource: 'azure_realtime_duplex',
      voiceName,
      inputMode: 'duplex_voice',
      vad,
      onSentence: async (text, index) => {
        const nextIndex = Number.isFinite(index) ? index : sentenceIndex;
        sentenceIndex = nextIndex + 1;
        if (!bargeInController?.isTokenActive?.(speechToken)) return;
        sendJson?.({
          type: 'assistant_text_delta',
          tool: AGENT_TOOL_NAMES.GENERATE_INTERVIEW_QUESTION,
          text,
          index: nextIndex,
          timestamp: new Date().toISOString(),
        });
        await streamAssistantSpeech({
          text,
          voiceName,
          sendJson,
          bargeInController,
          index: nextIndex,
          speechToken,
        });
      },
    });

    bargeInController?.finishAssistantSpeech?.(speechToken);
    sendJson?.({
      type: 'assistant_speech_done',
      tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
      timestamp: new Date().toISOString(),
    });
    sendJson?.({
      type: 'turn_done',
      tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
      session: result?.updatedSession || null,
      transcription: result?.transcription || null,
      latency: result?.latency || null,
      isComplete: Boolean(result?.agentResult?.isComplete),
      completedBecause: result?.agentResult?.completedBecause || null,
      timestamp: new Date().toISOString(),
    });

    logger?.info?.('Duplex voice turn completed', {
      sessionId: session?.id,
      isComplete: Boolean(result?.agentResult?.isComplete),
    });
    return result;
  };

  return { processFinalTranscript };
};
