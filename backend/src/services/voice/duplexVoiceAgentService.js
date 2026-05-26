/**
 * File responsibility: Duplex voice agent service.
 * Main responsibilities:
 * - Own one WebSocket conversation for realtime STT, agent planning, TTS, and barge-in.
 * - Keep transport details outside the interview controller.
 * - Emit formal tool names for report-friendly traces and logs.
 */

import { createRoutedRealtimeSpeechSession } from './realtimeSpeechProviderRouter.js';
import { streamAssistantSpeech } from './ttsStreamQueue.js';
import { createBargeInController } from './bargeInController.js';
import { createDuplexTurnCoordinator } from './duplexTurnCoordinator.js';
import { buildSessionSpeechPhraseList } from './speechPhraseHintService.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

const DEFAULT_SPEECH_STOP_TIMEOUT_MS = 2500;
const MAX_PENDING_AUDIO_CHUNKS = 1200;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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

const resolveAsrSource = ({ segments = [], providerName = null } = {}) => {
  const provider = segments.find((segment) => segment?.provider)?.provider || providerName || 'unknown_realtime';
  return String(provider).trim().toLowerCase().replace(/-/g, '_');
};

const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  promise
    .then((value) => {
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
});

export const createDuplexVoiceAgentSession = ({
  context,
  session,
  userId,
  logger,
  sendJson,
} = {}) => {
  let speechSession = null;
  let isSpeechSessionStarted = false;
  let sessionStartPromise = null;
  let activeSession = session;
  const language = context?.language || 'en-NZ';
  const sampleRate = context?.sampleRate || 16000;
  const voiceName = context?.voiceName || undefined;
  const speechStopTimeoutMs = parsePositiveInteger(process.env.VOICE_STT_TURN_STOP_TIMEOUT_MS, DEFAULT_SPEECH_STOP_TIMEOUT_MS);
  const bargeInController = createBargeInController({ sendJson, logger, sessionId: session?.id });
  let finalTranscriptSegments = [];
  let latestPartialTranscript = null;
  let isProcessingBufferedTurn = false;
  let isCapturingSpeech = false;
  let ignoredPreSpeechAudioChunks = 0;
  let pendingAudioChunks = [];
  let audioChunksWritten = 0;
  let audioChunksDropped = 0;

  const sendReady = () => sendJson({
    type: 'session_ready',
    tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
    sessionId: activeSession?.id || session?.id,
    language,
    sampleRate,
    timestamp: new Date().toISOString(),
  });
  let activeSttProviderName = null;
  let speechCaptureSequence = 0;
  let activeSpeechCaptureId = 0;

  const processFinalTranscript = async ({ transcriptText, asrConfidence, asrSource, vad }) => {
    const turnCoordinator = createDuplexTurnCoordinator({
      session: activeSession,
      userId,
      voiceName,
      language,
      asrSource,
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
    if (sessionStartPromise) {
      await sessionStartPromise;
    }
    if (!speechSession) return;
    const current = speechSession;
    speechSession = null;
    isSpeechSessionStarted = false;
    await current.stop();
  };

  const startSpeechSession = async () => {
    if (speechSession && isSpeechSessionStarted) return speechSession;
    if (sessionStartPromise) {
      await sessionStartPromise;
      return speechSession;
    }

    sessionStartPromise = (async () => {
      const extraPhrases = buildSessionSpeechPhraseList(activeSession);
      const captureId = speechCaptureSequence + 1;
      speechCaptureSequence = captureId;
      activeSpeechCaptureId = captureId;
      const newSession = createRoutedRealtimeSpeechSession({
        language,
        sampleRate,
        extraPhrases,
        usageContext: {
          userId,
          sessionId: activeSession?.id || session?.id,
          stage: 'interview',
          source: 'duplex_voice_stt',
        },
        onPartialTranscript: (payload) => {
          if (captureId !== activeSpeechCaptureId) return;
          const text = normalizeTranscriptText(payload);
          if (text) latestPartialTranscript = payload;
          sendJson({
            ...payload,
            type: 'stt_partial',
            tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
          });
        },
        onFinalTranscript: async (payload) => {
          if (captureId !== activeSpeechCaptureId) return;
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
          type: payload.type || 'speech_session_started',
          tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
        }),
        onSessionStopped: (payload) => sendJson({
          ...payload,
          type: 'speech_session_stopped',
          tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
        }),
      });
      speechSession = newSession;
      await newSession.start();
      isSpeechSessionStarted = true;
      activeSttProviderName = newSession.providerName;
      logger?.info?.('Duplex speech session started with phrase hints', {
        sessionId: activeSession?.id || session?.id,
        sttProvider: newSession.providerName,
        phraseCount: extraPhrases.length,
      });
    })();

    await sessionStartPromise;
    sessionStartPromise = null;
    return speechSession;
  };

  const flushPendingAudioChunks = async () => {
    if (!pendingAudioChunks.length) return;
    const target = await startSpeechSession();
    const chunksToWrite = pendingAudioChunks;
    pendingAudioChunks = [];
    for (const chunk of chunksToWrite) {
      target.writeAudio(chunk);
      audioChunksWritten += 1;
    }
  };

  const restartSpeechSessionForNewTurn = async () => {
    finalTranscriptSegments = [];
    latestPartialTranscript = null;
    pendingAudioChunks = [];
    audioChunksWritten = 0;
    audioChunksDropped = 0;
    ignoredPreSpeechAudioChunks = 0;
    await stopSpeechSession();
    const target = await startSpeechSession();
    await flushPendingAudioChunks();
    return target;
  };

  const queueCapturedAudio = (chunk) => {
    if (!isCapturingSpeech) {
      ignoredPreSpeechAudioChunks += 1;
      if (ignoredPreSpeechAudioChunks === 1) {
        logger?.warn?.('Ignoring duplex audio received before speech_start', {
          sessionId: activeSession?.id || session?.id,
          sampleRate,
        });
      }
      return;
    }

    const buffer = Buffer.from(chunk);
    if (pendingAudioChunks.length >= MAX_PENDING_AUDIO_CHUNKS) {
      audioChunksDropped += 1;
      return;
    }
    pendingAudioChunks.push(buffer);
  };

  const handleJsonMessage = async (payload = {}) => {
    try {
      if (payload.type === 'session_start') {
        sendReady();
        return;
      }

      if (payload.type === 'speech_start') {
        isCapturingSpeech = true;
        await restartSpeechSessionForNewTurn();
        sendJson({
          type: 'listening_started',
          tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
          timestamp: new Date().toISOString(),
        });
        return;
      }

    if (payload.type === 'audio_chunk' && payload.audioBase64) {
      queueCapturedAudio(Buffer.from(payload.audioBase64, 'base64'));
      return;
    }

    if (payload.type === 'speech_end') {
      context.lastVad = payload.vad || null;
      isCapturingSpeech = false;
      let speechStopError = null;
      try {
        await flushPendingAudioChunks();
        logger?.info?.('Duplex audio flushed before STT stop', {
          sessionId: activeSession?.id || session?.id,
          writtenChunks: audioChunksWritten,
          droppedChunks: audioChunksDropped,
          ignoredPreSpeechAudioChunks,
          provider: activeSttProviderName,
        });
        await withTimeout(
          stopSpeechSession(),
          speechStopTimeoutMs,
          `Timed out waiting ${speechStopTimeoutMs}ms for realtime STT stop/finalize.`
        );
      } catch (error) {
        speechStopError = error;
        logger?.warn?.('Duplex speech session stop failed; processing buffered transcript if available', {
          sessionId: activeSession?.id || session?.id,
          sttProvider: activeSttProviderName,
          error: error?.message || String(error),
        });
      }
      activeSpeechCaptureId = 0;
      const partialFallback = finalTranscriptSegments.length ? null : latestPartialTranscript;
      const segmentsToProcess = partialFallback ? [partialFallback] : finalTranscriptSegments;
      finalTranscriptSegments = [];
      latestPartialTranscript = null;
      const transcriptText = mergeTranscriptSegments(segmentsToProcess);
      const asrSource = resolveAsrSource({ segments: segmentsToProcess, providerName: activeSttProviderName });
      if (isProcessingBufferedTurn) return;
      isProcessingBufferedTurn = true;
      try {
        await processFinalTranscript({
          transcriptText,
          asrConfidence: averageConfidence(segmentsToProcess),
          asrSource,
          vad: {
            ...(context.lastVad || {}),
            sttSegmentCount: segmentsToProcess.length,
            sttSource: partialFallback ? 'partial_fallback' : 'final_segments',
            sttProvider: activeSttProviderName,
            sttStopError: speechStopError?.message || null,
            usedPartialFallback: Boolean(partialFallback),
            ignoredPreSpeechAudioChunks,
            audioChunksWritten,
            audioChunksDropped,
          },
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
        usageContext: {
          userId,
          sessionId: activeSession?.id || session?.id,
          stage: 'interview',
          source: 'duplex_speak_text',
        },
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
      sendJson({
        type: 'pong',
        clientTimestamp: payload.clientTimestamp || null,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (payload.type === 'session_stop' || payload.type === 'stop') {
      isCapturingSpeech = false;
      pendingAudioChunks = [];
      await stopSpeechSession();
      sendJson({
        type: 'session_stopped',
        tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
        timestamp: new Date().toISOString(),
      });
    }
    } catch (error) {
      logger?.error?.('Duplex voice message handling failed', { sessionId: activeSession?.id || session?.id, type: payload.type, error: error.message, stack: error.stack });
      sendJson({
        type: 'error',
        code: 'MESSAGE_HANDLING_FAILED',
        message: error?.message || 'Failed to process voice message.',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleBinaryAudio = async (message) => {
    try {
      queueCapturedAudio(message);
    } catch (error) {
      logger?.error?.('Duplex voice binary audio handling failed', { sessionId: activeSession?.id || session?.id, error: error.message, stack: error.stack });
    }
  };

  const close = async () => {
    isCapturingSpeech = false;
    pendingAudioChunks = [];
    await stopSpeechSession();
  };

  sendReady();

  return { handleJsonMessage, handleBinaryAudio, close };
};