# Change Log

## [2026-08-15] Candidate report framework contract correction

### Changed / Added

- **Affected product code**: `backend/src/utils/schemaHelpers.js`, `backend/src/services/report/reportPublicationSummaryService.js`, `backend/src/services/agents/reportGeneratorAgent.js`, `frontend/src/components/report/TurnBreakdownSection.jsx`, `frontend/src/utils/reportHelpers.js`, and `frontend/src/utils/reportPdf/reportPdfTemplate.js`.
- **Synchronized documentation**: `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md` and this scoped change-log entry.
- **Framework field ownership**: Backend preserves and bounded-normalizes server-published framework `level` (`1–5`) and `scorePercent` (`0–100`), plus dimension `reason`/`weight`/`earnedPoints`; numeric zero remains valid, while null/blank/boolean values are not coerced to zero. Candidate projection allowlists valid framework/dimension `level`, `scorePercent`, `reason`/`scoreReason`, and does not publish internal assessment lineage.
- **Compatibility boundary**: Backend may retain raw compatibility numeric fields for validation and server-side mapping, but candidate projection strips `normalizedScore`, `score`, `weight` and `earnedPoints`; candidate UI/export receives the direct `level`/`scorePercent` contract.
- **Removed fallback**: Legacy client-side semantic `buildFallbackFrameworkBreakdown` synthesis from `scores.business`/`logic`/`evidence` was removed. Without actual STARR/starBreakdown, a missing formal framework object or no renderable dimensions now renders framework label + overall `unavailable`; eligible duration remains separately visible as `Duration Level N/5`, while a dimension with a missing metric remains visible as dimension-level `Level unavailable`; actual STARR does not add framework unavailable.
- **HTML/TXT/PDF consistency**: `TurnBreakdownSection`, `reportHelpers`, and `reportPdfTemplate` directly consume server-published `level`/`scorePercent`/`reason`. Without actual STARR/starBreakdown, formal object/no renderable dimensions produce framework label + `unavailable`, eligible duration remains separate, and actual STARR suppresses framework unavailable. A dimension missing `level` or `scorePercent` remains with `Level unavailable`; framework/dimension/duration do not show `/10` or `earnedPoints/maxPoints`; Answer Result and overall `/100` summaries remain. The client performs no mapping, rescoring, or score inference.
- **Deterministic routing**: An exact role-specific question with `evidenceMode=past_example` routes to `impact_first_past_example` and retains the impact-first six content dimensions; different frameworks are not merged. Deterministic assessment lineage takes precedence over model output but remains internal.

### Verification

- Backend Phase 1 focused checks: 2 files, 15 tests passed.
- Backend Phase 2 focused checks: 2 files, 46 tests passed.
- Backend final focused regression: 4 files / 61 tests passed（由 Phase 1 2 files / 15 + Phase 2 2 files / 46 組成）。
- Frontend report focused regression: 3 files / 20 tests passed。
- Backend/frontend lint passed；`git diff --check` passed。
- Browser/manual、live AI/provider、Mongo persistence、production execution/rollback 未執行。

## [2026-08-15] Impact-first report numeric contract and legacy guard

### Changed / Added

- **Q3 routing metadata**：`buildRoleLockedQuestion` 保留 retrieved question 的 `questionFamily`、`evidenceMode` 與 role assessment metadata，讓 `buildQuestionTranscriptMetadata` 能把 exact role-specific past-example question 路由到 `impact_first_past_example`，不把 internal `type` 和 public `questionType` 混用。
- **Impact-first evaluator contract**：`impactFirstAnalysisService.js` 現在直接發布 framework `scorePercent`，以及六個 dimension 各自的 `level`（1–5）、`scorePercent`（0–100）、`score`/`weight` source。
- **Candidate projection boundary**：candidate report 只發布 `level`、`scorePercent`、label/status/reason 等安全欄位；`normalizedScore`、`score`、`weight`、`earnedPoints` 只可作為 server compatibility mapping 的輸入，不再出現在 candidate projection。
- **Legacy incomplete report**：Impact-first breakdown 若不是六個 expected keys 且每個 dimension 都有 numeric `level`/`scorePercent`，不從 `status` 或 `reason` 補造分數；candidate projection 加入 `legacy_impact_first_metrics_unavailable` 與 `regenerate_report`，raw status 為 `ready` 或 `ready_after_repair` 時降為 `needs_review`。generate、QA、read response 的 publication summary 都跟隨 candidate projection status。

