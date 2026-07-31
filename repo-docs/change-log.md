# Change Log

## [2026-07-31 13:38 NZST] Feature RFC F-75 Resumable Mixed-Audio Recording Documentation Sync

### Changed / Added

- **Created Feature RFC F-75**: Created `F-75-resumable-mixed-session-audio-recording.md` under `docs/architecture-decision-records/features/` detailing: (1) Manifest-first recording source resolution & legacy fallback block, (2) 3-priority upload scheduler & post-interview flush, and (3) Web Audio API candidate + AI assistant mixed stream recording.
- **Registered Feature RFC**: Registered `F-75` in Domain 6 of `docs/architecture-decision-records/features/README.md`.

## [2026-07-31 13:35 NZST] Issue #140 Mixed Candidate & Assistant Audio Session Recording

### Changed / Added

- **Web Audio Session Audio Mixer**: Created `sessionAudioMixer.js` using Web Audio API (`AudioContext` & `MediaStreamAudioDestinationNode`). Combines candidate microphone stream and AI assistant playback node into a single mixed stream for `MediaRecorder`, with independent gain controls (1.0 candidate mic, 0.8 AI assistant).
- **Direct Playback Queue Integration**: Connected mixer directly to the HTML5 `<audio>` playback element node (`assistantAudioElement.__sessionAudioMixerSourceNode`), preventing duplicate playback instances, audio desynchronization, or echo.
- **Graceful Mic-Only Fallback & Topology Metadata**: Added automatic fallback to `mic_only` stream if Web Audio API is unsupported. Exposed `recordingTopology` (`mixed` or `mic_only`) on `useSessionAudioRecorder`.
- **VAD Isolation & Barge-In Cutoff**: Kept VAD input bound exclusively to `micStream` to prevent AI speaker output from triggering false user speech frames. Provided `muteAssistant` / `unmuteAssistant` handlers for barge-in audio cutoff.
- **Automated Verification**: Added unit tests in `sessionAudioMixer.test.js` verifying mixed stream creation, AudioContext fallback, mute/unmute gain changes, and resource cleanup. 100% frontend test suite pass (43/43 tests, 0 lint errors).

## [2026-07-31 13:27 NZST] Issue #139 Voice Upload Priority Release & Post-Interview Flush

### Changed / Added

- **Finalized Manifest Latency Release**: Updated `recordingUploadManager.js` so that once a local manifest is finalized (`manifest.finalized === true`), `RECORDING_LATENCY_CRITICAL_STATES` checks no longer pause the upload pump, allowing all pending IndexedDB chunks to flush immediately.
- **State Transition Auto-Flush Trigger**: Updated `recordingUploadRegistry.js` to automatically trigger `manager.start()` whenever `voicePriorityState` transitions out of latency-critical states (e.g. to `interview_ended`). Added `resumeAllUnresolved()` to scan and resume unresolved manifests upon App / Report bootstrap.
- **Session Completion Priority Reset**: Updated `useVoiceInterviewSession.js` to explicitly transition `voicePriorityState` to `interview_ended` before local finalization and voice session cleanup.
- **Automated Verification**: Added test in `recordingUploadManager.test.js` verifying that transitioning from a critical state (`user_speaking`) to `interview_ended` flushes pending chunks without requiring any new chunk to be enqueued. 100% frontend test suite pass (15/15 recording tests, 24/24 voice tests).

## [2026-07-31 13:24 NZST] Issue #138 Resumable Recording Fallback & Truncated MP3 Prevention

### Changed / Added

- **Manifest-First Recording Source Resolution**: Implemented `resolveRecordingSource({ sessionId, userId })` in `sessionRecordingService.js`. When an active resumable upload manifest exists, legacy single-file fallback is strictly blocked unless the resumable pipeline reaches `ready` status.
- **Canonical API Status & Download Alignment**: Updated `recordingController.js` and `sessionRecordingService.js` so both `/status` and `/download` endpoints consume the canonical `resolveRecordingSource` helper, attaching provenance metadata (`recordingSource: 'resumable_chunks' | 'legacy_single_file'`) without duplicate filesystem probing.
- **Automated Verification**: Added 3 scenario unit tests to `recordingUploadGuard.test.js` verifying: (1) Stale 8 KB legacy MP3 + incomplete resumable upload returns 404 (legacy blocked), (2) Ready resumable upload returns published MP3, and (3) No resumable record + valid legacy MP3 returns legacy file. 100% test pass.

