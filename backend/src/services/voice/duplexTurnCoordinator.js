/**
 * File responsibility: Duplex voice turn coordinator.
 * Main responsibilities:
 * - Submit final STT text into the adaptive interview engine.
 * - Stream generated assistant sentences as text and TTS chunks.
 * - Return the final session update through the duplex WebSocket.
 */

import { processRealtimeVoiceTurn } from './realtimeVoiceTurnService.js';
import { streamAssistantSpeech } from './ttsStreamQueue.js';
import { assessRealtimeVoiceTranscript } from './speechConfidenceGate.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

export const createDuplexTurnCoordinator = ({
  session,
  userId,
  voiceName,
  language,
  asrSource = 'realtime_duplex',
  sendJson,
  bargeInController,
  logger,
} = {}) => {
  let sentenceIndex = 0;

  const streamRepairPrompt = async ({ assessment, transcriptText, asrConfidence }) => {
    const repairText = assessment?.message || 'I did not catch that clearly. Please repeat your answer.';
    const speechToken = bargeInController?.startAssistantSpeech?.();
    sendJson?.({
      type: 'transcript_rejected',
      tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
      reason: assessment?.reason || 'TRANSCRIPT_REJECTED',
      message: repairText,
      transcription: {
        accepted: false,
        text: transcriptText,
        confidence: asrConfidence,
        confidenceGate: assessment?.confidenceGate || null,
        metrics: assessment?.metrics || null,
      },
      timestamp: new Date().toISOString(),
    });
    sendJson?.({
      type: 'assistant_text_delta',
      tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
      text: repairText,
      index: 0,
      timestamp: new Date().toISOString(),
    });
    await streamAssistantSpeech({
      text: repairText,
      voiceName,
      sendJson,
      bargeInController,
        index: 0,
        speechToken,
        usageContext: {
          userId,
          sessionId: session?.id || null,
          stage: 'interview',
          source: 'duplex_repair_prompt',
        },
      });
    bargeInController?.finishAssistantSpeech?.(speechToken);
    sendJson?.({
      type: 'assistant_speech_done',
      tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
      timestamp: new Date().toISOString(),
    });
    return {
      transcriptRejected: true,
      assessment,
    };
  };

  const processFinalTranscript = async ({ transcriptText, asrConfidence = null, vad = null } = {}) => {
    const cleanTranscript = String(transcriptText || '').trim();
    const assessment = assessRealtimeVoiceTranscript({
      transcriptText: cleanTranscript,
      asrConfidence,
      vad,
    });
    if (!assessment.ok) {
      logger?.info?.('Duplex voice transcript rejected before scoring', {
        sessionId: session?.id,
        reason: assessment.reason,
        confidenceStatus: assessment.confidenceGate?.status,
        metrics: assessment.metrics,
      });
      return streamRepairPrompt({ assessment, transcriptText: cleanTranscript, asrConfidence });
    }

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
      asrSource,
      voiceName,
      inputMode: 'duplex_voice',
      vad,
      onSentence: async (text, index) => {
        try {
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
            usageContext: {
              userId,
              sessionId: session?.id || null,
              stage: 'interview',
              source: 'duplex_interview_sentence',
            },
          });
        } catch (error) {
          logger?.error?.('Failed to process sentence in duplex turn', { sessionId: session?.id, index, text, error: error.message });
        }
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