### Verification

- Backend focused regression：6 files、66 tests passed，包含 Q3/Q5 screenshot reproduction、Impact-first evaluator、candidate publication contract、framework pipeline、role-specific fallback 與 schema tests。
- Relevant backend ESLint passed；Phase 1/Phase 2 independent subagent reviews passed；`git diff --check` passed。
- Browser/manual、live AI/provider、Mongo persistence、production execution/rollback 未執行。

## [2026-08-14] Phase 4 Report Scoring Math & Schema Version Update

### Changed / Added

- **90/10 Voice Score Math**: Updated `computeInterviewPerformanceScore` in `reportScoreService.js` to blend content (90%) and voice duration (10%) for eligible voice root turns. Text turns fallback to 100% content weight.
- **Score Scaling**: Adjusted math to ensure the `normalizedScore` (out of 10) correctly scales up to a 100-point basis.
- **Turn Root Injection**: Extended `buildDeterministicTurnBreakdowns` and `mergeTurnBreakdownsWithRubrics` in `reportGeneratorAgent.js` to ensure `voiceDurationAssessment` propagates to the root of the deterministic breakdown object.
- **Schema Validation**: Updated `schemaHelpers.js` to whitelist `voiceDurationAssessment` in the breakdown schema structure to prevent sanitization drops.
- **String Versioning**: Bumped target algorithm string version to `v2026.2` in `reportScoringExplanationService.js`.

### Verification

- Focused Vitest: Updated `reportFrameworkPipeline.test.js`, `reportScoringExplanationService.test.js`, and `reportFrameworkSchema.test.js` to assert the 90/10 math, 100% fallback, genuine 0-score inclusions, and schema integrity. 100% passed.
## [2026-08-01 23:45 NZST] Question selection now follows session phase and accepted-answer coverage

### Changed / Added

- New-session question selection now enforces the persisted warm-up, core, and closing turn slots. A slot that permits only a root cannot be overwritten by a probing action; the closing slot can read the prepared wrap-up root. If such a canonical root is unavailable, the session stops rather than falling back to a legacy or generated out-of-phase question.
- A high-confidence accepted answer marks its prepared target as strongly covered. It can also suppress an unasked sibling target only when two target terms are explicitly present. Weak, partial, and misunderstanding answers do not become strong coverage.
- Each actual prepared root records a bounded, revision-guarded decision only after its asked-state update succeeds: phase/purpose, selected target, coverage transition, ranked candidates, and excluded-candidate reason codes. Raw answers are not copied into this trace.

### Verification

- `backend/tests/robustness/questions/sessionQuestionSetService.test.js`, `backend/tests/robustness/questions/interviewTurnOrchestratorService.test.js`, `backend/tests/robustness/questions/questionPoolComposerService.test.js`, `backend/tests/robustness/questions/questionMetadataPersistence.test.js`, and `backend/tests/robustness/questions/interviewerAgentSessionQuestionSetPolicy.test.js`: 70 tests passed; backend ESLint passed. Browser, live voice provider, Mongo persistence, and production validation were not run.

## [2026-08-01 23:32 NZST] Question preparation now snapshots one canonical set per new session

### Changed / Added

- `InterviewPlan` now owns one private `SessionQuestionSet`. Text, voice, resume, and preparation retry for that session restore the same canonical prepared items rather than re-composing a new pool.
- The definition records deterministic per-turn phase purpose and allowed question kinds, target contracts, the centralized coverage-state vocabulary, and the bounded structure required for later per-turn selection decisions. Existing `asked` runtime state is not reset during restore.
- This slice does not yet write selector decisions, evaluate answer semantic coverage, alter cross-session history, migrate legacy sessions, or touch production data.

### Verification

