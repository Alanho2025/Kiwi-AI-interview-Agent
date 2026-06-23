# Implementation Function Map

This document explains the key services and functions that define the current Kiwi AI Interview Agent implementation. It does not document every helper function. It focuses on workflow-defining functions that markers, maintainers, and future developers need to understand.

## How to read this document

Each entry describes:

- purpose
- input and output role
- where it is used
- failure or fallback behavior

## CV and upload functions

### `uploadCV`

**Location:** `backend/src/controllers/uploadController.js`

**Purpose:** Handles CV upload, text extraction, profile creation, file storage, and initial question seed generation.

**Input role:** Uploaded PDF or DOCX file.

**Output role:** Uploaded file record, parsed document content, CV profile, display profile, and metadata returned to the frontend.

**Used by:** Analyze page CV upload flow.

**Failure behavior:** Rejects missing or unreadable files. CV question seed generation is supportive and should not be treated as the only gate for upload success.

### `saveReviewedCvProfile` / CV review services

**Location:** `backend/src/services/cv/`

**Purpose:** Saves the human-reviewed CV profile after the user confirms or edits match-relevant CV fields.

**Input role:** Reviewed CV profile payload from the frontend.

**Output role:** Updated CV profile and refreshed question seed basis.

**Used by:** CV review step before JD input and match.

**Failure behavior:** If the reviewed profile cannot be saved, the flow should not proceed to verified CV state.

## JD functions

### `buildGuardedStructuredJobDescriptionRubric`

**Location:** `backend/src/services/jobDescription/guardedJobDescriptionService.js`

**Purpose:** Converts raw pasted JD text into a structured rubric with safeguard support.

**Input role:** Raw JD text.

**Output role:** Structured JD rubric, formatted structured JD text, confidence or safeguard metadata.

**Used by:** `POST /api/job-description/paraphrase`.

**Failure behavior:** Should report parse failure or lower confidence rather than silently treating a weak JD parse as verified.

### JD review metadata stamping

**Location:** frontend JD review utilities and Analyze page state.

**Purpose:** Marks the structured JD as edited or verified by the user.

**Input role:** Structured JD rubric and user edits.

**Output role:** Human-reviewed JD rubric passed to match and interview plan generation.

**Used by:** Analyze page JD review gate.

**Failure behavior:** If raw JD changes, previous JD summary and review status should be cleared to avoid stale matching.

## CV-JD match functions

### `runCvJdMatchAnalysis`

**Location:** `backend/src/services/match/`

**Purpose:** Compares reviewed CV evidence against reviewed JD requirements.

**Input role:** CV ID, user ID, raw JD, JD rubric, and interview settings.

**Output role:** Match analysis including strengths, gaps, fit signals, evidence references, and role alignment.

**Used by:** `POST /api/analyze/match`.

**Failure behavior:** Match should fail if the required CV/JD inputs are missing or not owned by the user.

### `createMatchAnalysisRecord`

**Location:** `backend/src/services/cv/matchAnalysisRecordService.js`

**Purpose:** Persists match results so the interview plan can use a stable match analysis ID instead of relying only on frontend state.

**Input role:** Match analysis and ownership metadata.

**Output role:** Persisted match analysis record.

**Used by:** Match controller and interview plan generation.

### `buildJdQuestionFilter`

**Location:** `backend/src/services/questions/jdQuestionFilterService.js`

**Purpose:** Converts JD requirements and match analysis into question selection signals.

**Input role:** Raw JD, JD rubric, match analysis, CV file ID, user ID, and settings.

**Output role:** JD question filter with role priorities and gap-validation signals.

**Used by:** CV-JD match workflow and prepared question pool composition.

**Failure behavior:** Failure may be logged as a warning and the system may continue. This should be visible in diagnostics because it can reduce question specificity.

## Question pipeline functions

### `generateCvQuestionSeeds`

**Location:** `backend/src/services/questions/cvQuestionSeedService.js`

**Purpose:** Creates candidate-specific question seeds from CV profile evidence.

**Input role:** CV profile, normalized text, user ID, CV file ID, and settings.