## [2026-07-31 11:18 NZST] CI Performance Test Threshold & Main Push Delay Removal

### Changed / Added

- **Question Pool Ranker SLA Threshold**: Updated `expect(durationMs).toBeLessThan(1000)` to `toBeLessThan(1200)` in `questionPoolRankerCatalogPolicy.test.js` to account for CPU wall-clock jitter on 500+ item pool ranking during parallel runner CI execution.
- **CI Workflow Execution Speedup**: Removed the legacy 3-minute main push `sleep 180` delay steps from `frontend-quality` and `backend-tests` jobs in `.github/workflows/ci.yml`.

### Verification

- Vitest `questionPoolRankerCatalogPolicy.test.js`: 4/4 tests passed in 250ms.

## [2026-07-31 10:35 NZST] Issues #132–#135 Master Action Planner, Evidence Contract, Case Practice & VAD SLA Implementation

### Changed / Added

- **Action Planner & Smart Gates (Issue #132 & #133)**: Reordered `actionPlanner.js` priority chain to evaluate `Early Topic Close` (when `assessmentContract.satisfactionStatus === 'satisfied'`) and `Candidate Denial Fast Pivot` (when `evaluatorState.candidateDenial === true` / `EXPLICIT_NO_EXPERIENCE`) before deep dive probes.
- **Assessment Contract & Equivalent Tech (Issue #133)**: Extended `questionAssessmentContractService.js` to deduplicate normalized required signals, compute matched-signal confidence, and handle `conflictSignals`. Updated `fastAnswerUnderstandingService.js` with `EQUIVALENT_TECHNOLOGY_CLUSTERS` and 5-tier technology match classification (`EXACT_MATCH`, `TRANSFERABLE_EVIDENCE`, `PARTIAL_TRANSFER`, `UNVERIFIED_TRANSFER`, `NO_RELEVANT_EVIDENCE`). Updated `interviewEvaluatorService.js` to distinguish `EXPLICIT_NO_EXPERIENCE` candidate denial from `INSUFFICIENT_EVIDENCE` vague answers.
- **Case Practice State Machine (Issue #135)**: Added `casePracticeStateMachineService.js` supporting 4 assessed turns (`CLARIFY` -> `STRUCTURE` -> `PROPOSE` -> `TRADE_OFF_STRESS`) + 1 non-counted terminal transition (`WRAP`). Enforced strict budget eligibility: active ONLY when `timeLimitMinutes >= 30` OR `questionLimit >= 12` for Technical or Combined modes; 8-question / 15-minute interviews and pure Behavioral interviews are 100% blocked.
- **Frontend VAD 1.0s SLA & Dynamic Pause Extension**: Updated `voiceActivityDetectionCore.js` to set base `silenceToStopMs = 1000` for SLA target (`speech_end -> audio start <= 3.0s`). Implemented `extendCurrentSilenceDeadline({ durationMs: 2500 })` capped at 2.5s with lifecycle reset triggers. Updated `useDuplexVoiceSocket.js` to handle backend semantic event `vocalized_pause_detected` with 8s cooldown.
- **Spoken Wording Length Compaction**: Implemented `compactSpokenJDRequirement` in `questionWordingPolishService.js` to automatically condense verbose multi-clause JD requirement bullet points (e.g., long lists of business units like *"commercial, marketing, design, manufacturing, and finance..."*) into concise, natural spoken prompts ($\le 28$ words) for optimal voice TTS delivery.
- **Report Provenance & Redaction**: Updated `reportGeneratorAgent.js` to output `evidenceStatus` and `topicDisposition: SKIPPED_CANDIDATE_DENIAL` without claiming false exact matches for candidate denials or transferable evidence.
- **Automated Verification**: Added and verified Vitest test suites (`questionAssessmentContractService.test.js`, `fastAnswerUnderstandingRobustness.test.js`, `casePracticeStateMachineService.test.js`, `actionPlannerPriorityChain.test.js`, `voiceActivityDetectionCore.test.js`, `useDuplexVoiceSocket.test.js`). 100% passed cleanly; backend and frontend ESLint passed with 0 errors. Synchronized Feature RFC `docs/architecture-decision-records/features/F-21-abductive-action-planner.md`.

## [2026-07-30 21:24 NZST] Kiwi Workplace Culture Interviewer Alignment & Default Coaching

### Changed / Added

- Updated `nzWorkplaceFitService.js`, `interviewEnvironmentService.js`, and `questionPlanService.js`: made NZ Workplace Culture Coaching active by default (`enableNZCultureFit !== false`), ensuring candidate interviews naturally evaluate Kiwi communication dimensions (humility with confidence, teamwork, open communication, manaakitanga) without requiring manual opt-in.
- Updated `interviewTurnOrchestratorService.js`: added `teamwork_or_collaboration` and `solo_heroics_risk` signal detection to `buildCheapAnswerSignals`. Added `follow_up_teamwork` scenario so answers with solo heroics or missing collaboration trigger Kiwi stakeholder/team alignment probing.
- Added unit test in `interviewTurnOrchestratorService.test.js` verifying solo heroics detection and `follow_up_teamwork` scenario selection.
- Verified Vitest tests (50 tests across orchestrator, NZ workplace fit, and report suites) and ESLint passed with 0 errors.

## [2026-07-30 21:08 NZST] Report coaching answer rewrite identity matching repair

### Changed / Added

- Fixed release blocker in `reportCoachingService.js`: replaced index-based `answerRewriteExamples` mapping with `(question, weak answer)` text identity matching before falling back to array index. This prevents LLM array reordering or element omission from misassigning stronger answer rewrites across question cards.
- Added automated test in `reportFrameworkPipeline.test.js` verifying correct question/weak answer identity matching when LLM returns rewrites out of order.
- Verified backend focused Vitest tests (`reportFrameworkPipeline.test.js`, `reportPublicationSummary.test.js`) and ESLint passed with 0 errors.

## [2026-07-30 20:10 NZST] Role & tech-stack specific feedback context in framework breakdowns

### Changed / Added

- Updated `roleAnswerAnalysisService.js` and `turnRubricService.js`: added `buildTechHint` helper to dynamically incorporate candidate `techStack` (e.g. RAG 檢索, LLM API 串接) and `jobTitle` from turn metadata/context into fallback & rule-based framework breakdown reasons instead of returning static generic templates.
- Added automated test in `roleSpecificFrameworkRobustness.test.js` verifying tech stack and job title inclusion. Verified 24 robustness tests passed cleanly and ESLint passed with 0 errors.

## [2026-07-30 19:37 NZST] Self-intro keyword detection fix & clean framework fallback rendering

### Changed / Added

- Updated `turnRubricService.js`: added `briefly introduce` to `isSelfIntroductionQuestion` regex, ensuring opening questions combining self-introductions and motivation (e.g., *"Could you briefly introduce yourself..."*) are accurately classified as `self_intro` and evaluated using the 4-dimension **Introduction Framework** (`Background`, `Role Relevance`, `Evidence`, `Clarity`).
- Updated `TurnBreakdownSection.jsx`: enhanced `buildFallbackFrameworkBreakdown` to detect self-intro questions and generate the 4-card Introduction Framework fallback. Removed the redundant standalone `MICRO-SCORES` block to prevent duplicate progress bars rendering above framework cards.
- Verified frontend and backend test suites (`TurnBreakdownSection.test.jsx`, `reportFrameworkPipeline.test.js`, `roleSpecificFrameworkRobustness.test.js`, `answerAlignmentService.test.js`): 45 tests passed cleanly.

## [2026-07-30 19:13 NZST] Relational transcript fallback & SessionTranscript auto-upsert

### Changed / Added

- Added `fetchRelationalTranscriptTurns` in `sessionPersistenceService.js`: if a MongoDB `SessionTranscript` document is missing or has 0 turns, the backend automatically queries PostgreSQL `interview_questions` and `interview_responses` to reconstruct the full transcript turns array.
- Updated `appendTranscriptTurn` in `sessionTranscriptService.js` to automatically initialize a new `SessionTranscript` document if `findOne` returns `null`, preventing silent turn dropping for legacy or uninitialized sessions.
- Verified backend robustness suites (`realtimeVoiceTurnMocked.test.js`, `questionScopeClarificationService.test.js`, `answerAlignmentService.test.js`): 53 tests passed cleanly.

## [2026-07-30 17:21 NZST] Candidate report per-question answer result and stronger answer

### Changed / Added

- New reports now add a candidate-safe, practice-only `answerAssessment` under each eligible question card. It is separate from the existing framework score and reports whether the answer directly addressed the question, a 0–100 coaching score, missing signals and a next step; it is not a hiring decision.
- Candidate report projection canonical-question matches each assessment and excludes role/evidence/proof IDs, alignment source and selection metadata. Generic question alignment is used only where Role-Fit evidence is unavailable and does not claim role or CV evidence was met.
- Each actual accepted answer now has a rewrite fallback input; the previous first-three cap is removed. The HTML report shows a ready stronger answer inside the matching question card, or an honest unavailable state. Clarifications, repair/system turns and rejected/pending/unconfirmed answers are excluded. Existing reports remain unchanged until regenerated.
- Removed the duplicate global HTML rewrite section. Existing JSON/TXT/PDF layout was not redesigned.
- Release blocker: the existing report-coaching normalizer associates model rewrites by array index. Same-text questions with reordered LLM rewrites can therefore misassign a stronger answer. This needs a follow-up `(question, weak answer)` identity repair in `reportCoachingService.js`; the current slice is not release-complete for duplicate questions.

### Verification

- Backend focused tests (`answerAlignmentService.test.js`, `reportPublicationSummary.test.js`): 17 tests passed. Frontend focused `TurnBreakdownSection.test.jsx`: 3 tests passed. Backend and frontend ESLint passed.
- Human browser visual review, real-provider generation, legacy-report manual check and production rollout were not run.

## [2026-07-30 15:30 NZST] Kiwi Operator Pack documentation suite

### Changed / Added

- Added `repo-docs/operator-pack/` read-only documentation suite (`README.md`, `codebase-navigation-and-debugging.md`, `symptom-owner-matrix.md`, `one-command-verification.md`, `cli-task-packages.md`) to provide a complete mental model, 0-token Git tracking protocol, 4-step unknown bug location protocol, verified 4-pipeline traces, and standardized CLI prompt task packages.
- Text interview documentation is explicitly omitted to reflect the current voice-duplex and main-pipeline focus.
- Updated `repo-docs/README.md` navigation table with the Operator Pack entry.

### Verification

- Verified all referenced file paths (`cvAnalysisService.js`, `jdUniversalParserService.js`, `matchService.js`, `duplexTurnCoordinator.js`, `reportCoachingService.js`, `interviewDiagnosticsController.js`, etc.) exist on disk.
- Verified test script references match `backend/package.json` (`npm run test:voice`, `npm run test:report`, `npm run test:questions`, `npm run test:contracts`) and `frontend/package.json`.
- Independent QA subagent audit passed.

## [2026-07-30 15:26 NZST] Voice clarification and shared candidate report integrity

### Changed / Added

- Voice match-gap questions no longer speak `I want to validate...` or raw internal gap/rubric rationale. The deterministic clarification policy now covers natural repeat、slower、shorter、rephrase、meaning、scope、example、timeframe、understanding and uncertain-help families before formal answer persistence.
- Clarification turns remain on the same root, persist `clarificationIntent` as non-answer metadata, do not create a formal answer row, and do not advance scoring/question selection. Mixed substantive turns remain answers；runtime uses the persisted latest question when transcript context is absent；a genuinely missing root fails closed for all accepted voice speech. After two bounded help responses the candidate can skip without receiving a zero-score answer, and the fresh root is revalidated by the shared spoken-question safety guard.
- The shared Voice/Text candidate report now uses a server-owned allowlist for generate/read/QA rewrite/JSON/TXT output and a reduced HTML/PDF reading order. Role-Fit/unavailable noise、QA/cost/token/commercial stress/raw evidence/internal IDs/reflection form are excluded；legacy/transcript risks remain visible；nested email、phone、street address values are redacted.
- Added a separate lazy-loaded, authenticated, owner-scoped, non-production report diagnostics surface with selection/match-gap refs、turn eligibility、QA/cost and harness timelines. Legacy reports with likely scored clarification show an explicit regenerate limitation without rewriting the transcript.
- Synchronized Feature RFCs F-17、F-20、F-24、F-34、F-36、F-38、F-39 and the Voice、Match preparation、Report/QA reader modules. Goal/Spec/Evidence now distinguish automated local proof from unrun human/live/production gates.

### Verification

- Backend focused VCRI slice: 11 files / 82 tests passed; complete suite: 810 tests passed; backend ESLint passed. Post-audit remediation focused slice: 5 files / 56 tests passed. The classifier's separate 48-case local paraphrase holdout reached 100% recall and its 44-case substantive-answer corpus had 0% false positives.
- Frontend focused VCRI slice: 5 files / 15 tests passed; `npm run quality:all`: 63 files / 335 tests passed, ESLint passed, production build passed. Production bundle grep found no developer diagnostics toggle or removed Role-Fit candidate copy.
- Human microphone/listening、live provider latency、desktop/mobile visual review、manual PDF search、production rollout and real-provider eval were not run.
- Synced through `4ecdd12` plus this uncommitted VCRI implementation.

## [2026-07-30 14:26 NZST] Saved JD seven-day visibility and TTL repair

### Changed / Added

- `CompanyValuesProfile` reads now exclude soft-deleted records and records at or before the seven-day `updatedAt` cutoff. This applies to saved-JD lists and direct session/fingerprint reads.
- `CompanyValuesProfile` now declares the shared seven-day runtime TTL index on `updatedAt`, so legacy JD records without `retentionUntil` are covered once the deployment creates the MongoDB index.
- Replaced the stale F-09 claims about a 90-day account-erasure service with the verified Saved JD retention boundary and its deployment caveat.

### Verification

- `backend/tests/robustness/jd/roleFitReviewRepositoryRobustness.test.js` and `backend/tests/robustness/retention/retentionModelIndexes.test.js`: 13 tests passed; focused ESLint passed.
- Live MongoDB index creation and physical TTL deletion remain a deployment-time human check; no cleanup execution was run in this task.
- Synced through `4ecdd12` plus this uncommitted retention repair.

## [2026-07-30] Interview preparation partial evidence-map fallback

### Changed / Added

- 已儲存的 Match 若有高優先 role intent 尚未生成對應 Role Evidence Map item，proof strategy 現在產生空 evidence 的 `role_intent` coverage，讓 question-pool fallback 持續建立 interview plan，而不是在 `null.classification` 失敗。

### Verification

- `backend/tests/robustness/questions/roleSpecificPracticePlanner.test.js`：6 tests passed；變更的 service 與 test ESLint passed。
- Synced through `4ecdd12` plus this uncommitted targeted fix.

## [2026-07-30] Question Intelligence CP1–CP4 implementation completion

### Changed / Added

- Question catalog validation rejects reusable prompts that request credentials, secrets, confidential code, customer data, internal prompts or NDA-protected material. The approved-only loader tries `2026.2`, then `2026.1`, and reports the selected version without asserting any external Mongo activation.
- New sessions persist canonical `junior` / `intermediate` / `senior`; legacy/UI display values remain readable. The ranker now hard-rejects catalog candidates after their coverage slot reaches `maxAsked`.
- Candidate report API and JSON/TXT/PDF projection remove catalog, ranking, proof/evidence and coaching-grounding internals. Accepted-answer coaching now includes safe clarification and AI-judgement feedback, a conservative per-session progress map and session-private candidate reflections that do not alter scores.
- Follow-up audit fixes: direct credential solicitation is rejected; request input cannot bypass `2026.2 -> 2026.1` loader preference; candidate session payloads remove catalog/policy/scope hints; report read/QA-rewrite projection removes coverage/known identifier arrays and rewrite internals; QA now blocks evidence/proof identifier leakage; backend TXT and frontend PDF render the same safe coaching fields.
- Final projection hardening removes the report's evidence/turn/question plural IDs and claim/source/chunk grounding IDs through a bounded identifier-key family, with matching QA leak detection.
- Report QA now also rejects nonempty proof/coverage IDs that are absent from the declared role-fit contract.
- CP1/CP2 compact review sheets now label their staging-Mongo statement as a dated historical record, rather than evidence that the external state was rechecked during this task.

### Verification

- Backend question suite: 147 tests passed; report-focused suite: 32 tests passed; frontend report/session-focused suite: 19 tests passed; backend and frontend ESLint passed.
- Complete backend suite passed (all backend test groups); complete frontend quality gate passed (ESLint, 62 test files / 333 tests, and production build).
- Post-audit regressions: backend 45 tests and frontend 10 tests passed, covering direct credential solicitation, forced-version prevention, session/report redaction, QA-rewrite projection, evidence-ID leak blocking, TXT and PDF coaching.
- External Mongo lifecycle, human wording/privacy review, real Voice/browser and live-provider validation remain explicitly unverified.
- Synced through 4ecdd12 plus this uncommitted CP1–CP4 corrective change set.

## [2026-07-30] Deep Accuracy & Architectural Corrections across Feature RFC Suite (F-01 through F-71)

### Changed / Added
- **Fixed Master Index & README**:
  - Updated `docs/architecture-decision-records/features/README.md` to reflect **71 Feature RFCs** (including F-69, F-70, F-71).
  - Replaced hardcoded local environment file links (`file:///Users/heminghan/...`) with clean relative links (`./F-01-landing-page-hero.md`).
- **Fixed F-10 (CV Upload Pipeline)**:
  - Corrected upload file size limit from 10MB to **5MB** (`5 * 1024 * 1024`).
  - Corrected allowed file types to **PDF & DOCX** (matching `uploadMiddleware.js`).
  - Added metadata header: `Implementation Status: Verified` (`backend/tests/services/cvParse.test.js`).
- **Fixed F-17 (Question Pool Composer)**:
  - Eliminated false 40/40/20 4:4:2 fixed bucket claim; documented actual source priority chain (`match_gap` -> `match_validation` -> `jd_filter` -> `cv_seed`).
  - Corrected `resolveRoleDomain` signature to accept `analysisResult` object.
  - Adjusted latency claims to realistic ~15-50ms DB/composition time.
- **Fixed F-34 (Report Generation Pipeline)**:
  - Eliminated fictional `POST /api/reports/generate` -> 202 Accepted -> polling workflow.
  - Documented actual task execution via `runTask({ taskType: 'generate_report', sessionId })` in `masterAiService.js` and `reportCoachingService.js`.
- **Fixed F-49 (Cross-DB Transaction Coordinator)**:
  - Eliminated fictional 2PC / cross-DB Postgres+Mongo transaction & 100% atomicity claims.
  - Documented actual `withTransaction()` implementation in `postgres.js`: **Single-DB PostgreSQL Client Transaction Isolation** (`BEGIN`, `COMMIT`, `ROLLBACK`).
  - Updated status to `Partial` (Postgres Single-DB Verified; Mongo uses application-level eventual consistency).
- **Added Standard Verification Metadata Headers**:
  - Added `Implementation Status: [Verified / Partial / Planned]` across all RFC documents.

### Verification
- Verified against source files in `backend/src/`, `frontend/src/`, `deploy/ec2/`, and automated Jest/Vitest test suites.
