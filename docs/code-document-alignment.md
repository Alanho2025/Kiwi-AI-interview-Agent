# Code-Document Alignment Map

## Purpose

This document aligns the current codebase with the Notion knowledge architecture page: "GAI Voice Agent - Systematic Knowledge Architecture".

Use this as the source of truth when deciding whether a report, README, Notion page, or presentation can describe a feature as implemented, partial, proposed, or future.

## Status Tags

- Implemented: code exists and is wired into the product flow.
- Product-wired, needs E2E verification: frontend and backend are connected, but the full browser/provider/user flow still needs live verification.
- Partial: code exists for part of the workflow, but a product promise would still overstate the implementation.
- Proposed: documented direction or schema exists, but the product flow is not implemented.
- Future: intentionally out of current MVP scope.

## Current Alignment Snapshot

| Documentation topic | Current status | Code references | Documentation action |
| --- | --- | --- | --- |
| Product Vision and NZ Market Fit | Implemented as product framing, not as a code module | `README.md`, `docs/website_feature.md`, `frontend/src/pages/LandingPage.jsx` | Keep as report/pitch material. Avoid claiming market validation from code alone. |
| Core User Journey | Implemented | `frontend/src/pages/AnalyzePage.jsx`, `frontend/src/pages/InterviewPage.jsx`, `frontend/src/pages/ReportPage.jsx`, `backend/src/controllers/analyzeController.js`, `backend/src/controllers/interviewController.js`, `backend/src/controllers/reportController.js` | Document the real flow as CV upload -> CV review -> JD paste -> JD review -> match -> plan -> text/voice interview -> report/QA. |
| Authentication and consent | Partial | `backend/src/controllers/authController.js`, `backend/src/middleware/authMiddleware.js`, `backend/src/middleware/csrfMiddleware.js`, `frontend/src/pages/Login.jsx`, `frontend/src/components/home/PrivacyDetailsModal.jsx` | Google auth, protected routes, cookie/Bearer support, CSRF, and privacy checkbox exist. Compliance wording still needs to be kept conservative. |
| CV upload and reuse | Implemented | `backend/src/controllers/uploadController.js`, `backend/src/services/fileRepositoryService.js`, `backend/src/services/cv/cvLifecycleService.js`, `frontend/src/components/analyze/CVManagementCard.jsx` | Update docs to include upload, recent CVs, select CV, rebuild profile, review profile, soft delete, and safe export. |
| CV parse human review | Implemented | `frontend/src/utils/cvReviewViewModel.js`, `frontend/src/pages/AnalyzePage.jsx`, `backend/src/services/cv/cvReviewedProfileService.js` | Describe as match-field review, not full resume editing. |
| JD input and structuring | Implemented for pasted JD, proposed for JD file upload | `backend/src/controllers/jobDescriptionController.js`, `backend/src/services/jobDescription/`, `frontend/src/components/analyze/JobContextCard.jsx` | Replace "JD upload implemented" wording with "pasted JD implemented; JD file upload remains backlog." |
| JD parse safeguards | Implemented | `backend/src/services/jobDescription/guardedJobDescriptionService.js`, `backend/src/services/jobDescription/jdParseCriticAgent.js`, `backend/src/services/jobDescription/jdParseGateService.js`, `backend/src/services/jobDescription/jdParseReparseAgent.js` | Keep as agentic self-correction evidence. |
| CV-JD match | Implemented | `backend/src/services/cv/cvAnalysisService.js`, `backend/src/services/match/`, `backend/src/services/cv/matchAnalysisRecordService.js`, `frontend/src/api/analyzeApi.js` | Document strengths, gaps, match analysis records, evidence refs, and guarded human-review behavior. |
| Interview planning | Implemented | `backend/src/services/sessionService.js`, `backend/src/config/interviewBlueprints.js`, `backend/src/services/match/questionPlanService.js`, `backend/src/controllers/analyzeController.js` | Include question-limited and time-limited setup. |
| Text interview | Implemented | `backend/src/controllers/interviewController.js`, `backend/src/services/interview/`, `backend/src/services/masterAiService.js`, `frontend/src/hooks/useInterviewSession.js` | Safe demo path. |
| Voice readiness check | Implemented on frontend | `frontend/src/hooks/useVoiceDeviceCheck.js`, `frontend/src/components/analyze/VoiceDeviceCheckPanel.jsx`, `frontend/src/pages/AnalyzePage.jsx` | Document browser, microphone, and speaker checks. Do not imply Azure provider health is fully proven by the device check. |
| Realtime live STT socket | Implemented transport, needs live provider verification | `backend/src/api/realtimeVoiceSocket.js`, `backend/src/services/voice/realtimeSpeechSessionService.js`, `frontend/src/hooks/voice/useRealtimeSpeechSocket.js` | Mark as product-wired, needs E2E verification. |
| Duplex voice agent | Product-wired, needs E2E verification | `backend/src/api/duplexVoiceSocket.js`, `backend/src/services/voice/duplexVoiceAgentService.js`, `backend/src/services/voice/duplexTurnCoordinator.js`, `frontend/src/hooks/useVoiceInterviewSession.js`, `frontend/src/hooks/voice/useDuplexVoiceSocket.js` | Present as wired for STT, adaptive turn processing, TTS, barge-in, and recording, with dependency on auth, Azure credentials, microphone, and live session state. |
| Voice recording upload | Implemented | `backend/src/controllers/recordingController.js`, `backend/src/services/recording/sessionRecordingService.js`, `frontend/src/hooks/voice/useSessionAudioRecorder.js` | Include upload/status/download routes and conversion to MP3. |
| Latency trace | Implemented as observability | `backend/src/utils/latencyTrace.js`, `backend/src/services/latency/voiceLatencySummaryService.js`, `frontend/src/utils/voiceLatencyTrace.js`, `frontend/src/utils/voiceLatencySummary.js`, `docs/voice-latency-trace-markers.md` | Mark as observability, not a guarantee that latency targets are always met. |
| Scoring and evidence-based feedback | Implemented | `backend/src/services/agents/reportGenerator/`, `backend/src/services/agents/reportQaAgent.js`, `backend/src/services/scoringSchemaService.js`, `frontend/src/components/report/` | Document report generation, evidence strength, coaching sections, and QA. |
| Report generation and QA | Implemented | `backend/src/controllers/reportController.js`, `backend/src/services/agents/reportGeneratorAgent.js`, `backend/src/services/agents/reportQaAgent.js`, `backend/src/db/models/sessionReportModel.js` | Keep as advanced feature. |
| Commercial stress test | Implemented for measured AI usage summaries and report payload | `backend/src/config/aiUsagePricing.js`, `backend/src/db/models/aiUsageEventModel.js`, `backend/src/services/aiUsageTrackingService.js`, `backend/src/controllers/reportController.js`, `frontend/src/components/report/CommercialStressTestSection.jsx` | Update Notion status from proposed to implemented/partial: provider usage is measured where events are recorded; broader business validation remains a report argument. |
| Data model and storage | Implemented with remaining hardening gaps | `backend/src/db/initPostgresSchema.js`, `backend/src/db/models/`, `backend/src/repositories/`, `backend/src/services/fileRepositoryService.js` | PostgreSQL, MongoDB, and local file storage are real. Retention cleanup, encryption-at-rest promises, and account-wide deletion are still gaps. |
| Privacy, security, compliance | Partial | `backend/src/middleware/authMiddleware.js`, `backend/src/middleware/csrfMiddleware.js`, `backend/src/middleware/rateLimitMiddleware.js`, `backend/src/services/auditService.js`, `backend/src/services/privacyRedactionService.js` | Keep privacy wording honest. Do not claim full compliance, biometric processing, or encrypted-at-rest storage unless implemented. |
| Evaluation and testing | Implemented with gaps | `backend/tests/robustness/`, `backend/eval/runners/`, `frontend/src/**/*.test.*`, `frontend/src/**/__tests__/` | Document robustness and eval coverage, but note live voice E2E and wider match calibration gaps. |
| Pronunciation scoring | Future | No production scoring module found | Keep in future work. |
| Multilingual interview mode | Future | No production multilingual interview mode found | Keep in future work. |
| Voice cloning | Future | No production voice cloning module found | Keep in future work due to privacy and ethics risk. |