**Output role:** CV question seed records.

**Used by:** CV upload, CV review, and interview plan generation.

**Failure behavior:** Seed failure does not necessarily block the whole interview. The system may fall back to more generic question sources.

### `ensureCvQuestionSeedsForPlan`

**Location:** Question planning services.

**Purpose:** Ensures the interview plan has access to CV seeds. If seeds do not exist, it attempts to rebuild them from stored CV evidence.

**Input role:** User ID, CV ID, and settings.

**Output role:** Existing or regenerated CV seeds.

**Used by:** Interview plan generation.

### `composeInterviewQuestionPool`

**Location:** `backend/src/services/questions/questionPoolComposerService.js`

**Purpose:** Builds the prepared question pool for an interview session.

**Input role:** CV seeds, JD question filter, match analysis, JD rubric, session ID, CV file ID, and interview settings.

**Output role:** Prepared question pool items with ranking and metadata.

**Used by:** `POST /api/analyze/interview-plan` and adaptive retrieval.

**Failure behavior:** Pool composition failure can degrade the interview into fallback question generation. It should be tracked through diagnostics.

### `runBoundedQuestionMicroPlanning`

**Location:** `backend/src/services/questions/interviewMicroPlanningService.js`

**Purpose:** Naturalizes an already bounded question plan into one TTS-ready question and falls back to the selected base question when model output fails validation.

**Input role:** Bounded planning frame, fallback question, and interview focus area.

**Output role:** One validated spoken question plus compact planning metadata.

**Used by:** Interview turn orchestration and adaptive question selection.

### `buildInterviewTurnPlan`

**Location:** `backend/src/services/questions/interviewTurnOrchestratorService.js`

**Purpose:** Coordinates the question pipeline at turn level so the interviewer agent does not carry all control logic alone.

**Input role:** Session state, latest answer understanding, evaluator result, prepared question candidates, and decision signals.

**Output role:** A selected next-question direction and metadata.

**Used by:** Interviewer agent and adaptive next-turn path.

**Failure behavior:** Should fall back to safe generated follow-up or topic movement rather than crashing the interview turn.

### `buildQuestionFingerprint` / `buildAssessmentKey` / `evaluateQuestionNovelty`

**Location:** `backend/src/services/questions/questionDeduplicationService.js`

**Purpose:** Prevents exact and assessment-equivalent root-question repetition while preserving distinct follow-up intents.

**Input role:** Candidate question metadata, normalized spoken text, and transcript-derived history.

**Output role:** Fingerprint, assessment key, similarity result, matched prior question, and allow/reject decision.

**Used by:** Prepared-pool composition, ranking, reconciliation, and the final interviewer-agent spoken-question guard.

**Failure behavior:** If the selected base question and all alternatives are duplicates, the interview closes with `no_unique_question_remaining`.

### `buildInterviewQuestionDiagnostics`

**Location:** `backend/src/services/questions/interviewQuestionDiagnosticsService.js`

**Purpose:** Produces debug information about question preparation, selected questions, pool usage, and fallback paths.

**Input role:** Session ID and stored question artifacts.

**Output role:** Diagnostics payload for maintainers or debug UI.

**Used by:** Interview diagnostics controller and debug routes.

### `polishQuestionWording`

**Location:** `backend/src/services/questions/questionWordingPolishService.js`

**Purpose:** Improves the final wording of interview questions while preserving the selected intent.

**Input role:** Draft question and context.

**Output role:** Cleaner spoken or displayed question.

**Failure behavior:** If polishing is unavailable, the base selected question should still be usable.

## Adaptive interview control functions

### `runTask`

**Location:** `backend/src/services/masterAiService.js`

**Purpose:** Main AI task entry point for interview next-turn, report generation, and report QA tasks.

**Input role:** Task type, session ID, and task payload.

**Output role:** Task-specific result such as next question, report, or QA result.

**Used by:** Text interview controller, voice turn processing, report controller, and completion workflows.

### `evaluateInterviewTurn`

**Location:** `backend/src/services/aiControl/interviewEvaluatorService.js`

