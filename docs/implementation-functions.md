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

### `buildInterviewMicroPlan`

**Location:** `backend/src/services/questions/interviewMicroPlanningService.js`

**Purpose:** Builds a local turn-level plan for the next interview move.

**Input role:** Candidate answer, session context, available question material, and coverage state.

**Output role:** Guidance for whether to follow up, switch topic, validate a gap, or use a prepared question.

**Used by:** Interview turn orchestration and adaptive question selection.

### `orchestrateInterviewTurn`

**Location:** `backend/src/services/questions/interviewTurnOrchestratorService.js`

**Purpose:** Coordinates the question pipeline at turn level so the interviewer agent does not carry all control logic alone.

**Input role:** Session state, latest answer understanding, evaluator result, prepared question candidates, and decision signals.

**Output role:** A selected next-question direction and metadata.

**Used by:** Interviewer agent and adaptive next-turn path.

**Failure behavior:** Should fall back to safe generated follow-up or topic movement rather than crashing the interview turn.

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

### `starRubricService`

**Location:** `backend/src/services/aiControl/starRubricService.js`

**Purpose:** Supports STAR-style behavioural answer evaluation.

**Input role:** Candidate answer and behavioural question context.

**Output role:** STAR coverage and feedback signals.

**Used by:** Behavioural and combined interview modes.

## Voice functions

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

## Report functions

### `executeReportAction`

**Location:** `backend/src/services/aiControl/reportActionExecutor.js`

**Purpose:** Executes the selected report-generation action using session evidence.

**Input role:** Decision context, retrieval evidence, session analysis, and report requirements.

**Output role:** Generated report plus QA-related result where available.

**Used by:** `runTask({ taskType: 'generate_report' })`.

### `reportGeneratorAgent`

**Location:** `backend/src/services/agents/reportGeneratorAgent.js`

**Purpose:** Generates structured feedback report sections from CV, JD, interview plan, prepared question pool, and transcript evidence.

**Output role:** Report sections, scoring, coaching feedback, and evidence-based content.

### `reportQaAgent`

**Location:** `backend/src/services/agents/reportQaAgent.js`

**Purpose:** Checks whether the generated report is grounded, consistent, and useful.

**Output role:** QA result that can mark the report as ready or needing review.

### `reportQaRepairOrchestratorService`

**Location:** `backend/src/services/report/reportQaRepairOrchestratorService.js`

**Purpose:** Supports repair orchestration when report QA identifies problems.

**Input role:** Generated report, QA findings, and available evidence.

**Output role:** Repair direction or improved report support depending on the execution path.

### `claimGroundingService`

**Location:** `backend/src/services/report/claimGroundingService.js`

**Purpose:** Strengthens report trustworthiness by connecting report claims to available evidence.

### `conversationalAuthenticityService`

**Location:** `backend/src/services/report/conversationalAuthenticityService.js`

**Purpose:** Checks the naturalness and authenticity of interview communication for report feedback.

### `reportScoringExplanationService`

**Location:** `backend/src/services/report/reportScoringExplanationService.js`

**Purpose:** Makes report scoring easier to interpret by explaining score breakdowns.

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

## Testing functions and files

Key test areas include:

- `backend/tests/robustness/questions/`
- `backend/tests/robustness/report/`
- `backend/tests/robustness/voice/`
- `frontend/e2e/specs/question-pipeline.spec.js`
- `frontend/src/**/*.test.*`

These tests help prove that the system has controllable behavior rather than only attractive UI output.
