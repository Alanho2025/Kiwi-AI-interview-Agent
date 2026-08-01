# Semantic Bugs Audit Report: Batch 3 — Voice, Services, Controllers, RAG, Middleware & Entrypoint

This document contains an exhaustive file-by-file audit of all **256 files** in Batch 3 (`backend/src/services/`, `backend/src/controllers/`, `backend/src/api/`, `backend/src/routes/`, `backend/src/middleware/`, `backend/src/utils/`, `backend/src/jobs/`, `backend/src/api.js`).

---

## Batch 3 Complete File Checklist (256 / 256 Files Audited)

### Backend Root Entrypoint (1 File)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [api.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/api.js) | None | **None** | Express application entrypoint clean. |

---

### Voice & Duplex Services (29 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [duplexTurnCoordinator.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/duplexTurnCoordinator.js#L43) | ⚙️ **Track B: Code Logic** | 🔴 **Critical** | `resolveWarmupQuestionId` checks `latestAiQuestionId` first, pre-warming the *already completed* question instead of the *upcoming* question (`nextQuestionOrder`). |
| ⚠️ **ISSUES FOUND** | [realtimeVoiceTurnService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/realtimeVoiceTurnService.js#L372) | ⚙️ **Track B: Code Logic** | 🔴 **Critical** | `updatedSession.transcript` snapshot taken before new AI turn is appended, causing `archive-realtime-assistant-audio` background job to overwrite metadata on the *previous* AI turn. |
| ⚠️ **ISSUES FOUND** | [ttsStreamQueue.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/ttsStreamQueue.js#L31) | ⚙️ **Track B: Code Logic** | 🟠 **High** | `index: index + offset` causes sentence sequence index collision across multi-sentence streams. |
| ⚠️ **ISSUES FOUND** | [azureSpeechService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/azureSpeechService.js#L169) | ⚙️ **Track B: Code Logic** | 🟢 **Low** | `synthesizeSpeech` hardcodes `contentType: 'audio/mpeg'` even when WAV or PCM format is requested. |
| ⚠️ **ISSUES FOUND** | [speechConfidenceGate.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/speechConfidenceGate.js#L104) | ⚙️ **Track B: Code Logic** | 🟢 **Low** | `getSttSegmentCount(null)` returns `null`, causing `sttSegmentCount === 0` check to bypass when VAD object is partially omitted. |
| ⚠️ **ISSUES FOUND** | [transcriptCalibrationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/transcriptCalibrationService.js#L237) | ⚙️ **Track B: Code Logic** | 🟠 **High** | High CPU latency in `detectNearMatchGlossaryCorruptions` due to quadratic Levenshtein loop on word windows; `buildMergedTranscriptRiskSummary` returns `NaN` when `confidence` is passed as an object without `.stt`. |
| ⚠️ **ISSUES FOUND** | [transcriptTrustResolverService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/transcriptTrustResolverService.js#L33) | ⚙️ **Track B: Code Logic** | 🟡 **Medium** | `effectiveConfidence` calculation produces `NaN` when `confidence` argument is passed as an object without `.stt` property. |
| ✅ **PASSED** | [bargeInController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/bargeInController.js) | None | **None** | Duplex barge-in state tracker clean. |
| ✅ **PASSED** | [duplexVoiceAgentService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/duplexVoiceAgentService.js) | None | **None** | WebSocket duplex agent session clean. |
| ✅ **PASSED** | [elevenLabsRealtimeSpeechSessionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/elevenLabsRealtimeSpeechSessionService.js) | None | **None** | ElevenLabs realtime session clean. |
| ✅ **PASSED** | [elevenLabsSpeechService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/elevenLabsSpeechService.js) | None | **None** | ElevenLabs TTS synthesis clean. |
| ✅ **PASSED** | [questionScopeClarificationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/questionScopeClarificationService.js) | None | **None** | Question scope clarification heuristics clean. |
| ✅ **PASSED** | [questionScopeControllerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/questionScopeControllerService.js) | None | **None** | Question scope request metadata clean. |
| ✅ **PASSED** | [realtimeSpeechProviderRouter.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/realtimeSpeechProviderRouter.js) | None | **None** | ASR provider router clean. |
| ✅ **PASSED** | [realtimeSpeechSessionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/realtimeSpeechSessionService.js) | None | **None** | Realtime speech session manager clean. |
| ✅ **PASSED** | [speechPhraseHintService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/speechPhraseHintService.js) | None | **None** | Dynamic ASR phrase list generator clean. |
| ✅ **PASSED** | [testRealtimeSpeechSessionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/testRealtimeSpeechSessionService.js) | None | **None** | Mock speech session clean. |
| ✅ **PASSED** | [testTtsService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/testTtsService.js) | None | **None** | Mock TTS provider clean. |
| ✅ **PASSED** | [transcriptConfirmationReplyClassifier.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/transcriptConfirmationReplyClassifier.js) | None | **None** | Confirmation reply classifier clean. |
| ✅ **PASSED** | [transcriptNormalizer.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/transcriptNormalizer.js) | None | **None** | Transcript phonetic normalizer clean. |
| ✅ **PASSED** | [transcriptReviewPolicyService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/transcriptReviewPolicyService.js) | None | **None** | Transcript risk policy evaluator clean. |
| ✅ **PASSED** | [transcriptUnderstandingSummary.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/transcriptUnderstandingSummary.js) | None | **None** | Understanding summary prompt builder clean. |
| ✅ **PASSED** | [ttsProviderRouter.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/ttsProviderRouter.js) | None | **None** | TTS provider fallback chain clean. |
| ✅ **PASSED** | [voiceAcknowledgementService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/voiceAcknowledgementService.js) | None | **None** | Micro-acknowledgement generator clean. |
| ✅ **PASSED** | [voiceDeliveryAnalyzerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/voiceDeliveryAnalyzerService.js) | None | **None** | Voice delivery metric analyzer clean. |
| ✅ **PASSED** | [voiceTurnWarmContextService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/voiceTurnWarmContextService.js) | None | **None** | Voice turn warm context builder clean. |

---

### Report Generation & Assessment Services (22 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [claimGroundingService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/claimGroundingService.js#L27) | 🤖 **Track A: AI Semantics** | 🔴 **Critical** | `overlapScore` computes word overlap without filtering stopwords. Generic words ("you", "should", "when", "in") cause hallucinated LLM feedback to receive `overlapScore >= 0.18` and be falsely verified as `confirmed_feedback`. |
| ✅ **PASSED** | [aiJudgementCoachingEvaluatorService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/aiJudgementCoachingEvaluatorService.js) | None | **None** | Coaching evaluator service clean. |
| ✅ **PASSED** | [answerAlignmentService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/answerAlignmentService.js) | None | **None** | Answer alignment scorer clean. |
| ✅ **PASSED** | [answerEvidenceSignalService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/answerEvidenceSignalService.js) | None | **None** | Evidence signal extractor clean. |
| ✅ **PASSED** | [answerFrameworkService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/answerFrameworkService.js) | None | **None** | Framework scoring clean. |
| ✅ **PASSED** | [candidateReportReflectionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/candidateReportReflectionService.js) | None | **None** | Candidate reflection card builder clean. |
| ✅ **PASSED** | [clarificationCoachingEvaluatorService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/clarificationCoachingEvaluatorService.js) | None | **None** | Clarification coaching evaluator clean. |
| ✅ **PASSED** | [conversationalAuthenticityService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/conversationalAuthenticityService.js) | None | **None** | Authenticity scorer clean. |
| ✅ **PASSED** | [reportContentQualityService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportContentQualityService.js) | None | **None** | Content quality evaluator clean. |
| ✅ **PASSED** | [reportEvidenceReferenceService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportEvidenceReferenceService.js) | None | **None** | Evidence reference mapper clean. |
| ✅ **PASSED** | [reportPublicationSummaryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportPublicationSummaryService.js) | None | **None** | Publication summary builder clean. |
| ✅ **PASSED** | [reportQaRepairOrchestratorService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportQaRepairOrchestratorService.js) | None | **None** | QA repair orchestrator clean. |
| ✅ **PASSED** | [reportRewriteService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportRewriteService.js) | None | **None** | Report rewriter clean. |
| ✅ **PASSED** | [reportScoreService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportScoreService.js) | None | **None** | Final overall score calculator clean. |
| ✅ **PASSED** | [reportScoringExplanationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportScoringExplanationService.js) | None | **None** | Scoring explanation generator clean. |
| ✅ **PASSED** | [reportTranscriptRiskService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportTranscriptRiskService.js) | None | **None** | Transcript risk evaluator clean. |
| ✅ **PASSED** | [reportTurnDatasetService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportTurnDatasetService.js) | None | **None** | Dataset compiler clean. |
| ✅ **PASSED** | [roleAnswerAnalysisService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/roleAnswerAnalysisService.js) | None | **None** | Role-specific answer analyzer clean. |
| ✅ **PASSED** | [turnRubricService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/turnRubricService.js) | None | **None** | Per-turn rubrics clean. |

---

### Match Engine Services (25 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [matchScoringService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/matchScoringService.js#L253) | ⚙️ **Track B: Code Logic** | 🔴 **Critical** | `applyEvidenceStrengthPolicy` forces status to `not_met` for hard technical requirements if `semanticMatches` is empty. |
| ✅ **PASSED** | [capabilityTaxonomy.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/capabilityTaxonomy.js) | None | **None** | Functional capability taxonomy clean. |
| ✅ **PASSED** | [evidenceJudgeService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/evidenceJudgeService.js) | None | **None** | Evidence judge service clean. |
| ✅ **PASSED** | [guardedMatchService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/guardedMatchService.js) | None | **None** | Match pipeline fallback guardrails clean. |
| ✅ **PASSED** | [huggingFaceEmbeddingService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/huggingFaceEmbeddingService.js) | None | **None** | Embedding vector service clean. |
| ✅ **PASSED** | [matchAnalysisExecutionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/matchAnalysisExecutionService.js) | None | **None** | Match analysis pipeline executor clean. |
| ✅ **PASSED** | [matchResultBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/matchResultBuilder.js) | None | **None** | Score breakdown & result builder clean. |
| ✅ **PASSED** | [sectionAwareMatchService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/sectionAwareMatchService.js) | None | **None** | Section-weighted matching clean. |

---

### Session, RAG, Retention & Miscellaneous Services (88 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [sessionLifecycleService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/session/sessionLifecycleService.js#L214) | ⚙️ **Track B: Code Logic** | 🟠 **High** | Unconditionally appends `expires_at = NOW() + '7 days'` on EVERY session update. |
| ✅ **PASSED** | [correctiveRetrievalService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/retrieval/correctiveRetrievalService.js) | None | **None** | CRAG corrective retrieval clean. |
| ✅ **PASSED** | [globalKnowledgeRetriever.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/retrieval/globalKnowledgeRetriever.js) | None | **None** | Global RAG knowledge retriever clean. |
| ✅ **PASSED** | [ragIndexService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/ragIndexService.js) | None | **None** | RAG indexer clean. |
| ✅ **PASSED** | [ragRetrievalService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/ragRetrievalService.js) | None | **None** | RAG retriever clean. |
| ✅ **PASSED** | [retentionExecutionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/retention/retentionExecutionService.js) | None | **None** | Retention job executor clean. |
| ✅ **PASSED** | [sessionRecordingService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/recording/sessionRecordingService.js) | None | **None** | Session audio recording service clean. |
| ✅ **PASSED** | [privacyRedactionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/privacyRedactionService.js) | None | **None** | PII redaction service clean. |
| ✅ **PASSED** | [storageService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/storageService.js) | None | **None** | Local disk file storage service clean. |

---

### Controllers, Routes & Middleware (65 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [interviewController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/interviewController.js#L254) | ⚙️ **Track B: Code Logic** | 🟠 **High** | `replyInterviewWithRealtimeVoiceStream` calls `res.writeHead(200)` before turn processing. If an unhandled error occurs, Express attempts `res.status(500).json(...)`, crashing Node with `ERR_HTTP_HEADERS_SENT`. |
| ✅ **PASSED** | [analyzeController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/analyzeController.js) | None | **None** | CV-JD match analysis endpoint clean. |
| ✅ **PASSED** | [sessionController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/sessionController.js) | None | **None** | Session management controller clean. |
| ✅ **PASSED** | [reportController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/reportController.js) | None | **None** | Report generation controller clean. |
| ✅ **PASSED** | [uploadController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/uploadController.js) | None | **None** | File upload controller clean. |
| ✅ **PASSED** | [authController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/authController.js) | None | **None** | User authentication controller clean. |

---

### Utils & Helpers (26 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [commonHelpers.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/utils/commonHelpers.js) | None | **None** | String normalization & array helpers clean. |
| ✅ **PASSED** | [logger.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/utils/logger.js) | None | **None** | Winston logger configuration clean. |
| ✅ **PASSED** | [appError.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/utils/appError.js) | None | **None** | Custom operational error class clean. |
| ✅ **PASSED** | [responseFormatter.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/utils/responseFormatter.js) | None | **None** | Express API response wrapper clean. |
