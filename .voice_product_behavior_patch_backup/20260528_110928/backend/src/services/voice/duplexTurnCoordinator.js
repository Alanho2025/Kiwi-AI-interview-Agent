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
import warmContextService from './voiceTurnWarmContextService.js';

export const createDuplexTurnCoordinator = ({
  session,
  userId,
  voiceName,
  language,
  asrSource = 'realtime_duplex',
  sendJson,
  bargeInController,
  logger,
  clientTurnId = null,
} = {}) => {
  let sentenceIndex = 0;

  const trace = (message, payload = {}) => {
    logger?.info?.(`[DUPLEX-TURN-TRACE] ${message}`, {
      sessionId: session?.id || null,
      userId: userId || null,
      language,
      asrSource,
      clientTurnId,
      at: new Date().toISOString(),
      ...payload,
    });
  };

  const streamRepairPrompt = async ({ assessment, transcriptText, asrConfidence }) => {
    const repairText = assessment?.message || 'I did not catch that clearly. Please repeat your answer.';
    trace('stream_repair_prompt_start', {
      reason: assessment?.reason || 'TRANSCRIPT_REJECTED',
      transcriptText,
      asrConfidence,
      confidenceGate: assessment?.confidenceGate || null,
      metrics: assessment?.metrics || null,
      repairText,
    });
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
    trace('stream_repair_prompt_done', {
      reason: assessment?.reason || 'TRANSCRIPT_REJECTED',
    });
    return {
      transcriptRejected: true,
      assessment,
    };
  };

  const processFinalTranscript = async ({ transcriptText, asrConfidence = null, vad = null } = {}) => {
    const startedAt = Date.now();
    const cleanTranscript = String(transcriptText || '').trim();
    trace('process_final_transcript_start', {
      transcriptText: cleanTranscript,
      transcriptLength: cleanTranscript.length,
      words: cleanTranscript ? cleanTranscript.split(/\s+/).filter(Boolean).length : 0,
      asrConfidence,
      vad,
    });
    const assessment = assessRealtimeVoiceTranscript({
      transcriptText: cleanTranscript,
      asrConfidence,
      vad,
    });
    trace('confidence_gate_assessed', {
      ok: assessment.ok,
      reason: assessment.reason,
      message: assessment.message,
      confidenceGate: assessment.confidenceGate || null,
      metrics: assessment.metrics || null,
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

    trace('process_realtime_voice_turn_start', {
      transcriptText: cleanTranscript,
      asrConfidence,
      asrSource,
    });
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
      clientTurnId,
      onSentence: async (text, index) => {
        try {
          const nextIndex = Number.isFinite(index) ? index : sentenceIndex;
          sentenceIndex = nextIndex + 1;
          trace('assistant_sentence_ready', {
            index: nextIndex,
            text,
            speechTokenActive: bargeInController?.isTokenActive?.(speechToken),
          });
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
          trace('assistant_sentence_tts_done', {
            index: nextIndex,
            text,
          });
        } catch (error) {
          logger?.error?.('Failed to process sentence in duplex turn', { sessionId: session?.id, index, text, error: error.message });
        }
      },
    });

    trace('process_realtime_voice_turn_done', {
      durationMs: Date.now() - startedAt,
      transcription: result?.transcription || null,
      latency: result?.latency || null,
      isComplete: Boolean(result?.agentResult?.isComplete),
      completedBecause: result?.agentResult?.completedBecause || null,
    });
    bargeInController?.finishAssistantSpeech?.(speechToken);
    sendJson?.({
      type: 'assistant_speech_done',
      tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
      timestamp: new Date().toISOString(),
    });
    
    // Trigger warmup for next turn if session is still in progress
    const updatedSession = result?.updatedSession || session;
    if (updatedSession?.status === 'in_progress' && !result?.agentResult?.isComplete) {
      triggerWarmupForNextTurn(updatedSession, result).catch((error) => {
        logger?.warn?.('Warmup trigger failed, will use normal flow', {
          sessionId: updatedSession.id,
          error: error.message,
        });
      });
    }
    
    sendJson?.({
      type: 'turn_done',
      tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
      session: updatedSession,
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

  const triggerWarmupForNextTurn = async (updatedSession, turnResult) => {
    try {
      const nextQuestionIndex = turnResult?.agentResult?.nextQuestionOrder;
      const nextQuestionId = updatedSession?.interviewPlan?.questions?.[nextQuestionIndex]?.id;
      
      if (!nextQuestionId) {
        trace('warmup_skipped_no_next_question', { nextQuestionIndex });
        return;
      }

      // Generate next turn ID (will be validated when user actually speaks)
      const nextClientTurnId = clientTurnId ? `${clientTurnId}-next` : null;
      
      if (!nextClientTurnId) {
        trace('warmup_skipped_no_turn_id');
        return;
      }

      trace('warmup_trigger_start', {
        nextQuestionIndex,
        nextQuestionId,
        nextClientTurnId,
      });

      await warmContextService.prepareWarmContext({
        session: updatedSession,
        userId,
        currentQuestionId: nextQuestionId,
        clientTurnId: nextClientTurnId,
        currentQuestionIndex: nextQuestionIndex,
        transcriptLength: updatedSession?.transcript?.length || 0,
      });

      trace('warmup_trigger_done', {
        nextQuestionIndex,
        nextQuestionId,
        nextClientTurnId,
      });
    } catch (error) {
      trace('warmup_trigger_error', {
        error: error.message,
      });
      throw error;
    }
  };

  return { processFinalTranscript };
};