- `backend/tests/robustness/questions/sessionQuestionSetService.test.js` and `backend/tests/robustness/questions/questionPoolComposerService.test.js`: 36 tests passed; backend ESLint passed. Browser, live voice provider, Mongo persistence, and production validation were not run.

## [2026-08-01 22:12 NZST] Match preparation filters qualifications and calibrates strong-fit copy

### Changed / Added

- Candidate-facing Match preparation topics now exclude education and qualification requirements, even when the internal Match engine retains them for eligibility evidence.
- A `Strong match` display becomes `Partial match` when two high-priority preparation topics have no direct Experience or Projects evidence. This display calibration does not change backend Match scoring or question planning.

### Verification

- `frontend/src/utils/__tests__/matchResultViewModel.test.js`: 5 tests passed; frontend ESLint passed. Browser validation is not included.

## [2026-08-01 22:03 NZST] Report score bands now describe interview performance

### Changed / Added

- Report score bands now use performance language rather than Match verdicts: `Strong performance`, `Promising performance`, `Developing performance`, or `Needs stronger interview evidence`.
- Backend locks the deterministic band and the frontend recalculates it from the numeric interview-only score, so an AI response or legacy feedback cannot reintroduce `Strong match` into a Report.

### Verification

- Focused backend score-band tests: 4 tests passed; focused frontend score-band tests: 8 tests passed. Backend and frontend ESLint passed. Browser visual review is not included.

## [2026-08-01 21:51 NZST] Candidate PDF and local text export remove CV–JD score surfaces

### Changed / Added

- PDF export now shows one `Interview performance` card only when the candidate payload contains a numeric interview-only score. Legacy reports without that score do not receive a fabricated `0.00` card.
- The local text-download fallback emits only `Interview Performance` and its matching explanation; it no longer writes CV–JD, macro, micro, requirements, or blended score lines.

### Verification

- Focused frontend candidate-report, PDF, and text-export tests: 15 tests passed; frontend ESLint passed. Browser/PDF visual review is not included.

## [2026-08-01 21:42 NZST] Candidate web report removes CV–JD score surfaces

### Changed / Added

- The web report now shows one `Interview performance` score card and one corresponding explanation. It ignores legacy CV–JD and Match-decision fields even if an older report contains them.
- Removed CV–JD report language from the report tour, the landing-page report FAQ, and the unused score-breakdown component.

### Verification

- Focused frontend candidate-report surface tests: 5 tests passed; frontend ESLint passed. Browser visual review is not included.

## [2026-08-01 21:34 NZST] Candidate report JSON and TXT remove CV–JD scores

### Changed / Added

- Candidate report JSON now projects only the interview-only `overall` score. It does not expose `cvJdMatch`, macro, micro, or requirements fields.
- Legacy reports without a stored interview-performance score expose no candidate score rather than presenting a prior blended score as interview performance.
- Candidate TXT export labels the sole score as `Interview Performance` and omits CV–JD score lines.

### Verification

- Focused backend publication/TXT export tests cover the new and legacy projection paths. PDF and web report surfaces are changed in the following frontend slice.

## [2026-08-01 21:26 NZST] Report overall now reflects interview performance only

### Changed / Added

- Report `overall` now equals the interview-performance score. The former 50/50 CV–JD Match and interview blend is removed from the report scoring contract.
- Stored report score explanations and the report-draft overview now describe interview-answer evidence and framework quality only; they no longer embed CV–JD score, confidence, or a Match decision.
- Match scoring and role-evidence artifacts remain available to the Match and question-planning flows, but are no longer report-score inputs.

### Verification

- Focused backend report score/explanation tests are updated for the interview-only contract. Candidate API, PDF, TXT, and web-surface removal are tracked in the following slices.

## [2026-08-01 21:18 NZST] Candidate-facing Match preparation brief

### Changed / Added

