/**
 * File responsibility: Realtime voice turn orchestration service.
 * Main responsibilities:
 * - Accept already-transcribed realtime STT text.
 * - Run the adaptive interview engine without batch WAV transcription.
 * - Return assistant speech while pushing archive/audit work to background jobs.
 */

import { appendTranscriptTurn, updateLatestTranscriptTurnMetadata, updateSession } from '../sessionService.js';
import { runTask } from '../masterAiService.js';
import { saveBufferToLocalStorage } from '../storageService.js';
import { synthesizeSpeech } from './azureSpeechService.js';
import { getLatestQuestionForSession } from '../session/sessionQuestionService.js';
import { badRequest } from '../../utils/appError.js';
import { applyElapsedSeconds, saveInterviewAnswerWithDetails } from '../interview/interviewSessionService.js';
import { enqueueBackgroundJob } from '../../jobs/backgroundJobQueue.js';
import { createLatencyTrace } from '../../utils/latencyTrace.js';
import { logger } from '../../utils/logger.js';
import { buildRealtimeVoiceLatencySummary } from '../../utils/realtimeVoiceLatencySummary.js';
import { validateRealtimeVoiceTranscript } from './speechConfidenceGate.js';

const toBase64 = (buffer) => Buffer.from(buffer).toString('base64');

const buildAssistantMetadata = ({ synthesis, storage = null, questionId = null }) => ({
  voice: {
    provider: synthesis.provider,
    voiceName: synthesis.voiceName,
    contentType: synthesis.contentType,
    outputFormat: synthesis.outputFormat,
    storageKey: storage?.storageKey || null,
    archivedInBackground: !storage,
  },
  questionId,
});

const buildSessionPatch = (agentResult, session) => {
  const elapsedSession = applyElapsedSeconds(session);
  return agentResult.isComplete
    ? {
        status: 'completed',
        endedAt: new Date().toISOString(),
        lastResumedAt: null,
        elapsedSeconds: elapsedSession.elapsedSeconds,
        completedBecause: agentResult.completedBecause || 'question_limit_reached',
      }
    : {
        currentQuestionIndex: agentResult.nextQuestionOrder,
      };
};