**Purpose:** Evaluates the candidate's latest answer and decides whether the answer is specific, evidence-rich, incomplete, or ready for topic transition.

**Input role:** Interview environment and latest answer context.

**Output role:** Evaluation record used by decision context and planner.

**Failure behavior:** If evaluation is too strict, the interview may over-follow-up. If too loose, it may skip useful depth.

### `analyzeStarrBreakdown`

**Location:** `backend/src/services/aiControl/starRubricService.js`

**Purpose:** Supports deterministic STARR-style behavioural answer evaluation.

**Input role:** Candidate answer and behavioural question context.

**Output role:** Situation, task, action, result/reaction, reflection, score, and main-missing-element signals.

**Used by:** Behavioural and combined interview modes.

## Voice functions

### `createRoutedRealtimeSpeechSession`

**Location:** `backend/src/services/voice/realtimeSpeechProviderRouter.js`

**Purpose:** Starts realtime STT using the configured provider order.

**Output role:** Azure or ElevenLabs realtime session plus provider-selection metadata.

**Failure behavior:** Can fall back while the speech session starts; it does not switch an active turn mid-recording.

### `synthesizeSpeech` provider router

**Location:** `backend/src/services/voice/ttsProviderRouter.js`

**Purpose:** Selects TTS independently from STT and tries the configured Azure/ElevenLabs provider order.

### Duplex voice socket server

**Location:** `backend/src/api/duplexVoiceSocket.js`

**Purpose:** Provides the product-level WebSocket route for voice interview sessions.

**Input role:** Authenticated WebSocket connection for an active session.

**Output role:** Session-ready, listening, transcript, assistant text, assistant audio, and turn completion events.

**Used by:** Frontend voice hooks and voice interview page.

### Duplex turn coordinator

**Location:** `backend/src/services/voice/duplexTurnCoordinator.js`

**Purpose:** Coordinates speech start, audio chunks, speech end, STT transcript finalization, transcript confidence gating, adaptive turn processing, and TTS response streaming.

**Failure behavior:** Can reject low-confidence transcript, request confirmation, or ask the user to repeat instead of scoring poor transcript input.

### Voice latency trace utilities

**Location:** `backend/src/utils/latencyTrace.js`, `backend/src/services/latency/`, `frontend/src/utils/voiceLatencyTrace.js`

**Purpose:** Records and summarizes timing events for STT, adaptive processing, first generated sentence, TTS, and audio playback.

**Used by:** Voice debugging and performance analysis.

## Recording functions

### `createRecordingUploadService`

**Location:** `backend/src/services/recording/recordingUploadService.js`

**Purpose:** Owns resumable recording initialization, idempotent chunk validation/storage, finalization, retry, status, and session ownership checks.

**Used by:** The resumable recording routes under `/api/recordings/session-audio/uploads`.

### Recording conversion worker

**Location:** `backend/src/services/recording/recordingConversionWorker.js`

**Purpose:** Claims finalized recording jobs, assembles ordered chunks, converts audio to MP3, and records retry or ready state without blocking report navigation.

### Recording upload manager

**Location:** `frontend/src/runtime/recording/recordingUploadManager.js`

**Purpose:** Persists browser chunks through the IndexedDB store, uploads one chunk at a time, resumes interrupted work, finalizes the manifest, and exposes status to interview/report UI.

## Report functions

### `executeReportAction`

**Location:** `backend/src/services/aiControl/reportActionExecutor.js`

**Purpose:** Executes the selected report-generation action using session evidence.

**Input role:** Decision context, retrieval evidence, session analysis, and report requirements.

**Output role:** Generated report plus QA-related result where available.

**Used by:** `runTask({ taskType: 'generate_report' })`.

### `runReportGeneratorAgent`

**Location:** `backend/src/services/agents/reportGeneratorAgent.js`

**Purpose:** Generates structured feedback report sections from CV, JD, interview plan, prepared question pool, and transcript evidence.

**Output role:** Report sections, deterministic score set, question-specific turn breakdowns, coaching feedback, evidence references, transcript risks, and evidence-based content.

### `buildReportTurnDataset`