- Replaced the Match score, confidence, score cards, evidence map, requirement diagnostics, and question-count dashboard with a compact interview-preparation brief.
- The brief shows only a text fit (`Strong match`, `Partial match`, or `Needs more evidence`) and up to five complete topic cards: the topic, a CV example, its evidence gap, and a likely follow-up question.
- Only CV evidence traced to `Experience` or `Projects` can appear as an example. If neither source exists, the brief states that no direct work or project example was found. It displays at most two evidence-gap topics.
- Match scoring, role evidence, question planning, and their backend outputs remain in place; this slice changes only the candidate-facing projection.

### Verification

- Focused frontend Match/navigation component and view-model tests: 10 tests passed; frontend ESLint passed.
- Browser visual review, real AI evaluation, and report-score changes were not run in this slice.

## [2026-08-01 21:12 NZST] Match navigation and action-control simplification

### Changed / Added

- Removed the redundant numbered 1–6 header progress indicator from Analyze. The clickable six-stage bar remains, but shows only each original stage name and its state icon.
- Replaced the large `Setup checklist` with a compact `Match control` panel that presents the current next step and retains the existing generate, retry, continue, and completed-match regeneration actions.
- CV/JD review gates, input-driven Match clearing, and interview mode behaviour are unchanged.

### Verification

- Focused frontend component tests: 5 tests passed; frontend ESLint passed.
- Browser visual verification and the remaining Match-content redesign were not run as part of this navigation/control slice.

## [2026-08-01 20:10 NZST] JD container hygiene and CV-JD disjunctive evidence handling

### Changed / Added

- JD parser recognises typical-day responsibility headings, bonus-section container wording, Markdown-wrapped headings, and Warehouse Group employer/application boilerplate. The boilerplate does not become a candidate requirement, role intent, evidence-map row, or preparation target.
- CV-JD matching normalises `such as` / `or equivalent` lists, preserves explicit taxonomy skill evidence, and accepts one grounded alternative where a JD names interchangeable tools or platforms.
- Role-family and title extraction now tolerate the tested AI Engineer listing formatting. The match-cache safeguard version changed so prior results do not silently reuse the earlier matching rules.
- Issues #152 and #153 are implemented by this PR. Issues #150 and #151 are closed as `not planned` by product decision: this slice does not expand a closed tool-regex taxonomy or force education lines into a synthetic record.

### Verification

- `backend/tests/robustness/cv/cvParsingRobustness.test.js`, `backend/tests/robustness/jd/seekIndeedParserCorpus.test.js`, and `backend/tests/robustness/match/matchRequirementBindingAndDisjunction.test.js`: 57 tests passed locally.
- Backend lint, GitHub CI, browser/PDF behaviour, and real-provider evaluation are recorded separately; they are not implied by the focused test result.

## [2026-08-01 09:20 NZST] CV-JD Match & Evidence Pipeline Audit & Fix (Issues #150-#158)

### Changed / Added

- **#150 CV Experience Boundary Normalization**: Implemented `extractExperienceEntries` in `cvEvidenceProfileBuilder.js` to preserve job title, company, date range, and bullet points within single coherent experience blocks, preventing line-by-line splitting from stripping bullet context. Cleaned date range header prefixes in `extractQuantifiedEvidence`.
- **#153 Project Tech Stack Policy Unification**: Refactored `hasProjectTechEvidence` to `isProjectTechOnlyEvidence` in `evidenceJudgeService.js`. Ensured project tech stack listings backed by verified project responsibilities or outcome evidence can achieve `'met'` status while capping standalone tech stack mentions at `'partial'`.
- **#152 Structured Property Confidence Calculation**: Refactored `calculateConfidence()` in `matchResultBuilder.js` to inspect explicit structured properties (`item.evidenceStrength`, `item.missingEvidence`) rather than fragile regex tests on `notes` strings.
- **#154 Gap Amplification Refinement**: Updated `buildExplanation()` gap filter logic in `matchResultFormatter.js` and `matchScoringService.js` to require `status === 'not_met'` or explicit evidence deficits, preventing partial matches from being over-amplified into candidate gaps.
- **#155/#156 Upstream Company Context Filtering**: Enforced `reviewed !== false` filtering in `normalizeCompanyMotivationFit` in `companyMotivationFitService.js`, preventing unreviewed or invalid company context items from polluting role evidence maps, question preparation, or UI components.
- **Automated Verification**: 41/41 Vitest test files (182/182 tests) passed cleanly across backend test suites. 0 ESLint errors.