export const processRealtimeVoiceTurn = async ({
  session,
  userId,
  transcriptText,
  language = 'en-NZ',
  asrConfidence = null,
  asrSource = 'azure_realtime',
  voiceName,
  inputMode = 'realtime_voice',
  vad = null,
  tryGenerateReportForCompletedSession,
  req = null,
  onSentence = null,
}) => {
  const normalizedAnswer = String(transcriptText || '').trim();
  const transcriptGate = validateRealtimeVoiceTranscript({ transcriptText: normalizedAnswer, asrConfidence, vad });
  if (!transcriptGate.ok) {
    throw badRequest(transcriptGate.message || 'Voice transcript is not ready', transcriptGate.reason);
  }

  const trace = createLatencyTrace('realtime_voice_turn', {
    sessionId: session.id,
    userId,
  });

  trace.mark('backend_request_received');
  const latestQuestion = await trace.measure('load_latest_question', () => getLatestQuestionForSession(session.id));

  await trace.measure('save_realtime_user_turn', async () => {
    await appendTranscriptTurn(session.id, {
      role: 'user',
      text: normalizedAnswer,
      timestamp: new Date().toISOString(),
      metadata: {
        inputMode,
        vad,
        asrProvider: asrSource,
        asrLanguage: language,
        asrConfidence,
        confidenceGate: transcriptGate.confidenceGate,
        transcriptAcceptance: {
          accepted: true,
          reason: transcriptGate.reason,
          metrics: transcriptGate.metrics,
        },
        transcriptionPreview: normalizedAnswer,
      },
    });

    await saveInterviewAnswerWithDetails({
      sessionId: session.id,
      questionId: latestQuestion?.id,
      transcriptText: normalizedAnswer,
      responseMode: 'voice',
      vad,
      inputMode,
      asrProvider: asrSource,
      asrLanguage: language,
      asrConfidence,
      providerPayload: {
        source: asrSource,
        realtime: true,
        inputMode,
        vad,
        confidenceGate: transcriptGate.confidenceGate,
        transcriptAcceptance: {
          accepted: true,
          reason: transcriptGate.reason,
          metrics: transcriptGate.metrics,
        },
      },
    });
  });

  let firstSentenceSeen = false;
  let firstAudioSeen = false;
  const tracedOnSentence = onSentence
    ? async (text, index) => {
        if (!firstSentenceSeen) {
          firstSentenceSeen = true;
          trace.mark('first_sentence_ready', { index, textLength: String(text || '').length });
          trace.mark('adaptive.llm_first_sentence', { index });
        }
        await onSentence(text, index);
        if (!firstAudioSeen) {
          firstAudioSeen = true;
          trace.mark('first_audio_sent', { index });
          trace.mark('adaptive.tts_first_audio', { index, mode: 'stream' });
        }
      }
    : null;

  const agentResult = await trace.measure('adaptive_next_question', () => runTask({
    taskType: 'interview_next_turn',
    sessionId: session.id,
    payload: {
      answer: normalizedAnswer,
      inputMode,
      vad,
    },
    onSentence: tracedOnSentence,
    trace,
  }));

  const updatedSession = await trace.measure('update_session_state', () => updateSession(
    session.id,
    userId,
    buildSessionPatch(agentResult, session)
  ));

  const assistantText = String(agentResult.displayText || agentResult.interviewerTurn?.displayText || agentResult.nextQuestion || '').trim();
  let assistantAudio = null;

  if (assistantText) {
    if (onSentence) {
      const aiTurns = updatedSession?.transcript?.filter((turn) => turn.role === 'ai') || [];
      const latestAiTurn = aiTurns[aiTurns.length - 1] || null;
      const questionId = latestAiTurn?.questionId || null;
      enqueueBackgroundJob('archive-realtime-assistant-audio', async () => {
        try {
          const synthesis = await synthesizeSpeech({ text: assistantText, voiceName });
          const savedOutputAudio = await saveBufferToLocalStorage({
            buffer: synthesis.audioBuffer,
            originalFilename: 'assistant-realtime-reply.mp3',
            folder: 'voice-output',
          });
          await updateLatestTranscriptTurnMetadata(
            session.id,
            'ai',
            buildAssistantMetadata({ synthesis, storage: savedOutputAudio, questionId })
          );
        } catch (error) {
          logger.error('Background realtime assistant TTS archive failed', { sessionId: session.id, error });
        }
      }, { sessionId: session.id, questionId });
    } else {
      try {
        const synthesis = await trace.measure('tts_synthesis', () => synthesizeSpeech({ text: assistantText, voiceName }));
        trace.mark('adaptive.tts_first_audio', { mode: 'full_synthesis' });
        const aiTurns = updatedSession?.transcript?.filter((turn) => turn.role === 'ai') || [];
        const latestAiTurn = aiTurns[aiTurns.length - 1] || null;
        const questionId = latestAiTurn?.questionId || null;

        assistantAudio = {
          provider: synthesis.provider,
          contentType: synthesis.contentType,
          voiceName: synthesis.voiceName,
          outputFormat: synthesis.outputFormat,
          storageKey: null,
          base64: toBase64(synthesis.audioBuffer),
        };

        enqueueBackgroundJob('archive-realtime-assistant-audio', async () => {
          const savedOutputAudio = await saveBufferToLocalStorage({
            buffer: synthesis.audioBuffer,
            originalFilename: 'assistant-realtime-reply.mp3',
            folder: 'voice-output',
          });
          await updateLatestTranscriptTurnMetadata(
            session.id,
            'ai',
            buildAssistantMetadata({ synthesis, storage: savedOutputAudio, questionId })
          );
        }, { sessionId: session.id, questionId });
      } catch (error) {
        logger.error('Realtime assistant TTS failed', { sessionId: session.id, error });
        enqueueBackgroundJob('mark-realtime-tts-failed', () => updateLatestTranscriptTurnMetadata(
          session.id,
          'ai',
          {
            voice: {
              synthesisFailed: true,
              reason: error?.message || 'Assistant speech synthesis failed',
            },
          }
        ), { sessionId: session.id });
      }
    }
  }

  const generatedReport = agentResult.isComplete && tryGenerateReportForCompletedSession
    ? await trace.measure('generate_completion_report', () => tryGenerateReportForCompletedSession(req, session.id))
    : null;

  const latency = trace.toJSON();
  logger.info('Realtime voice turn latency', latency);
  logger.info('Realtime voice turn latency summary', {
    sessionId: session.id,
    userId,
    summary: buildRealtimeVoiceLatencySummary(latency),
  });

  return {
    updatedSession,
    agentResult,
    assistantAudio,
    transcription: {
      text: normalizedAnswer,
      language,
      provider: asrSource,
      confidence: asrConfidence,
    },
    generatedReport,
    latency,
  };
};
