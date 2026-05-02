/**
 * File responsibility: Duplex voice agent service.
 * Main responsibilities:
 * - Own one WebSocket conversation for realtime STT, agent planning, TTS, and barge-in.
 * - Keep transport details outside the interview controller.
 * - Emit formal tool names for report-friendly traces and logs.
 */

import { createRealtimeSpeechSession } from './realtimeSpeechSessionService.js';
import { streamAssistantSpeech } from './ttsStreamQueue.js';
import { createBargeInController } from './bargeInController.js';
import { createDuplexTurnCoordinator } from './duplexTurnCoordinator.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

const normalizeTranscriptText = (payload = {}) => String(
  payload.displayText || payload.normalizedText || payload.text || payload.rawText || ''
).trim();

const mergeTranscriptSegments = (segments = []) => {
  const pieces = segments
    .map((segment) => normalizeTranscriptText(segment))
    .filter(Boolean);
  return pieces
    .filter((piece, index) => piece !== pieces[index - 1])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const averageConfidence = (segments = []) => {
  const scores = segments
    .map((segment) => Number(segment?.confidence))
    .filter((score) => Number.isFinite(score));
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

export const createDuplexVoiceAgentSession = ({
  socket,
  context,
  session,
  userId,
  logger,
  sendJson,
} = {}) => {
  let speechSession = null;
  let isSpeechSessionStarted = false;
  let activeSession = session;
  const language = context?.language || 'en-NZ';
  const sampleRate = context?.sampleRate || 16000;
  const voiceName = context?.voiceName || undefined;
  const bargeInController = createBargeInController({ sendJson, logger, sessionId: session?.id });
  let finalTranscriptSegments = [];
  let isProcessingBufferedTurn = false;

  const processFinalTranscript = async ({ transcriptText, asrConfidence, vad }) => {
    const turnCoordinator = createDuplexTurnCoordinator({
      session: activeSession,
      userId,
      voiceName,
      language,
      sendJson,
      bargeInController,
      logger,
    });
    const result = await turnCoordinator.processFinalTranscript({
      transcriptText,
      asrConfidence,
      vad,
    });
    if (result?.updatedSession) {
      activeSession = result.updatedSession;
    }
    return result;
  };

  const stopSpeechSession = async () => {
    if (!speechSession) return;
    const current = speechSession;
    speechSession = null;
    isSpeechSessionStarted = false;
    await current.stop();
  };

  const startSpeechSession = async () => {
    if (speechSession && isSpeechSessionStarted) return speechSession;
    speechSession = createRealtimeSpeechSession({
      language,
      sampleRate,
      onPartialTranscript: (payload) => sendJson({
        ...payload,
        type: 'stt_partial',
        tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
      }),
      onFinalTranscript: async (payload) => {
        const text = normalizeTranscriptText(payload);
        sendJson({
          ...payload,
          type: 'stt_final',
          tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
        });
        if (text) {
          finalTranscriptSegments.push(payload);
        }
      },
      onError: (payload) => sendJson({
        ...payload,
        type: 'error',
        tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
        code: 'STT_ERROR',
        message: payload.errorDetails || payload.reason || 'Realtime speech recognition failed.',
      }),
      onSessionStarted: (payload) => sendJson({
        ...payload,
        type: 'speech_session_started',
        tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
      }),
      onSessionStopped: (payload) => sendJson({
        ...payload,
        type: 'speech_session_stopped',
        tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
      }),
    });
    await speechSession.start();
    isSpeechSessionStarted = true;
    return speechSession;
  };

  const handleJsonMessage = async (payload = {}) => {
    if (payload.type === 'session_start' || payload.type === 'speech_start') {
      await startSpeechSession();
      sendJson({
        type: 'listening_started',
        tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (payload.type === 'audio_chunk' && payload.audioBase64) {
      const target = await startSpeechSession();
      target.writeAudio(Buffer.from(payload.audioBase64, 'base64'));
      return;
    }

    if (payload.type === 'speech_end') {
      context.lastVad = payload.vad || null;
      await stopSpeechSession();
      const segmentsToProcess = finalTranscriptSegments;
      finalTranscriptSegments = [];
      const transcriptText = mergeTranscriptSegments(segmentsToProcess);
      if (!transcriptText || isProcessingBufferedTurn) return;
      isProcessingBufferedTurn = true;
      try {
        await processFinalTranscript({
          transcriptText,
          asrConfidence: averageConfidence(segmentsToProcess),
          vad: context.lastVad,
        });
      } catch (error) {
        logger?.error?.('Duplex voice turn failed', { sessionId: activeSession?.id || session?.id, error });
        sendJson({
          type: 'error',
          code: 'DUPLEX_TURN_FAILED',
          message: error?.message || 'Could not process the duplex voice turn.',
          timestamp: new Date().toISOString(),
        });
      } finally {
        isProcessingBufferedTurn = false;
      }
      return;
    }

    if (payload.type === 'speak_text') {
      const speechToken = bargeInController.startAssistantSpeech();
      sendJson({
        type: 'assistant_text_delta',
        tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        text: payload.text,
        index: Number(payload.index || 0),
        timestamp: new Date().toISOString(),
      });
      await streamAssistantSpeech({
        text: payload.text,
        voiceName,
        sendJson,
        bargeInController,
        index: Number(payload.index || 0),
        speechToken,
      });
      bargeInController.finishAssistantSpeech(speechToken);
      sendJson({
        type: 'assistant_speech_done',
        tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (payload.type === 'barge_in' || payload.type === 'cancel_assistant_audio') {
      bargeInController.handleBargeIn(payload.reason || payload.type);
      return;
    }

    if (payload.type === 'ping') {
      sendJson({ type: 'pong', timestamp: new Date().toISOString() });
      return;
    }

    if (payload.type === 'session_stop' || payload.type === 'stop') {
      await stopSpeechSession();
      sendJson({
        type: 'session_stopped',
        tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleBinaryAudio = async (message) => {
    const target = await startSpeechSession();
    target.writeAudio(Buffer.from(message));
  };

  const close = async () => {
    await stopSpeechSession();
  };

  sendJson({
    type: 'session_ready',
    tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
    sessionId: session?.id,
    language,
    sampleRate,
    timestamp: new Date().toISOString(),
  });

  return { handleJsonMessage, handleBinaryAudio, close };
};