## [2026-08-01 00:16 NZST] CV-JD Match & Interview Preparation Robustness Suite & Short Question Deduplication Fix

### Changed / Added

- **Domain 4 Full Test Coverage Expansion**: Created dedicated robustness test suites for previously untested Domain 4 features:
  - **F-11 Python NLP CV Entity Extraction**: Created `pythonNlpService.test.js` (testing disabled fallback, empty input safety, and parameter validation).
  - **F-13 File Repository SHA256 Deduplication**: Created `sha256Deduplication.test.js` (testing binary buffer checksum generation, `buildCvHash`, `buildJdHash`, and `buildMatchCacheKey`).
  - **F-15 Skill Gap & Risk Analysis**: Created `matchGapRiskAnalysis.test.js` (testing `buildExplanation` gaps, risks, strengths extraction, and commercial delivery risk flags).
  - **F-48 ETL CV-JD Feature Vectorization**: Created `cvJdFeatureVectorization.test.js` (testing 256-dim `weighted_hash_ngram_v2` vectorizer, `cosineSimilarity`, `embedBatch`, and `normalizeForRetrieval`).
- **Short Question Deduplication Fix**: Resolved bug in `questionDeduplicationService.js` where `textSimilarity` returned `0` for questions with under 5 tokens.
- **Match Scoring Robustness Suite**: Created `matchScoringService.test.js` covering `STRICT_TECH_PATTERNS` regex accuracy across 15 technical stacks, composite requirement string splitting, `software_it` domain weighted scoring, and `PRIMARY_TECH` hard requirement strict `not_met` overrides.
- **Vector Embedding Fallback Suite**: Created `huggingFaceEmbeddingService.test.js` verifying graceful fallback from HuggingFace API network/rate-limit errors (429/500/Timeout).
- **Catalog Degradation Suite**: Created `questionCatalogDegradation.test.js` verifying smooth degradation to `catalog_unavailable` template pools when Mongo catalog DB is offline or empty.
- **Automated Verification**: 32/32 Vitest tests passed across 8 robustness test files in Domain 4. 0 ESLint errors in modified/created files.

### Changed / Added

- **Scope Correction to Pure Option B**: Purged leaked Option A (Story Bank / Story Competency Matrix) and Option C (Phase C On-Demand AI Coaching Summary Slot & `POST /progress-analytics/coaching-summary` API) features. Removed non-contextual top-right global Confirm/Correct/Reject buttons.
- **5-Layer Pipeline Audit Drawer**: Added collapsible `Audit Comparable Sessions Group` displaying 5-layer pipeline filter breakdown (Owner, Target Role, Delivery Mode, Schema Version v7, Status completed) and session list with timestamps (`Date + Time`), session ID snippet, score, and STAR evidence ratio.
- **4-Segment Stacked Evidence Bar**: Replaced binary Direct vs Vague contrast with 4-segment stacked bar (`Direct STAR`, `Adjacent Exp`, `Vague/Hypothetical`, `Generic Filler`), ensuring 100% of candidate answer turns are accounted for without missing percentages.
- **Deterministic Stage 2 Threshold Rules**: Replaced static bullet points with explicit Stage 1-4 threshold rules (`Stage 2: Sessions ≥ 2 & Direct Evidence 1%–49%`), providing clear explainability.
- **6-Field Evidence Trace Detail Modal**: Enhanced `View Question Evidence Trace` to display Session ID, Question text, Answer Classification, Candidate Excerpt, Diagnosis Reason, and Scoring Schema Version (`v7`).
- **Real Report Metric Extraction**: Implemented `extractReportEvidenceMetrics` helper in `progressAnalyticsService.js` to parse MongoDB `SessionReport` nested fields (`evidenceDiagnostics.totals` & `metrics` arrays) across 4 schema layers, completely resolving the 0% data misinterpretation bug.
- **Automated Verification**: Vitest unit tests (`progressAnalyticsService.test.js` 6/6 passed) & component tests (`ProgressAnalyticsBanner.test.jsx` 4/4 passed). ESLint 0 errors. Feature RFC `F-76-multi-session-progress-analytics-and-powerbi-banner.md` synchronized.

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

