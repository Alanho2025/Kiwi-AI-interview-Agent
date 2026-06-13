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
import { recordAgentTraceEvent } from '../aiControl/agentTraceService.js';

const DEFAULT_SPEECH_STOP_TIMEOUT_MS = 2500;
const MAX_PENDING_AUDIO_CHUNKS = 1200;
const PCM_BYTES_PER_SAMPLE = 2;
const PCM_CHANNELS = 1;
const AUDIO_CONTRACT_TRACE_EVERY = 25;

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

const estimatePcmDurationMs = ({ bytes = 0, sampleRate = 16000 } = {}) => {
  const rate = Number(sampleRate) || 16000;
  if (!bytes || !rate) return null;
  return Math.round((bytes / (rate * PCM_CHANNELS * PCM_BYTES_PER_SAMPLE)) * 1000);
};

const toFiniteNumberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildClientVoiceLatencyPayload = (payload = {}) => {
  const trace = payload.trace || {};
  const derived = trace.derived || {};
  const latencyBreakdown = {
    effectiveQuestionGapMs: toFiniteNumberOrNull(derived.effectiveQuestionGapMs),
    speechEndToAiSpeechStartMs: toFiniteNumberOrNull(derived.speechEndToAiSpeechStartMs),
    acknowledgementToAiSpeechStartMs: toFiniteNumberOrNull(derived.acknowledgementToAiSpeechStartMs),
    stopToNextAudioMs: toFiniteNumberOrNull(derived.stopToNextAudioMs),
    vadToPlaybackMs: toFiniteNumberOrNull(derived.vadToPlaybackMs),
  };

  return {
    traceId: trace.traceId || null,
    turnId: trace.turnId || null,
    traceType: trace.traceType || 'voice_turn',
    target: trace.target || 'effective_question_gap',
    latencyBreakdown,
    clientTimestamp: payload.clientTimestamp || null,
  };
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
  let audioBytesWritten = 0;
  let currentClientTurnId = null;
  let lastFinalizedClientTurnId = null;
  let pendingTranscriptConfirmation = null;
  const getPendingTranscriptConfirmation = () => pendingTranscriptConfirmation;
  const setPendingTranscriptConfirmation = (nextPending) => {
    pendingTranscriptConfirmation = nextPending || null;
  };

  const sendReady = () => sendJson({
    type: 'session_ready',
    tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
    sessionId: activeSession?.id || session?.id,
    language,
    sampleRate,
    audioContract: {
      encoding: 'pcm_s16le',
      sampleRate,
      channels: PCM_CHANNELS,
      bytesPerSample: PCM_BYTES_PER_SAMPLE,
    },
    timestamp: new Date().toISOString(),
  });
  let activeSttProviderName = null;
  let speechCaptureSequence = 0;
  let activeSpeechCaptureId = 0;

  const processFinalTranscript = async ({ transcriptText, asrConfidence, asrSource, vad, clientTurnId }) => {
    const turnCoordinator = createDuplexTurnCoordinator({
      session: activeSession,
      userId,
      voiceName,
      language,
      asrSource,
      sendJson,
      bargeInController,
      logger,
      clientTurnId,
      getPendingTranscriptConfirmation,
      setPendingTranscriptConfirmation,
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

  const writeAudioChunk = (target, chunk, source = 'live') => {
    target.writeAudio(chunk);
    audioChunksWritten += 1;
    audioBytesWritten += Buffer.byteLength(chunk);
    if (audioChunksWritten === 1 || audioChunksWritten % AUDIO_CONTRACT_TRACE_EVERY === 0) {
      logger?.info?.('Duplex realtime audio chunk written', {
        sessionId: activeSession?.id || session?.id,
        provider: activeSttProviderName,
        source,
        chunkIndex: audioChunksWritten,
        bytes: Buffer.byteLength(chunk),
        estimatedDurationMs: estimatePcmDurationMs({ bytes: Buffer.byteLength(chunk), sampleRate }),
        totalAudioMs: estimatePcmDurationMs({ bytes: audioBytesWritten, sampleRate }),
        sampleRate,
        encoding: 'pcm_s16le',
      });
    }
  };

  const flushPendingAudioChunks = async () => {
    if (!pendingAudioChunks.length) return;
    const target = await startSpeechSession();
    const chunksToWrite = pendingAudioChunks;
    pendingAudioChunks = [];
    for (const chunk of chunksToWrite) {
      writeAudioChunk(target, chunk, 'pending_flush');
    }
  };

  const restartSpeechSessionForNewTurn = async () => {
    finalTranscriptSegments = [];
    latestPartialTranscript = null;
    pendingAudioChunks = [];
    audioChunksWritten = 0;
    audioChunksDropped = 0;
    audioBytesWritten = 0;
    ignoredPreSpeechAudioChunks = 0;
    await stopSpeechSession();
    const target = await startSpeechSession();
    await flushPendingAudioChunks();
    return target;
  };

  const queueCapturedAudio = async (chunk) => {
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

    if (speechSession && isSpeechSessionStarted) {
      writeAudioChunk(speechSession, buffer, 'live');
      return;
    }

    pendingAudioChunks.push(buffer);
    if (pendingAudioChunks.length === 1) {
      logger?.info?.('Buffering duplex audio while realtime STT starts', {
        sessionId: activeSession?.id || session?.id,
        sampleRate,
        bytes: buffer.length,
      });
    }
  };

  const finalizeCapturedSpeech = async ({ vad = null, reason = 'speech_end', clientTurnId = currentClientTurnId } = {}) => {
    if (!isCapturingSpeech) {
      logger?.warn?.('Ignoring duplex speech finalization with no active speech capture', {
        sessionId: activeSession?.id || session?.id,
        provider: activeSttProviderName,
        reason,
        clientTurnId,
      });
      return false;
    }

    const processingClientTurnId = clientTurnId || currentClientTurnId;
    context.lastVad = { ...(vad || {}), stopReason: reason };
    isCapturingSpeech = false;
    let speechStopError = null;
    try {
      await flushPendingAudioChunks();
      logger?.info?.('Duplex audio flushed before STT stop', {
        sessionId: activeSession?.id || session?.id,
        writtenChunks: audioChunksWritten,
        droppedChunks: audioChunksDropped,
        ignoredPreSpeechAudioChunks,
        totalAudioMs: estimatePcmDurationMs({ bytes: audioBytesWritten, sampleRate }),
        provider: activeSttProviderName,
        reason,
        clientTurnId: processingClientTurnId,
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
        reason,
        clientTurnId: processingClientTurnId,
      });
    }

    activeSpeechCaptureId = 0;
    const partialFallback = finalTranscriptSegments.length ? null : latestPartialTranscript;
    const segmentsToProcess = partialFallback ? [partialFallback] : finalTranscriptSegments;
    finalTranscriptSegments = [];
    latestPartialTranscript = null;
    const transcriptText = mergeTranscriptSegments(segmentsToProcess);
    const asrSource = resolveAsrSource({ segments: segmentsToProcess, providerName: activeSttProviderName });
    if (isProcessingBufferedTurn) return true;
    isProcessingBufferedTurn = true;
    try {
      await processFinalTranscript({
        transcriptText,
        asrConfidence: averageConfidence(segmentsToProcess),
        asrSource,
        clientTurnId: processingClientTurnId,
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
          audioMsWritten: estimatePcmDurationMs({ bytes: audioBytesWritten, sampleRate }),
        },
      });
      return true;
    } catch (error) {
      logger?.error?.('Duplex voice turn failed', { sessionId: activeSession?.id || session?.id, error });
      sendJson({
        type: 'error',
        code: 'DUPLEX_TURN_FAILED',
        message: error?.message || 'Could not process the duplex voice turn.',
        timestamp: new Date().toISOString(),
      });
      return false;
    } finally {
      isProcessingBufferedTurn = false;
      if (!processingClientTurnId || currentClientTurnId === processingClientTurnId) {
        lastFinalizedClientTurnId = processingClientTurnId;
        currentClientTurnId = null;
      }
    }
  };

  const handleJsonMessage = async (payload = {}) => {
    try {
      if (payload.type === 'session_start') {
        sendReady();
        return;
      }

      if (payload.type === 'speech_start') {
        const providedClientTurnId = String(payload.clientTurnId || '').trim();
        const incomingClientTurnId = providedClientTurnId || `voice-turn-${Date.now()}-${speechCaptureSequence + 1}`;
        if (!providedClientTurnId) {
          logger?.warn?.('speech_start did not include clientTurnId; generated fallback turn id', {
            sessionId: activeSession?.id || session?.id,
            generatedClientTurnId: incomingClientTurnId,
          });
        }
        if (isCapturingSpeech) {
          logger?.warn?.('Ignoring duplicate duplex speech_start while already capturing', {
            sessionId: activeSession?.id || session?.id,
            provider: activeSttProviderName,
            pendingAudioChunks: pendingAudioChunks.length,
            audioChunksWritten,
            expected: currentClientTurnId,
            received: incomingClientTurnId,
          });
          return;
        }
        if (isProcessingBufferedTurn) {
          logger?.warn?.('Ignoring duplex speech_start while previous turn is processing', {
            sessionId: activeSession?.id || session?.id,
            provider: activeSttProviderName,
            received: incomingClientTurnId,
          });
          return;
        }
        currentClientTurnId = incomingClientTurnId;
        isCapturingSpeech = true;
        logger?.info?.('Duplex speech_start received', {
          sessionId: activeSession?.id || session?.id,
          clientTurnId: currentClientTurnId,
        });
        await restartSpeechSessionForNewTurn();
        sendJson({
          type: 'listening_started',
          tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
          clientTurnId: currentClientTurnId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (payload.type === 'audio_chunk' && payload.audioBase64) {
        await queueCapturedAudio(Buffer.from(payload.audioBase64, 'base64'));
        return;
      }

      if (payload.type === 'speech_end') {
        const incomingClientTurnId = String(payload.clientTurnId || currentClientTurnId || '').trim();
        if (!incomingClientTurnId) {
          logger?.warn?.('Ignoring speech_end without clientTurnId', {
            sessionId: activeSession?.id || session?.id,
            expected: currentClientTurnId,
          });
          return;
        }
        if (!currentClientTurnId) {
          if (incomingClientTurnId === lastFinalizedClientTurnId) {
            logger?.info?.('Ignoring duplicate or late speech_end for already finalized turn', {
              sessionId: activeSession?.id || session?.id,
              clientTurnId: incomingClientTurnId,
            });
            return;
          }
          logger?.warn?.('Ignoring speech_end with no active client turn', {
            sessionId: activeSession?.id || session?.id,
            expected: null,
            received: incomingClientTurnId,
          });
          return;
        }
        if (incomingClientTurnId !== currentClientTurnId) {
          logger?.warn?.('Ignoring speech_end with mismatched clientTurnId', {
            sessionId: activeSession?.id || session?.id,
            expected: currentClientTurnId,
            received: incomingClientTurnId,
          });
          return;
        }
        logger?.info?.('Duplex speech_end received', {
          sessionId: activeSession?.id || session?.id,
          clientTurnId: incomingClientTurnId,
        });
        await finalizeCapturedSpeech({
          vad: payload.vad || null,
          reason: payload.reason || 'speech_end',
          clientTurnId: incomingClientTurnId,
        });
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

      if (payload.type === 'voice_latency_trace') {
        const tracePayload = buildClientVoiceLatencyPayload(payload);
        if (tracePayload.latencyBreakdown.effectiveQuestionGapMs != null) {
          await recordAgentTraceEvent({
            sessionId: activeSession?.id || session?.id,
            eventType: 'voice_latency_trace',
            mode: 'voice',
            payload: tracePayload,
          });
        }
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
        if (isCapturingSpeech) {
          await finalizeCapturedSpeech({
            vad: payload.vad || null,
            reason: payload.type || 'session_stop',
            clientTurnId: currentClientTurnId,
          });
        } else {
          pendingAudioChunks = [];
          await stopSpeechSession();
        }
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
      await queueCapturedAudio(message);
    } catch (error) {
      logger?.error?.('Duplex voice binary audio handling failed', { sessionId: activeSession?.id || session?.id, error: error.message, stack: error.stack });
    }
  };

  const close = async () => {
    if (isCapturingSpeech) {
      await finalizeCapturedSpeech({ reason: 'socket_close', clientTurnId: currentClientTurnId });
      return;
    }
    pendingAudioChunks = [];
    await stopSpeechSession();
  };

  sendReady();

  return { handleJsonMessage, handleBinaryAudio, close };
};
