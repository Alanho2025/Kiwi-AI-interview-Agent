# Code-Document Alignment Map

## Purpose

This document aligns the current codebase with the documentation and final-report claims. Use this file to decide whether a README, report, Notion page, or presentation can describe a feature as implemented, product-wired, partial, proposed, or future work.

This file is intentionally conservative and was reconciled with the code on 2026-06-23. If a feature is not clearly wired into the product flow, do not describe it as fully implemented.

## Status tags

- **Implemented:** code exists and is wired into the product flow.
- **Product-wired, needs live verification:** frontend and backend are connected, but the full browser, provider, or user flow still needs live verification.
- **Partial:** code exists for part of the workflow, but a product promise would overstate the implementation.
- **Proposed:** documented direction or schema exists, but the product flow is not implemented.
- **Future:** intentionally outside the current MVP scope.

## Current alignment snapshot

| Documentation topic | Current status | Code references | Documentation action |
| --- | --- | --- | --- |
| Product vision and NZ market fit | Implemented as product framing, not as a code module | `README.md`, `docs/marker-review-guide.md`, `docs/commercial-product-plan.md` | Keep as report and pitch material. Do not claim market validation from code alone. |
| Core user journey | Implemented | `frontend/src/pages/AnalyzePage.jsx`, `frontend/src/pages/InterviewPage.jsx`, `frontend/src/pages/ReportPage.jsx`, `backend/src/controllers/analyzeController.js`, `backend/src/controllers/interviewController.js`, `backend/src/controllers/reportController.js` | Document the real flow as CV upload -> CV review -> JD paste -> JD review -> match -> plan -> text/voice interview -> report/QA. |
| Authentication and consent | Partial | `backend/src/controllers/authController.js`, `backend/src/middleware/authMiddleware.js`, `backend/src/middleware/csrfMiddleware.js`, `frontend/src/pages/Login.jsx`, `frontend/src/components/home/PrivacyDetailsModal.jsx` | Google auth, protected routes, cookie/Bearer support, CSRF, and privacy UI exist. Privacy modal wording about account cancellation and automatic deletion is ahead of the implemented self-service flow and must not be used as proof of enforcement. |
| CV upload and reuse | Implemented | `backend/src/controllers/uploadController.js`, `backend/src/services/fileRepositoryService.js`, `backend/src/services/cv/`, `frontend/src/components/analyze/CVManagementCard.jsx` | Include upload, recent CVs, select CV, rebuild profile, review profile, soft delete, and safe export where relevant. |
| CV parse human review | Implemented | `frontend/src/utils/cvReviewViewModel.js`, `frontend/src/pages/AnalyzePage.jsx`, `backend/src/services/cv/cvReviewedProfileService.js` | Describe as match-field review, not full resume editing. |
| JD input and structuring | Implemented for pasted JD, proposed for JD file upload | `backend/src/controllers/jobDescriptionController.js`, `backend/src/services/jobDescription/`, `frontend/src/components/analyze/JobContextCard.jsx` | Replace any “JD upload implemented” wording with “pasted JD implemented; JD file upload remains backlog.” |
| JD parse safeguards | Implemented | `backend/src/services/jobDescription/guardedJobDescriptionService.js`, `backend/src/services/jobDescription/jdParseCriticAgent.js`, `backend/src/services/jobDescription/jdParseGateService.js`, `backend/src/services/jobDescription/jdParseReparseAgent.js` | Keep as agentic self-correction evidence. |
| CV-JD match | Implemented | `backend/src/services/cv/cvAnalysisService.js`, `backend/src/services/match/`, `backend/src/services/cv/matchAnalysisRecordService.js`, `frontend/src/api/analyzeApi.js` | Document strengths, gaps, match analysis records, evidence refs, and guarded human-review behavior. |
| JD question filter | Implemented with fallback risk | `backend/src/services/questions/jdQuestionFilterService.js`, `backend/src/db/models/jdQuestionFilterModel.js` | Document that JD filters support question selection. Also state that failure may degrade specificity rather than always blocking the flow. |
| CV question seeds | Implemented with fallback risk | `backend/src/services/questions/cvQuestionSeedService.js` | Document seeds as candidate-specific question material, not final questions. |
| Prepared question pool | Implemented with adaptive use | `backend/src/services/questions/questionPoolComposerService.js`, `backend/src/db/models/interviewQuestionPoolItemModel.js` | Document the pool as candidate material used by the adaptive controller, not a fixed script. |
| Question deduplication | Implemented | `backend/src/services/questions/questionDeduplicationService.js`, `backend/src/services/questions/questionPoolPreparationService.js`, `backend/src/services/agents/interviewerAgent.js` | Describe both preparation-time pool deduplication and the final transcript-based spoken-question novelty guard. Pool exhaustion closes safely with `no_unique_question_remaining`. |
| Interview micro-planning and turn orchestration | Implemented | `backend/src/services/questions/interviewMicroPlanningService.js`, `backend/src/services/questions/interviewTurnOrchestratorService.js`, `backend/src/services/questions/questionWordingPolishService.js` | Describe how the system selects follow-up, gap validation, prepared question, or topic transition. |
| Question diagnostics | Implemented for non-production debugging | `backend/src/controllers/interviewDiagnosticsController.js`, `backend/src/services/questions/interviewQuestionDiagnosticsService.js`, `backend/src/api/routes/interviewRoutes.js` | The canonical route is `GET /api/interview/:sessionId/question-diagnostics`; the controller forbids it when `NODE_ENV=production`. |
| Interview planning | Implemented | `backend/src/services/sessionService.js`, `backend/src/config/interviewBlueprints.js`, `backend/src/services/match/questionPlanService.js`, `backend/src/controllers/analyzeController.js` | Include question-limited and time-limited setup. |
| Text interview | Implemented | `backend/src/controllers/interviewController.js`, `backend/src/services/interview/`, `backend/src/services/masterAiService.js`, `frontend/src/hooks/useInterviewSession.js` | Safest demo path. |
| Voice readiness check | Implemented on frontend | `frontend/src/hooks/useVoiceDeviceCheck.js`, `frontend/src/components/analyze/VoiceDeviceCheckPanel.jsx`, `frontend/src/pages/AnalyzePage.jsx` | Document browser, microphone, and speaker checks. Do not imply external provider health is proven by the device check. |
| Realtime live STT socket | Implemented transport, needs live provider verification | `backend/src/api/realtimeVoiceSocket.js`, `backend/src/services/voice/realtimeSpeechSessionService.js`, `backend/src/services/voice/realtimeSpeechProviderRouter.js`, `frontend/src/hooks/voice/useRealtimeSpeechSocket.js` | Azure is default and ElevenLabs is a session-start fallback. An active STT turn is not switched mid-recording. |
| Duplex voice agent | Product-wired, needs live verification | `backend/src/api/duplexVoiceSocket.js`, `backend/src/services/voice/duplexVoiceAgentService.js`, `backend/src/services/voice/duplexTurnCoordinator.js`, `backend/src/services/voice/ttsProviderRouter.js`, `frontend/src/hooks/useVoiceInterviewSession.js`, `frontend/src/hooks/voice/useDuplexVoiceSocket.js` | Present as wired for independently routed STT/TTS, adaptive turn processing, barge-in, and recording, with dependency on auth, configured provider credentials, microphone, and live session state. |
| Resumable voice recording | Implemented | `backend/src/controllers/recordingController.js`, `backend/src/services/recording/`, `backend/src/repositories/recordingUploadRepository.js`, `frontend/src/hooks/voice/useSessionAudioRecorder.js`, `frontend/src/runtime/recording/`, `frontend/src/components/report/RecordingStatusCard.jsx` | Document local IndexedDB durability, idempotent chunk upload, retry/recovery, asynchronous worker conversion, status polling, download, and report navigation that does not wait for MP3 readiness. The legacy single-upload route remains available. |
| Latency trace | Implemented as observability | `backend/src/utils/latencyTrace.js`, `backend/src/services/latency/voiceLatencySummaryService.js`, `frontend/src/utils/voiceLatencyTrace.js`, `frontend/src/utils/voiceLatencySummary.js`, `docs/voice-latency-trace-markers.md` | Mark as observability, not a guarantee that latency targets are always met. |
| Scoring and evidence-based feedback | Implemented | `backend/src/services/report/reportTurnDatasetService.js`, `backend/src/services/report/answerEvidenceSignalService.js`, `backend/src/services/questions/questionAssessmentContractService.js`, `backend/src/services/report/turnRubricService.js`, `backend/src/services/report/reportScoreService.js`, `frontend/src/components/report/` | Document accepted-answer pairing, question-specific rubric selection, deterministic scores, turn breakdowns, evidence sources, transcript risks, and coaching sections. |
| Report generation and QA | Implemented | `backend/src/controllers/reportController.js`, `backend/src/services/agents/reportGeneratorAgent.js`, `backend/src/services/agents/reportQaAgent.js`, `backend/src/db/models/sessionReportModel.js` | Generation runs initial QA, persists report versions and QA attempt count, and uses explicit statuses: `ready`, `ready_after_repair`, `needs_review`, or `repair_failed`. |
| Report grounding and bounded repair | Implemented | `backend/src/services/report/claimGroundingService.js`, `backend/src/services/report/reportQaRepairOrchestratorService.js`, `backend/src/services/report/reportEvidenceReferenceService.js`, `backend/src/services/report/reportTranscriptRiskService.js`, `backend/src/services/aiControl/reportActionExecutor.js` | QA may run at most two wording-repair attempts and must re-ground after each rewrite. Deterministic recompute flags skip wording repair. Do not describe this as an unlimited self-healing loop. |
| Report evidence and transcript-risk UI | Implemented | `frontend/src/components/report/EvidenceSourcesSection.jsx`, `frontend/src/components/report/TranscriptRiskSection.jsx`, `frontend/src/components/report/TurnBreakdownSection.jsx`, `frontend/src/utils/reportPdf/reportPdfTemplate.js` | Document visible claim/source/snippet/confidence rows, transcript-risk warnings, all scored turns, and PDF parity. |
| Commercial stress test | Implemented for measured AI usage summaries and report payload where instrumented | `backend/src/config/aiUsagePricing.js`, `backend/src/db/models/aiUsageEventModel.js`, `backend/src/services/aiUsageTrackingService.js`, `backend/src/controllers/reportController.js`, `frontend/src/components/report/CommercialStressTestSection.jsx` | DeepSeek and Azure costs use configured estimates. ElevenLabs usage is recorded but currently receives zero estimated cost. Broader business validation remains a report argument. |
| Data model and storage | Implemented with hardening gaps | `backend/src/db/initPostgresSchema.js`, `backend/src/db/models/`, `backend/src/repositories/`, `backend/src/services/fileRepositoryService.js` | PostgreSQL, MongoDB, local file storage, and browser IndexedDB recording queues are real. Encryption-at-rest guarantees and account-wide deletion remain gaps. |
| Retention cleanup | Implemented but operationally gated | `backend/src/services/retention/`, `backend/src/scripts/runRetentionAudit.js`, `backend/src/scripts/runRetentionCleanup.js`, `backend/src/services/retention/retentionWorker.js` | The audited dry-run/approved-execution pipeline, backup/quarantine, manifests, and queued-job worker exist. The worker is disabled by default and does not amount to an account-wide deletion guarantee. |
| Privacy, security, compliance | Partial | `backend/src/middleware/authMiddleware.js`, `backend/src/middleware/csrfMiddleware.js`, `backend/src/middleware/rateLimitMiddleware.js`, `backend/src/services/auditService.js`, `backend/src/services/privacyRedactionService.js` | Keep privacy wording honest. Do not claim full compliance, biometric processing, account-wide deletion, automatic 12-month account cleanup, or encrypted-at-rest storage unless implemented and operationally verified. |
| Evaluation and testing | Implemented with gaps | `backend/tests/robustness/`, `backend/eval/runners/`, `frontend/src/**/*.test.*`, `frontend/e2e/` | Document robustness and eval coverage. Note live voice E2E and wider match calibration gaps. |
| Pronunciation scoring | Future | No production scoring module found | Keep in future work. |
| Multilingual interview mode | Future | No production multilingual interview mode found | Keep in future work. |
| Voice cloning | Future | No production voice cloning module found | Keep in future work due to privacy and ethics risk. |

