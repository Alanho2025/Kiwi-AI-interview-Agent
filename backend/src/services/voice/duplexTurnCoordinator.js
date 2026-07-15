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
import { buildTranscriptConfirmationPrompt } from './transcriptUnderstandingSummary.js';
import { analyzeTranscriptConfirmationReply } from './transcriptConfirmationReplyClassifier.js';
import { generateVoiceMicroAcknowledgement } from './voiceAcknowledgementService.js';
import { sanitizeLiveSessionForClient } from '../session/sessionViewBuilder.js';
import { evaluateTranscriptReviewDecision } from './transcriptReviewPolicyService.js';
import { isHarnessShadowEnabled } from '../../config/harnessConfig.js';
import {
  beginWaitingInterviewNextTurnRun,
  scheduleHarnessRunPersistence,
} from '../harness/interviewNextTurnShadowHarness.js';

const VOICE_BRIDGE_DELAY_MS = Number(process.env.VOICE_BRIDGE_DELAY_MS || 1200);

const getQuestionIdentifier = (question = null) => question?.id
  || question?.questionId
  || question?._id
  || question?.preparedQuestionId
  || question?.metadata?.questionId
  || null;

const findLatestAiQuestionId = (updatedSession = {}) => {
  const transcript = Array.isArray(updatedSession?.transcript) ? updatedSession.transcript : [];
  const latestAiTurn = [...transcript].reverse().find((turn) => turn?.role === 'ai' && turn?.questionId);
  return latestAiTurn?.questionId || null;
};

const resolveWarmupQuestionId = ({ updatedSession = {}, turnResult = {} } = {}) => {
  const nextQuestionOrder = turnResult?.agentResult?.nextQuestionOrder;
  const latestAiQuestionId = findLatestAiQuestionId(updatedSession);
  if (latestAiQuestionId) return latestAiQuestionId;

  const plan = updatedSession?.interviewPlan || {};
  const questionPool = Array.isArray(plan.questionPool) ? plan.questionPool : [];
  const questions = Array.isArray(plan.questions) ? plan.questions : [];
  const oneBasedOrder = Number(nextQuestionOrder);
  const zeroBasedIndex = Number.isFinite(oneBasedOrder) ? Math.max(0, oneBasedOrder - 1) : 0;

  const candidateItems = [
    questionPool[zeroBasedIndex],
    questions[zeroBasedIndex],
    questionPool[oneBasedOrder],
    questions[oneBasedOrder],
    turnResult?.agentResult?.interviewerTurn,
    turnResult?.agentResult?.questionDecision,
  ];

  for (const item of candidateItems) {
    const id = getQuestionIdentifier(item);
    if (id) return id;
  }

  return null;
};

const buildNextClientTurnIds = (clientTurnId = null) => {
  if (!clientTurnId) return [];
  const ids = new Set([`${clientTurnId}-next`]);
  const match = String(clientTurnId).match(/^(.*?)(\d+)$/);
  if (match) {
    ids.add(`${match[1]}${Number(match[2]) + 1}`);
  }
  return [...ids].filter(Boolean);
};