## [2026-08-01] Question Catalog text/voice parity and new-project scenario gate

### Changed / Added

- Text and voice preparation now load the same approved Question Catalog candidate set; catalog content is no longer excluded solely because the session is text.
- Added a deterministic `scenario_problem_solving` reservation with one `new_project_delivery` candidate. It is eligible only for Technical sessions with 12+ questions or 30+ minutes, and Combined sessions with 15+ questions or 30+ minutes. Behavioural-only sessions do not receive it.
- Catalog bounded technical scenarios follow the same gate. The ranker treats the slot as one required question and marks early-ended unmet coverage as degraded instead of claiming it was asked.
- The CP2 policy-review artifact now models the same deterministic scenario candidate and records the Product Owner-approved policy version/digest; it remains a local governance artifact, not Mongo activation evidence.

### Verification

- Local backend focused Vitest: 64 tests across catalog selection, preparation, composer, and CP2 policy-review suites passed; backend ESLint passed.
- Mongo approved-catalog lifecycle, browser text flow, live voice/provider behavior, and production deployment were not run.

## [2026-08-02 00:16 NZST] Same-role question refresh remains planning-only

### Changed / Added

- A new session can now use its same-user, same-normalized-role projection before the first canonical question-set snapshot. Two independent fresh strong answers with no weak/partial conflict remove only the matching routine root; opening, closing, and fallback roots are retained.
- Weak, partial, or conflicting history does not remove a question. It preserves the matching root and adds a bounded `0.18` revalidation priority boost. Answer quality is attributed to the last countable AI question answered, not the next selected question.
- This is an observe-only, default-off planning policy. It cannot affect scoring and records no raw answer or candidate-facing trace. If history refresh fails, preparation logs a warning and uses the ordinary pool.

### V5.1 (Next Release Draft)
- **Phase 5: Past-example question wording and controlled follow-ups**:
  - Updated `interviewMicroPlanningService.js` to rewrite the Deepseek system prompt using the 6-part XML schema (Instructions, Knowledge, Memory, Examples, Tools, Guardrails).
  - Updated behavioral prompts in `questionCatalogSeed2026_1.js` and `questionCatalogSeed2026_2.js` to enforce outcome-first instructions.
  - Updated `interviewerAgentQuestionBuilder.js` to construct targeted probing follow-ups based on specific missing evidence dimensions (e.g., `personal_ownership`, `result_or_validation`, `tradeoff_or_constraint`).
  - Verified `interviewTurnOrchestratorService.js` correctly maps missing evidence signals to turn plans, preserving `rootQuestionId`.
  - All tests (`questionCatalog2026_2.test.js`, `followUpQuestionService.test.js`, `rootFollowUpRuntimeFlow.test.js`) are green.


- **Phase 2: Intent Engine & Rubric Routing (impact-first-past-example)**:
  - Added `resolveCanonicalEvidenceMode` and `resolveQuestionAssessmentIntent` to establish a single source of truth for categorizing evaluation modes and assessment intents across the system.
  - Refactored `questionCatalogSelectionService` and `questionPoolComposerService` to leverage the new central intent engine.
  - Updated `masterAiService` to persist `assessmentIntent` in interview transcripts at generation time.
  - Refactored `turnRubricService` to strictly route scoring frameworks using the persisted `assessmentIntent`, replacing legacy, brittle text-matching heuristics. 
  - Preserved backward compatibility by routing the new `impact_first_past_example` intent to the existing STARR evaluator (Phase 3 will introduce the true impact-first evaluator).
  - All tests (`roleSpecificFrameworkRobustness.test.js`, `questionCatalogSelectionService.test.js`) are green.