## Key corrections to apply across docs

1. The implemented JD path is pasted text plus structured parsing and review. JD file upload remains future work.
2. The prepared question pool is adaptive candidate material, not a fixed script.
3. The system can ask generated follow-ups even when prepared questions exist.
4. RAG runtime retrieval uses PostgreSQL `document_chunks` with a 256-dimensional weighted hash embedding path. This is useful for MVP retrieval experiments but should not be described as production-grade semantic retrieval.
5. Voice is not only a button. The product has live STT and duplex voice sockets, Azure/ElevenLabs routing, frontend hooks, VAD, TTS streaming, barge-in handling, latency traces, and resumable recording. The correct status is product-wired and needs live E2E verification.
6. Commercial stress testing is not only proposed. Usage tracking and DeepSeek/Azure cost estimation exist where instrumented; ElevenLabs is measured with zero estimated cost until pricing is added. Wider market proof belongs in the final report.
7. Privacy and security docs should separate implemented controls from product promises. Implemented controls include auth middleware, CSRF, rate limiting, ownership checks in many routes, audit logs, redaction helpers, an audited retention pipeline, and a disabled-by-default queued-job worker. Remaining gaps include route-complete ownership tests, account-wide deletion, encryption-at-rest guarantees, and deployment policy.
8. Report QA and repair are implemented as a bounded flow: initial QA plus at most two grounded wording-repair attempts. Deterministic failures skip wording repair, and unresolved reports remain visibly non-ready.
9. Voice recording is independently durable and resumable. Report readiness and MP3 readiness are separate states.

## Report-ready implementation summary

The current system is best described as a NZ-focused, CV/JD-grounded interview coaching workflow. Its strongest implemented chain is:

```text
Google login
  -> CV upload and parsed CV review
  -> pasted JD parsing and JD review
  -> guarded CV-JD match
  -> session setup and interview plan
  -> prepared question pool
  -> text interview or product-wired voice interview
  -> adaptive follow-up
  -> transcript and question metadata
  -> accepted-answer report-turn dataset
  -> report generation and initial QA
  -> optional bounded grounded repair
  -> versioned report status and recording status
  -> commercial stress test cost summary where usage events exist
```

The safest demo path remains text interview mode. Voice mode is technically wired and should be shown only in an environment with valid credentials for the configured provider order, authenticated WebSocket access, browser microphone permission, and a live interview session.