const mergeConfirmedTranscript = ({ pending, confirmationDetails, confirmationReply }) => {
  const originalTranscript = String(pending?.originalTranscript || '').trim();
  const replyText = String(confirmationReply || '').trim();
  const extraContent = String(confirmationDetails?.extraContent || '').trim();

  if (confirmationDetails?.isContentfulClarification && replyText) {
    return `${originalTranscript}

User clarification after transcript check: ${replyText}`.trim();
  }

  if (extraContent) {
    return `${originalTranscript}

User clarification after confirming transcript: ${extraContent}`.trim();
  }

  return originalTranscript;
};

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
  getPendingTranscriptConfirmation = () => null,
  setPendingTranscriptConfirmation = () => { },
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

  const streamEarlyAcknowledgement = async ({ transcriptText, asrConfidence, vad, speechToken, source }) => {
    const startedAt = Date.now();
    try {
      const acknowledgementText = await generateVoiceMicroAcknowledgement({
        session,
        transcriptText,
        asrConfidence,
        vad,
      });

      if (!acknowledgementText || !bargeInController?.isTokenActive?.(speechToken)) {
        return false;
      }

      const acknowledgementIndex = sentenceIndex;
      trace('early_acknowledgement_ready', {
        text: acknowledgementText,
        durationMs: Date.now() - startedAt,
        speechTokenActive: bargeInController?.isTokenActive?.(speechToken),
      });

      sendJson?.({
        type: 'assistant_text_delta',
        tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        text: acknowledgementText,
        index: acknowledgementIndex,
        turnType: 'bridge_acknowledgement',
        countsAsQuestion: false,
        timestamp: new Date().toISOString(),
      });

      await streamAssistantSpeech({
        text: acknowledgementText,
        voiceName,
        sendJson,
        bargeInController,
        index: acknowledgementIndex,
        speechToken,
        usageContext: {
          userId,
          sessionId: session?.id || null,
          stage: 'interview',
          source: source || 'duplex_bridge_acknowledgement',
        },
      });

      sentenceIndex = Math.max(sentenceIndex, acknowledgementIndex + 1);

      trace('early_acknowledgement_tts_done', {
        text: acknowledgementText,
        durationMs: Date.now() - startedAt,
      });

      return true;
    } catch (error) {
      trace('early_acknowledgement_failed', {
        error: error?.message || String(error),
        durationMs: Date.now() - startedAt,
      });
      return false;
    }
  };

  const processRealtimeTurnWithDelayedBridge = async ({
    transcriptText,
    transcriptProvenance = null,
    asrConfidence,
    vad,
    speechToken,
    skipTranscriptGate = false,
    transcriptConfirmation = null,
    acknowledgementSource = 'duplex_bridge_acknowledgement',
    sentenceSource = 'duplex_interview_sentence',
  }) => {
    let firstSentenceReady = false;
    let bridgeStarted = false;
    let bridgeDonePromise = Promise.resolve(false);
    let bridgeTimer = null;
    let realSentenceBaseIndex = null;

    const clearBridgeTimer = () => {
      if (!bridgeTimer) return;
      clearTimeout(bridgeTimer);
      bridgeTimer = null;
    };

    bridgeTimer = setTimeout(() => {
      if (firstSentenceReady) return;
      if (!bargeInController?.isTokenActive?.(speechToken)) return;

      bridgeStarted = true;
      bridgeDonePromise = streamEarlyAcknowledgement({
        transcriptText,
        asrConfidence,
        vad,
        speechToken,
        source: acknowledgementSource,
      }).catch((error) => {
        logger?.warn?.('Bridge acknowledgement failed', {
          sessionId: session?.id,
          error: error?.message || String(error),
        });
        return false;
      });
    }, VOICE_BRIDGE_DELAY_MS);

    trace('process_realtime_voice_turn_start', {
      transcriptText,
      asrConfidence,
      asrSource,
    });

    try {
      const result = await processRealtimeVoiceTurn({
        session,
        userId,
        transcriptText,
        transcriptProvenance,
        language,
        asrConfidence,
        asrSource,
        voiceName,
        inputMode: 'duplex_voice',
        vad,
        clientTurnId,
        skipTranscriptGate,
        transcriptConfirmation,
        onSentence: async (text, index) => {
          try {
            firstSentenceReady = true;
            clearBridgeTimer();

            if (!bargeInController?.isTokenActive?.(speechToken)) return;

            if (bridgeStarted) {
              await bridgeDonePromise;
            }

            if (realSentenceBaseIndex === null) {
              realSentenceBaseIndex = sentenceIndex;
            }

            const nextIndex = Number.isFinite(index) ? realSentenceBaseIndex + index : sentenceIndex;
            sentenceIndex = Math.max(sentenceIndex, nextIndex + 1);

            trace('assistant_sentence_ready', {
              index: nextIndex,
              text,
              speechTokenActive: bargeInController?.isTokenActive?.(speechToken),
            });

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
                source: sentenceSource,
              },
            });

            trace('assistant_sentence_tts_done', {
              index: nextIndex,
              text,
            });
          } catch (error) {
            logger?.error?.('Failed to process sentence in duplex turn', {
              sessionId: session?.id,
              index,
              text,
              error: error.message,
            });
          }
        },
      });

      firstSentenceReady = true;
      clearBridgeTimer();
      if (bridgeStarted) {
        await bridgeDonePromise;
      }

      return result;
    } catch (error) {
      firstSentenceReady = true;
      clearBridgeTimer();
      throw error;
    }
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

  const processFinalTranscript = async ({ transcriptText, transcriptProvenance = null, asrConfidence = null, vad = null } = {}) => {
    const processConfirmedPendingTranscript = async ({
      pending,
      confirmationReply,
      confirmationDecision = 'confirm',
      resolvedTranscriptText = null,
    }) => {
      sendJson?.({
        type: 'agent_thinking',
        tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
        timestamp: new Date().toISOString(),
      });

      const speechToken = bargeInController?.startAssistantSpeech?.();
      sentenceIndex = 0;

      const transcriptForPlanning = String(resolvedTranscriptText || pending.originalTranscript || '').trim();

      const result = await processRealtimeTurnWithDelayedBridge({
        transcriptText: transcriptForPlanning,
        transcriptProvenance: pending.transcriptProvenance || transcriptProvenance,
        asrConfidence: pending.asrConfidence,
        vad: pending.vad,
        speechToken,
        skipTranscriptGate: true,
        transcriptConfirmation: {
          confirmedByUser: true,
          confirmationReply,
          confirmationDecision,
          pendingConfirmationId: pending.id,
          workflowRunId: pending.harnessWorkflowRunId || null,
          resolvedTranscriptText: transcriptForPlanning,
          usedClarification: transcriptForPlanning !== String(pending.originalTranscript || '').trim(),
          originalAssessment: pending.assessment || null,
          transcriptReviewDecision: pending.transcriptReviewDecision || null,
          evidenceBoundary: {
            rawTranscriptImmutable: true,
            clarificationCanReplaceRawTranscript: false,
            clarificationCanAffectCoaching: true,
          },
        },
        acknowledgementSource: 'duplex_confirmed_bridge_acknowledgement',
        sentenceSource: 'duplex_confirmed_interview_sentence',
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
        session: sanitizeLiveSessionForClient(result?.updatedSession || session),
        transcription: result?.transcription || null,
        latency: result?.latency || null,
        isComplete: Boolean(result?.agentResult?.isComplete),
        completedBecause: result?.agentResult?.completedBecause || null,
        timestamp: new Date().toISOString(),
      });

      return result;
    };

    const streamTranscriptConfirmationPrompt = async ({
      assessment,
      transcriptText,
      asrConfidence,
      vad: confirmationVad,
      transcriptReviewDecision = null,
    }) => {
      const confirmationPrompt = buildTranscriptConfirmationPrompt(transcriptText);
      const waitingHarnessRun = await beginWaitingInterviewNextTurnRun({
        enabled: isHarnessShadowEnabled(),
        session,
        payload: {
          inputMode: 'duplex_voice',
          clientTurnId,
        },
        appendRun: scheduleHarnessRunPersistence,
      });
      const nextPendingTranscriptConfirmation = {
        id: `pending-${Date.now()}`,
        harnessWorkflowRunId: waitingHarnessRun.workflowRunId,
        originalTranscript: transcriptText,
        transcriptProvenance,
        asrConfidence,
        vad: confirmationVad,
        assessment,
        transcriptReviewDecision,
        confirmationPrompt,
        createdAt: new Date().toISOString(),
        currentQuestionIndex: session?.currentQuestionIndex || null,
      };
      setPendingTranscriptConfirmation(nextPendingTranscriptConfirmation);

      trace('stream_transcript_confirmation_start', {
        reason: assessment?.reason || 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
        transcriptText,
        asrConfidence,
        confidenceGate: assessment?.confidenceGate || null,
        metrics: assessment?.metrics || null,
        confirmationPrompt,
        transcriptReviewDecision,
      });

      const speechToken = bargeInController?.startAssistantSpeech?.();
      sendJson?.({
        type: 'transcript_confirmation_requested',
        tool: AGENT_TOOL_NAMES.TRANSCRIBE_REALTIME_SPEECH,
        reason: assessment?.reason || 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
        message: confirmationPrompt,
        confirmationPrompt,
        transcription: {
          accepted: false,
          text: transcriptText,
          confidence: asrConfidence,
          confidenceGate: assessment?.confidenceGate || null,
          metrics: assessment?.metrics || null,
          requiresUnderstandingConfirmation: true,
          transcriptReviewDecision,
        },
        reviewDecision: transcriptReviewDecision,
        turnType: 'transcript_confirmation',
        countsAsQuestion: false,
        timestamp: new Date().toISOString(),
      });
      sendJson?.({
        type: 'assistant_text_delta',
        tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        text: confirmationPrompt,
        index: 0,
        timestamp: new Date().toISOString(),
      });
      await streamAssistantSpeech({
        text: confirmationPrompt,
        voiceName,
        sendJson,
        bargeInController,
        index: 0,
        speechToken,
        usageContext: {
          userId,
          sessionId: session?.id || null,
          stage: 'interview',
          source: 'duplex_transcript_confirmation',
        },
      });
      bargeInController?.finishAssistantSpeech?.(speechToken);
      sendJson?.({
        type: 'assistant_speech_done',
        tool: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        timestamp: new Date().toISOString(),
      });
      trace('stream_transcript_confirmation_done', {
        reason: assessment?.reason || 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
      });
      return {
        transcriptConfirmationRequested: true,
        assessment,
        pendingTranscriptConfirmation: nextPendingTranscriptConfirmation,
      };
    };

    const startedAt = Date.now();
    const cleanTranscript = String(transcriptText || '').trim();
    trace('process_final_transcript_start', {
      transcriptText: cleanTranscript,
      transcriptLength: cleanTranscript.length,
      words: cleanTranscript ? cleanTranscript.split(/\s+/).filter(Boolean).length : 0,
      asrConfidence,
      vad,
    });

    const pendingTranscriptConfirmation = getPendingTranscriptConfirmation?.() || null;
    if (pendingTranscriptConfirmation) {
      const confirmationDetails = analyzeTranscriptConfirmationReply(cleanTranscript);
      const confirmationDecision = confirmationDetails.decision;

      trace('pending_transcript_confirmation_reply', {
        confirmationDecision,
        replyText: cleanTranscript,
        pendingId: pendingTranscriptConfirmation.id,
        hasExtraContent: confirmationDetails.hasExtraContent,
        isContentfulClarification: confirmationDetails.isContentfulClarification,
      });

      if (confirmationDecision === 'confirm' || confirmationDetails.isContentfulClarification) {
        const pending = pendingTranscriptConfirmation;

        const resolvedTranscriptText = mergeConfirmedTranscript({
          pending,
          confirmationDetails,
          confirmationReply: cleanTranscript,
        });

        const resolvedDecision = confirmationDetails.isContentfulClarification
          ? 'clarification'
          : confirmationDetails.hasExtraContent
            ? 'confirm_with_clarification'
            : 'confirm';

        setPendingTranscriptConfirmation(null);

        sendJson?.({
          type: 'transcript_confirmation_resolved',
          decision: resolvedDecision,
          turnType: 'transcript_confirmation',
          countsAsQuestion: false,
          timestamp: new Date().toISOString(),
        });

        trace('pending_transcript_confirmation_confirmed', {
          pendingId: pending.id,
          confirmationDecision: resolvedDecision,
          resolvedTranscriptText,
          usedClarification: resolvedTranscriptText !== String(pending.originalTranscript || '').trim(),
        });

        return processConfirmedPendingTranscript({
          pending,
          confirmationReply: cleanTranscript,
          confirmationDecision: resolvedDecision,
          resolvedTranscriptText,
        });
      }

      if (confirmationDecision === 'reject') {
        setPendingTranscriptConfirmation(null);
        return streamRepairPrompt({
          assessment: {
            ok: false,
            decision: 'reject',
            reason: 'TRANSCRIPT_CONFIRMATION_REJECTED',
            message: 'Thanks. Please clarify or repeat your answer for the same question.',
            confidenceGate: null,
            metrics: null,
          },
          transcriptText: cleanTranscript,
          asrConfidence,
        });
      }

      return streamRepairPrompt({
        assessment: {
          ok: false,
          decision: 'reject',
          reason: 'TRANSCRIPT_CONFIRMATION_UNCLEAR',
          message: 'Please briefly confirm or correct what I heard. You can say yes and add one short clarification, or correct the answer.',
          confidenceGate: null,
          metrics: null,
        },
        transcriptText: cleanTranscript,
        asrConfidence,
      });
    }

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
    if (assessment.requiresUnderstandingConfirmation || assessment.decision === 'confirm_understanding') {
      logger?.info?.('Duplex voice transcript needs understanding confirmation before scoring', {
        sessionId: session?.id,
        reason: assessment.reason,
        confidenceStatus: assessment.confidenceGate?.status,
        metrics: assessment.metrics,
      });
      const reviewDecision = evaluateTranscriptReviewDecision({
        rawTranscript: transcriptProvenance?.rawText || transcriptProvenance?.transcriptCalibration?.rawTranscript || cleanTranscript,
        calibratedTranscript: transcriptProvenance?.normalizedText
          || transcriptProvenance?.transcriptCalibration?.calibratedTranscript
          || cleanTranscript,
        transcriptCalibration: transcriptProvenance?.transcriptCalibration || null,
        transcriptGate: assessment,
        asrConfidence,
      });
      return streamTranscriptConfirmationPrompt({
        assessment: {
          ...assessment,
          transcriptReviewDecision: reviewDecision,
        },
        transcriptText: cleanTranscript,
        asrConfidence,
        vad,
        transcriptReviewDecision: reviewDecision,
      });
    }

    if (!assessment.ok) {
      logger?.info?.('Duplex voice transcript rejected before scoring', {
        sessionId: session?.id,
        reason: assessment.reason,
        confidenceStatus: assessment.confidenceGate?.status,
        metrics: assessment.metrics,
      });
      return streamRepairPrompt({ assessment, transcriptText: cleanTranscript, asrConfidence });
    }

    const transcriptReviewDecision = evaluateTranscriptReviewDecision({
      rawTranscript: transcriptProvenance?.rawText || transcriptProvenance?.transcriptCalibration?.rawTranscript || cleanTranscript,
      calibratedTranscript: transcriptProvenance?.normalizedText
        || transcriptProvenance?.transcriptCalibration?.calibratedTranscript
        || cleanTranscript,
      transcriptCalibration: transcriptProvenance?.transcriptCalibration || null,
      transcriptGate: assessment,
      asrConfidence,
    });
    trace('transcript_review_policy_assessed', {
      decisionType: transcriptReviewDecision.decisionType,
      riskLevel: transcriptReviewDecision.riskLevel,
      scoringPolicy: transcriptReviewDecision.scoringPolicy,
      reasonCodes: transcriptReviewDecision.reasonCodes || [],
    });
    if (transcriptReviewDecision.decisionType === 'immediate_confirmation'
      && transcriptReviewDecision.scoringPolicy === 'block_scoring_until_confirmed') {
      return streamTranscriptConfirmationPrompt({
        assessment: {
          ...assessment,
          ok: false,
          decision: 'confirm_understanding',
          reason: 'TRANSCRIPT_REVIEW_CONFIRMATION_REQUIRED',
          requiresUnderstandingConfirmation: true,
          shouldProcessAnswer: false,
          countsAsQuestion: false,
          transcriptReviewDecision,
        },
        transcriptText: cleanTranscript,
        asrConfidence,
        vad,
        transcriptReviewDecision,
      });
    }

    sendJson?.({
      type: 'agent_thinking',
      tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
      timestamp: new Date().toISOString(),
    });

    const speechToken = bargeInController?.startAssistantSpeech?.();
    sentenceIndex = 0;

    const result = await processRealtimeTurnWithDelayedBridge({
      transcriptText: cleanTranscript,
      transcriptProvenance,
      asrConfidence,
      vad,
      speechToken,
      acknowledgementSource: 'duplex_bridge_acknowledgement',
      sentenceSource: 'duplex_interview_sentence',
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
      session: sanitizeLiveSessionForClient(updatedSession),
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
      const nextQuestionOrder = turnResult?.agentResult?.nextQuestionOrder;
      const nextQuestionId = resolveWarmupQuestionId({ updatedSession, turnResult });
      const nextClientTurnIds = buildNextClientTurnIds(clientTurnId);

      if (!nextQuestionId) {
        trace('warmup_skipped_no_next_question', {
          nextQuestionOrder,
          transcriptLength: updatedSession?.transcript?.length || 0,
          questionPoolSize: updatedSession?.interviewPlan?.questionPool?.length || 0,
          questionsSize: updatedSession?.interviewPlan?.questions?.length || 0,
        });
        return;
      }

      if (!nextClientTurnIds.length) {
        trace('warmup_skipped_no_turn_id');
        return;
      }

      trace('warmup_trigger_start', {
        nextQuestionIndex: nextQuestionOrder,
        nextQuestionId,
        nextClientTurnIds,
      });

      await Promise.all(nextClientTurnIds.map((nextClientTurnId) => warmContextService.prepareWarmContext({
        session: updatedSession,
        userId,
        currentQuestionId: nextQuestionId,
        clientTurnId: nextClientTurnId,
        currentQuestionIndex: nextQuestionOrder,
        transcriptLength: updatedSession?.transcript?.length || 0,
      })));

      trace('warmup_trigger_done', {
        nextQuestionIndex: nextQuestionOrder,
        nextQuestionId,
        nextClientTurnIds,
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