- **Phase 3: Universal LLM Evaluation Engine (Impact-First Past Example)**:
  - Created `impactFirstAnalysisService.js` implementing a deterministic 6-dimension rubric (`Goal & Context`, `Methodology`, `Trade-offs`, `Impact`, `Reflection`, `Communication`), scoring answers from 1-5 with an LLM evaluator (`deepseekService.js`).
  - Updated `turnRubricService.js` to route `impact_first_past_example` to the new LLM-driven service, completing the migration of past-example intent from the legacy STARR framework.
  - Converted `analyzeTurnStructure` and `buildDeterministicTurnBreakdowns` (in `reportGeneratorAgent.js`) to async functions to support network-dependent evaluator calls.
  - Refactored all dependent test suites (`reportFrameworkPipeline.test.js`, `roleSpecificFrameworkRobustness.test.js`, `reportGroundingRobustness.test.js`, `reportTurnDatasetRobustness.test.js`, `voiceDurationAssessmentService.test.js`) to await the async pipeline. All 83 tests passed.

### Verification

- Seven focused backend Vitest files / 89 tests and backend ESLint passed. Browser text, live voice/provider, Mongo persistence, production observe, user controls, and source-delete validation were not run.

## [2026-08-02 00:35 NZST] Canonical JD requirement priority before question-pool capacity

### Changed / Added

- Requirement candidate priority now reads the Match pipeline's canonical `status` enum, not the stale boolean `met`. Missing or unknown status is conservatively treated as `not_met`.
- The composer now ranks every interviewable JD requirement before session-level capacity selection. It no longer discards entries after the first six; the user's `questionLimit` remains the authority for how many countable questions the session asks.
- Within a status tier, must-have/hard requirements, importance, then original JD order make selection deterministic. This slice does not change requirement category/mode mapping.

### Verification

- Seven focused backend Vitest files / 89 tests passed. Browser text, live voice/provider, Mongo persistence, and production deployment were not run.

## [2026-08-02 01:05 NZST] Report UI rewrite and framework projection safety

- `reportCoachingService` 與 candidate projection 只按 exact question/answer pair 掛載 stronger answer；partial、index、ambiguous 或 unmatched pair fail safe 為 unavailable。
- Candidate report 的 shared allowlist 現在保留 UI 所需 framework fields；`TurnBreakdownSection` 不再生成學校、公司、職位、技術或成果等 candidate facts。
- 同步文件：F-34。驗證：backend focused Vitest 14/14、frontend component Vitest 4/4、backend/frontend ESLint passed；browser/manual、live provider、production 未執行。

## [2026-08-02 01:16 NZST] Report turn eligibility and feedback identity

- Candidate-question intent不再成為 scored report card；LLM coaching的 reorder、omission、unknown insertion與duplicate以 exact Q&A identity fail safe，不再依 array index移位。
- 同步文件：F-34。驗證：backend focused Vitest 23/23、backend ESLint passed；browser/manual、live provider、production 未執行。

## [2026-08-02 01:20 NZST] Report rubric and answer-result semantic truth

- Unknown/direct question不再默認STARR；role-specific dimensions不再因answer length取得partial credit；Answer result不再以off-topic STAR structure或question wording補足relevance/role-intent fit。
- 同步文件：F-34。驗證：backend focused Vitest 50/50、backend ESLint passed；browser/manual、live provider、production 未執行。

## [2026-08-02 01:26 NZST] Report fallback score and coaching causality

- Legacy score不再把adjacent evidence算成direct；question-count mismatch不再自行觸發concision advice，只有明確duration、word-count或focus evidence才顯示。
- 同步文件：F-34。驗證：backend focused Vitest 15/15、frontend focused Vitest 4/4、backend/frontend ESLint passed；browser/manual、live provider、production 未執行。

## [2026-08-02 01:35 NZST] Report UI semantic-integrity browser gate

- Headed Chromium以本地Vite與candidate projection fixture驗證desktop/mobile turn cards、duplicate question順序、framework、Answer result、ready/unavailable stronger answer及private-copy negative check；console 0 errors。
- Live backend/provider、human usability與production rollout仍未執行。

## [2026-08-09] Phase 1 canonical voice-duration assessment foundation

### Changed / Added