## Key Corrections To Apply Across Docs

1. RAG runtime retrieval uses PostgreSQL `document_chunks` with `vector(256)`, not `vector(32)`.
2. The deterministic embedding path is a 256-dimensional weighted hash embedding. It is useful for MVP retrieval experiments, but should not be described as a production-grade semantic embedding model.
3. Voice is not merely missing: the product has live STT and duplex voice sockets, frontend hooks, VAD, TTS streaming, barge-in handling, latency traces, and recording upload. The correct status is product-wired and needs live E2E verification.
4. Commercial stress testing is no longer only proposed. `AiUsageEvent` records DeepSeek, Azure Speech, and local stage usage where instrumented, then reports estimated provider cost and human-time comparison.
5. Privacy/security docs should separate implemented controls from product promises. Implemented controls include auth middleware, CSRF, rate limiting, ownership checks in many routes, audit logs, redaction helpers, and deletion-related schema fields. Remaining gaps include route-complete ownership tests, retention workers, account-wide deletion, and encryption-at-rest guarantees.
6. JD file upload should stay backlog/future unless code is added. Current implemented JD path is pasted text plus structured parsing/review.

## Report-Ready Implementation Summary

The current system is best described as a NZ-focused, CV/JD-grounded interview coaching workflow. Its strongest implemented chain is:

```text
Google login
  -> CV upload and parsed CV review
  -> pasted JD parsing and JD review
  -> guarded CV-JD match
  -> session setup and interview plan
  -> text interview or product-wired voice interview
  -> transcript/report generation
  -> report QA
  -> commercial stress test cost summary
```

The safest demo path remains text interview mode. Voice mode is technically wired and should be shown only in an environment with valid Azure Speech credentials, authenticated WebSocket access, browser microphone permission, and a live interview session.
