import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import {
  ensureInterviewInProgress,
  loadOwnedSessionOrThrow,
  requireSessionId,
} from '../services/interview/interviewSessionService.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';
import { processRealtimeVoiceTurn } from '../services/voice/realtimeVoiceTurnService.js';
import { synthesizeSpeech } from '../services/voice/ttsProviderRouter.js';
import { withSessionTurnLock } from '../utils/sessionTurnLock.js';
import { tryGenerateReportForCompletedSession } from './interviewControllerUtils.js';
import { buildLiveInterviewTurnResponse } from '../services/interview/liveInterviewPayloadService.js';

export const replyInterviewWithRealtimeVoice = asyncHandler(async (req, res) => {
  const { sessionId, transcriptText } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const result = await withSessionTurnLock(sessionId, () => processRealtimeVoiceTurn({
    req,
    session,
    userId: user.id,
    transcriptText,
    language: String(req.body?.language || '').trim() || undefined,
    asrConfidence: req.body?.asrConfidence ?? null,
    asrSource: String(req.body?.asrSource || '').trim() || undefined,
    voiceName: String(req.body?.voiceName || '').trim() || undefined,
    inputMode: String(req.body?.inputMode || '').trim() || undefined,
    vad: req.body?.vad || null,
    tryGenerateReportForCompletedSession,
  }));

  logger.info('Interview realtime voice reply processed', getRequestLogMeta(req, {
    isComplete: Boolean(result.agentResult.isComplete),
    nextQuestionOrder: result.agentResult.nextQuestionOrder || null,
    hasAssistantAudio: Boolean(result.assistantAudio?.base64),
    latency: result.latency,
  }));

  res.json(formatSuccess('Realtime voice reply processed', buildLiveInterviewTurnResponse({
    agentResult: result.agentResult,
    updatedSession: result.updatedSession,
    generatedReport: result.generatedReport,
    transcription: result.transcription,
    assistantAudio: result.assistantAudio,
    latency: result.latency,
  })));
});

export const replyInterviewWithRealtimeVoiceStream = asyncHandler(async (req, res) => {
  const { sessionId, transcriptText } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const voiceName = String(req.body?.voiceName || '').trim() || undefined;

  const onSentence = async (text, index) => {
    try {
      const synthesis = await synthesizeSpeech({
        text,
        voiceName,
        usageContext: {
          userId: user.id,
          sessionId,
          stage: 'interview',
          source: 'realtime_voice_turn_stream',
        },
      });
      const payload = {
        type: 'audio',
        base64: synthesis.audioBuffer.toString('base64'),
        provider: synthesis.provider,
        contentType: synthesis.contentType,
        voiceName: synthesis.voiceName,
        outputFormat: synthesis.outputFormat,
        index,
        text,
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      logger.error('Failed to synthesize sentence stream', { error: err });
    }
  };

  const result = await withSessionTurnLock(sessionId, () => processRealtimeVoiceTurn({
    req,
    session,
    userId: user.id,
    transcriptText,
    language: String(req.body?.language || '').trim() || undefined,
    asrConfidence: req.body?.asrConfidence ?? null,
    asrSource: String(req.body?.asrSource || '').trim() || undefined,
    voiceName,
    inputMode: String(req.body?.inputMode || '').trim() || undefined,
    vad: req.body?.vad || null,
    tryGenerateReportForCompletedSession,
    onSentence,
  }));

  logger.info('Interview realtime voice stream reply processed', getRequestLogMeta(req, {
    isComplete: Boolean(result.agentResult.isComplete),
    latency: result.latency,
  }));

  res.write(`data: ${JSON.stringify({
    type: 'done',
    result: buildLiveInterviewTurnResponse({
      agentResult: result.agentResult,
      updatedSession: result.updatedSession,
      generatedReport: result.generatedReport,
      transcription: result.transcription,
      latency: result.latency,
    })
  })}\n\n`);
  res.end();
});

export const synthesizeInterviewText = asyncHandler(async (req, res) => {
  const { sessionId, text, voiceName } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const cleanText = String(text || '').trim();
  if (!cleanText) {
    return res.status(400).json(formatError('Text is required', 'VALIDATION_ERROR', 'Text to synthesize cannot be empty'));
  }

  const result = await synthesizeSpeech({
    text: cleanText,
    voiceName: String(voiceName || '').trim() || undefined,
    usageContext: {
      userId: user.id,
      sessionId,
      stage: 'interview',
      source: 'interview_synthesize_endpoint',
    },
  });
  
  logger.info('Synthesized text to speech', getRequestLogMeta(req, {
    textLength: cleanText.length,
    voiceName: result.voiceName,
  }));

  res.json(formatSuccess('Text synthesized', {
    assistantAudio: {
      base64: result.audioBuffer.toString('base64'),
      contentType: result.contentType,
      provider: result.provider,
      voiceName: result.voiceName,
      outputFormat: result.outputFormat,
    }
  }));
});
