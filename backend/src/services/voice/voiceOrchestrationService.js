/**
 * File responsibility: Voice turn orchestration service.
 * Main responsibilities:
 * - Keep session-aware voice turn flow separate from HTTP controllers.
 * - Transcribe uploaded audio, persist input/output artifacts, run the existing interview engine, and synthesize the assistant reply.
 */

import { appendTranscriptTurn, updateLatestTranscriptTurnMetadata, updateSession } from '../sessionService.js';
import { runTask } from '../masterAiService.js';
import { saveBufferToLocalStorage } from '../storageService.js';
import { synthesizeSpeech, transcribeShortAudio } from './azureSpeechService.js';
import { getLatestQuestionForSession } from '../session/sessionQuestionService.js';
import { badRequest } from '../../utils/appError.js';
import { saveInterviewAnswerWithDetails } from '../interview/interviewSessionService.js';

const toBase64 = (buffer) => Buffer.from(buffer).toString('base64');

const buildAssistantMetadata = ({ synthesis, storage, questionId }) => ({
  voice: {
    provider: synthesis.provider,
    voiceName: synthesis.voiceName,
    contentType: synthesis.contentType,
    outputFormat: synthesis.outputFormat,
    storageKey: storage.storageKey,
  },
  questionId,
});

export const processVoiceReply = async ({ req, session, userId, file, language, voiceName, durationMs = null, tryGenerateReportForCompletedSession }) => {
  if (!file) {
    throw badRequest('Audio file is required', 'Upload a WAV file in the audio field');
  }

  const audioDurationSeconds = Number(durationMs) > 0 ? Math.round(Number(durationMs) / 1000) : null;
  const latestQuestion = await getLatestQuestionForSession(session.id);
  const savedInputAudio = await saveBufferToLocalStorage({
    buffer: file.buffer,
    originalFilename: file.originalname || 'voice-input.wav',
    folder: 'voice-input',
  });

  const transcription = await transcribeShortAudio({
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    language,
  });

  const normalizedAnswer = String(transcription.text || '').trim();
  if (!normalizedAnswer) {
    throw badRequest('Speech could not be transcribed', 'Try again with a clearer WAV recording');
  }

  await appendTranscriptTurn(session.id, {
    role: 'user',
    text: normalizedAnswer,
    timestamp: new Date().toISOString(),
    metadata: {
      inputMode: 'voice',
      audioStorageKey: savedInputAudio.storageKey,
      audioDurationSeconds,
      asrProvider: transcription.provider,
      asrLanguage: transcription.language,
      asrConfidence: transcription.confidence,
      transcriptionPreview: normalizedAnswer,
    },
  });

  await saveInterviewAnswerWithDetails({
    sessionId: session.id,
    questionId: latestQuestion?.id,
    transcriptText: normalizedAnswer,
    responseMode: 'voice',
    audioDurationSeconds,
    audioStorageKey: savedInputAudio.storageKey,
    asrProvider: transcription.provider,
    asrLanguage: transcription.language,
    asrConfidence: transcription.confidence,
    providerPayload: transcription.raw,
  });

  const agentResult = await runTask({
    taskType: 'interview_next_turn',
    sessionId: session.id,
    payload: { answer: normalizedAnswer },
  });

  const sessionPatch = agentResult.isComplete
    ? {
        status: 'completed',
        endedAt: new Date().toISOString(),
        lastResumedAt: null,
      }
    : {
        currentQuestionIndex: agentResult.nextQuestionOrder,
      };

  const updatedSession = await updateSession(session.id, userId, sessionPatch);
  const assistantText = String(agentResult.displayText || agentResult.interviewerTurn?.displayText || agentResult.nextQuestion || '').trim();
  let assistantAudio = null;

  if (assistantText) {
    try {
      const synthesis = await synthesizeSpeech({ text: assistantText, voiceName });
      const savedOutputAudio = await saveBufferToLocalStorage({
        buffer: synthesis.audioBuffer,
        originalFilename: 'assistant-reply.mp3',
        folder: 'voice-output',
      });

      const aiTurns = updatedSession?.transcript?.filter((turn) => turn.role === 'ai') || [];
      const latestAiTurn = aiTurns[aiTurns.length - 1] || null;
      const questionId = latestAiTurn?.questionId || null;

      await updateLatestTranscriptTurnMetadata(
        session.id,
        'ai',
        buildAssistantMetadata({ synthesis, storage: savedOutputAudio, questionId })
      );

      const refreshedSession = await updateSession(session.id, userId, {});
      assistantAudio = {
        provider: synthesis.provider,
        contentType: synthesis.contentType,
        voiceName: synthesis.voiceName,
        outputFormat: synthesis.outputFormat,
        storageKey: savedOutputAudio.storageKey,
        base64: toBase64(synthesis.audioBuffer),
      };

      return {
        updatedSession: refreshedSession,
        agentResult,
        assistantAudio,
        transcription,
        generatedReport: agentResult.isComplete
          ? await tryGenerateReportForCompletedSession(req, session.id)
          : null,
      };
    } catch (error) {
      await updateLatestTranscriptTurnMetadata(
        session.id,
        'ai',
        {
          voice: {
            synthesisFailed: true,
            reason: error?.message || 'Assistant speech synthesis failed',
          },
        }
      );
    }
  }

  return {
    updatedSession,
    agentResult,
    assistantAudio,
    transcription,
    generatedReport: agentResult.isComplete
      ? await tryGenerateReportForCompletedSession(req, session.id)
      : null,
  };
};