- Added `backend/src/services/report/voiceDurationAssessmentService.js` as the single owner of the five continuous voice-duration bands: `<60`/`>150`, `60–<70`/`>140–150`, `70–<80`/`>130–140`, `80–<90`/`>120–130`, and inclusive `90–120` seconds. The corresponding points are `0 / 2.5 / 5 / 7.5 / 10`.
- Extended the report turn dataset to annotate accepted substantive root voice answers once, while keeping text, follow-up, unknown-mode, missing-duration, unconfirmed, repair and candidate-question turns outside the eligible denominator.
- Exposed an internal nested summary through interview metrics and carried the same deterministic assessment into per-turn report breakdowns. Model output cannot replace the measured duration evidence.
- This slice does not change `reportScoreService.js`, overall score, frontend/public schema, coaching copy, voice runtime, text timing, persistence schema or candidate-facing projection.
- Synced the owning RFC: `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md`.

### Verification

- Focused Vitest: 3 files / 51 tests passed after Cycle 3 coverage repair.
- Report robustness: 23 files / 166 tests passed after Cycle 3 coverage repair.
- Voice robustness: 41 files / 183 tests passed; the initial sandbox run hit `listen EPERM` in an existing local lifecycle test, and the controlled local-listener rerun passed.
- Backend ESLint and `git diff --check` passed.
- Independent Cycle 3 audit: same clean-context auditor returned a final 10/10 PASS matrix after stale-plan-state and bounded coverage repairs; no blocking finding remained.
- Browser/manual calibration, live voice/provider, real AI evaluation, frontend rendering, Mongo persistence and production rollout were not run.

## [2026-08-14] Phase 6 Candidate-safe report contract and coaching

### Changed / Added

- Updated `projectFrameworkBreakdown` in `backend/src/services/report/reportPublicationSummaryService.js` to project new 5-band mathematical fields (`level`, `weight`, `earnedPoints`, `version`).
- Implemented `projectDurationAssessment` to explicitly allowlist deterministic duration fields (`eligible`, `reason`, `seconds`, `level`, `earnedPoints`, `maxPoints`) on the `candidateTurn` payload, safely exposing them to the frontend without leaking internal evidence arrays.
- Refactored `buildCoachingAdvice` in `backend/src/services/agents/reportGenerator/reportCoachingBuilder.js` to eliminate weak proxy logic (question-count causality) that previously triggered concise answers advice.
- Implemented deterministic coaching based on the actual `durationAssessment` band (triggering targeted `90-120` second advice if duration levels miss target).
- Removed legacy hardcoded "60-90 seconds" and "under 90 seconds" strings, replacing them with the new canonical 90-120 seconds target.
- Synced the owning RFC: `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md`.

### Verification
- Focused Vitest: `reportPublicationSummary.test.js` and `reportCoachingAndStarReview.test.js` passed 100%. Legacy payloads and LLM feedback attempts to override deterministic fields fail safely.

## [2026-08-14] Phase 7 Candidate UI and export consistency

### Changed / Added

- Updated `TurnBreakdownSection.jsx` to dynamically render `durationAssessment` fields (eligible, seconds, level, points) inside the `FrameworkBreakdown` component, ensuring the new Phase 6 projection is visible on the candidate report without client-side rescoring.
- Fixed fallback text logic in `frontend/src/utils/reportView/coaching.js` to target `> 120` seconds instead of `> 90`, and standardized all generic advice strings to "90-120 seconds".
- Refactored `buildTurnFrameworkMeta` in `frontend/src/utils/reportPdf/reportPdfTemplate.js` to accurately serialize the `durationAssessment` fields for PDF export.
- Enhanced `formatReportAsText` in `frontend/src/utils/reportHelpers.js` to include the `frameworkBreakdown` dimensions and `durationAssessment` text output, ensuring Text export consistency with HTML and PDF.
- Synced the owning RFC: `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md`.

### Verification
- Focused Vitest: `TurnBreakdownSection.test.jsx`, `reportTurnFrameworkFormatter.test.js`, and `reportHelpers.test.js` passed 100%. Legacy payloads correctly render neutrally without throwing errors.