**Location:** `backend/src/services/report/reportTurnDatasetService.js`

**Purpose:** Creates the canonical report input by pairing countable interview questions with accepted user answers.

**Failure behavior:** Repair, transcript-confirmation, clarification, repeat, acknowledgement, system, and orphan answer turns are excluded from report scoring.

### `resolveFollowUpAssessmentContract`

**Location:** `backend/src/services/questions/questionAssessmentContractService.js`

**Purpose:** Selects the assessment family, evidence mode, and targeted dimensions from the actual question intent so targeted follow-ups do not inherit an inappropriate parent rubric.

### `buildReportScores`

**Location:** `backend/src/services/report/reportScoreService.js`

**Purpose:** Owns deterministic report score construction before candidate-facing wording is generated.

### `runReportQaAgent`

**Location:** `backend/src/services/agents/reportQaAgent.js`

**Purpose:** Checks whether the generated report is grounded, internally consistent, correctly rubric-routed, readable, and useful. It also checks evidence-row quality and transcript-risk visibility.

**Output role:** QA result that can mark the report as ready or needing review.

### `reportQaRepairOrchestratorService`

**Location:** `backend/src/services/report/reportQaRepairOrchestratorService.js`

**Purpose:** Runs at most two targeted wording-repair attempts when report QA identifies eligible problems, then re-grounds claims and reruns QA.

**Input role:** Generated report, QA findings, and available evidence.

**Output role:** Final report, final QA result, and repair history. Deterministic recompute flags skip wording repair.

### `groundCandidateFeedbackClaims`

**Location:** `backend/src/services/report/claimGroundingService.js`

**Purpose:** Strengthens report trustworthiness by connecting report claims to available evidence.

### `evaluateAuthenticity`

**Location:** `backend/src/services/report/conversationalAuthenticityService.js`

**Purpose:** Checks the naturalness and authenticity of interview communication for report feedback.

### `buildScoreExplanations`

**Location:** `backend/src/services/report/reportScoringExplanationService.js`

**Purpose:** Makes report scoring easier to interpret by explaining score breakdowns.

### `detectReportTranscriptRisks`

**Location:** `backend/src/services/report/reportTranscriptRiskService.js`

**Purpose:** Detects transcript entity and conflicting-number risks without rewriting the raw transcript, so uncertainty can be shown near report evidence and scores.

### `buildCandidateEvidenceReferences`

**Location:** `backend/src/services/report/reportEvidenceReferenceService.js`

**Purpose:** Builds deduplicated candidate-facing claim, source, snippet, and confidence rows.

## Frontend report components

### `EvidenceBadge`

**Location:** `frontend/src/components/report/EvidenceBadge.jsx`

**Purpose:** Shows whether feedback is supported by evidence.

### `ScoreBreakdownCard`

**Location:** `frontend/src/components/report/ScoreBreakdownCard.jsx`

**Purpose:** Shows report scoring details in a more transparent format.

### `CommunicationAuthenticitySection`

**Location:** `frontend/src/components/report/CommunicationAuthenticitySection.jsx`

**Purpose:** Displays feedback about communication quality and authenticity.

### `EvidenceSourcesSection`

**Location:** `frontend/src/components/report/EvidenceSourcesSection.jsx`

**Purpose:** Displays claim-level source, evidence snippet, and confidence information.

### `TranscriptRiskSection`

**Location:** `frontend/src/components/report/TranscriptRiskSection.jsx`

**Purpose:** Displays report-relevant ASR or transcript conflicts without silently changing raw transcript meaning.

### `RecordingStatusCard`

**Location:** `frontend/src/components/report/RecordingStatusCard.jsx`

**Purpose:** Keeps upload/conversion progress, retry, ready, and download state separate from report readiness.

## Testing functions and files

Key test areas include:

- `backend/tests/robustness/questions/`
- `backend/tests/robustness/report/`
- `backend/tests/robustness/voice/`
- `frontend/e2e/specs/question-pipeline.spec.js`
- `frontend/src/**/*.test.*`

These tests help prove that the system has controllable behavior rather than only attractive UI output.
