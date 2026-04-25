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
import { saveInterviewAnswerWithDetails } from '../interview/interviewSessionService.js';
import { enqueueBackgroundJob } from '../../jobs/backgroundJobQueue.js';
import { createLatencyTrace } from '../../utils/latencyTrace.js';
import { logger } from '../../utils/logger.js';

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

const buildSessionPatch = (agentResult) => (agentResult.isComplete
  ? {
      status: 'completed',
      endedAt: new Date().toISOString(),
      lastResumedAt: null,
    }
  : {
      currentQuestionIndex: agentResult.nextQuestionOrder,
    });

export const processRealtimeVoiceTurn = async ({
  session,
  userId,
  transcriptText,
  language = 'en-NZ',
  asrConfidence = null,
  asrSource = 'azure_realtime',
  voiceName,
  tryGenerateReportForCompletedSession,
  req = null,
}) => {
  const normalizedAnswer = String(transcriptText || '').trim();
  if (!normalizedAnswer) {
    throw badRequest('Missing transcript text', 'Realtime voice turn requires non-empty transcriptText');
  }

  const trace = createLatencyTrace('realtime_voice_turn', {
    sessionId: session.id,
    userId,
  });

  const latestQuestion = await trace.measure('load_latest_question', () => getLatestQuestionForSession(session.id));

  await trace.measure('save_realtime_user_turn', async () => {
    await appendTranscriptTurn(session.id, {
      role: 'user',
      text: normalizedAnswer,
      timestamp: new Date().toISOString(),
      metadata: {
        inputMode: 'realtime_voice',
        asrProvider: asrSource,
        asrLanguage: language,
        asrConfidence,
        transcriptionPreview: normalizedAnswer,
      },
    });

    await saveInterviewAnswerWithDetails({
      sessionId: session.id,
      questionId: latestQuestion?.id,
      transcriptText: normalizedAnswer,
      responseMode: 'voice',
      asrProvider: asrSource,
      asrLanguage: language,
      asrConfidence,
      providerPayload: { source: asrSource, realtime: true },
    });
  });

  const agentResult = await trace.measure('adaptive_next_question', () => runTask({
    taskType: 'interview_next_turn',
    sessionId: session.id,
    payload: {
      answer: normalizedAnswer,
      inputMode: 'realtime_voice',
    },
  }));

  const updatedSession = await trace.measure('update_session_state', () => updateSession(
    session.id,
    userId,
    buildSessionPatch(agentResult)
  ));

  const assistantText = String(agentResult.interviewerTurn?.text || agentResult.nextQuestion || '').trim();
  let assistantAudio = null;

  if (assistantText) {
    try {
      const synthesis = await trace.measure('tts_synthesis', () => synthesizeSpeech({ text: assistantText, voiceName }));
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

  const generatedReport = agentResult.isComplete && tryGenerateReportForCompletedSession
    ? await trace.measure('generate_completion_report', () => tryGenerateReportForCompletedSession(req, session.id))
    : null;

  const latency = trace.toJSON();
  logger.info('Realtime voice turn latency', latency);

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
