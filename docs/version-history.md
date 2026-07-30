# Version History

## 2026-07-30 - Context-Aware Dialogue, Organic Trade-Off Probing & NZ Culture Support (F-74)

- Added `PROBE_TRADE_OFF` action to `actionPlanner.js` and `interviewerAgentQuestionBuilder.js` for organic, narrative-rooted trade-off questions when candidate answers are smooth.
- Implemented NZ culturally nuanced ownership probing (*"That sounds like a great team effort! What was your specific piece of the puzzle there?"*) when candidate references team/we.
- Enabled dynamic conversational bridging across topic and section switches by propagating `previousTopic` into transition prompts (*"That makes sense for frontend. Moving on to backend..."*).

## 2026-07-30 - Fix Context-Aware Dialogue & Clarification Placeholders

- Replaced rigid `'this requirement'` and `'this area of the role'` placeholders with dynamic skill/topic extraction (`extractTopicFromFrame`, `extractTargetSkillFromQuestion`, `resolveVoiceGapTopic`).
- Updated `questionScopeClarificationService.js` to explicitly state target skills (e.g. *"I am asking specifically about your experience with AWS"*) when candidates ask *"What's the requirement?"*.
- Prevented duplicate company names in `buildOpeningQuestion` when `roleLabel` already contains the company name.

## 2026-07-30 - Fix JD Section Heading Leak in Match Focus Areas & Requirement Pool

- Fixed bug where raw JD section headers (such as `"Skills & Experience:"`) leaked into Match Focus Areas / Preparation Priorities (`ProofStrategyReviewPanel`) and requirement pool items.
- Added `isJobDescriptionSectionHeading` filtering to `proofStrategyClientSummaryService.js` and `questionPoolComposerService.js` to strictly exclude section titles from candidate focus areas and practice questions.

## 2026-07-30 - Interview Stress Level Mode (F-73)

- Added `stressLevel` setting support (`supportive` | `standard` | `high_pressure`) across session mapping, environment context, action planning, and interviewer agent persona.
- Implemented early `PROBE_STRESS` and `PROBE_FRICTION` action triggering in `high_pressure` mode with 10x traffic/latency constraint testing and outage recovery probing.
- Added supportive coaching mode fallback to filter out intense stress probes in favor of gentle scaffolding.

## 2026-07-30 - Candidate Answer STT Calibration & Normalization Optimization (F-18 / F-72)

- Added candidate-answer STT safe replacements in `transcriptReplacements.js` for verified live transcript misrecognitions (`WebSocket`, `TypeScript`, `LangChain`, `CI/CD`, `npm run build`, `Secrets Manager`, `EC2`, `merge to main`, etc.).
- Enhanced `speechPhraseHintService.js` regex to capture hyphenated/slashed acronyms (`CI/CD`), alphanumeric terms (`EC2`, `RDS`, `S3`, `VAD`), and tools (`WebSocket`, `Docker`) from CV/JD context into Azure STT Phrase List hints.
- Updated `transcriptCalibrationService.js` `textContainsTerm` to support space-stripped acronym matching (e.g. `c oc id` -> `CI/CD`) during deterministic N-Best reranking.
- Preserved 100% untouched `rawTranscript` for fluency/expression evaluation while providing `calibratedTranscript` for candidate technical competency evaluation.

## 2026-07-16 - Product Harness G0-G6 Local Shadow/Observe Foundation

- Added Product Harness foundation (Milestones M1 to M5) to enable queryable `WorkflowRun` correlation across text/voice context, actions, gates, memory, and failures.
- Implemented local shadow/observe support: M1 automated H1, M2 observed contracts, M3 default-off user interview projection, M4 report publication observe adapter, M5 release aggregator.
- Verified local implementation with `npm run eval:harness-m1` through `m5` scripts. All automated tests pass, but live provider, real mic, and production shadow gates remain open/unverified (status: `LOCAL_HARNESS_FOUNDATION_COMPLETE_G0_NOT_VERIFIED`).

## 2026-07-15 - CV-JD Match Latency Tracing and Safeguard Heading Guard

- Added request-scoped CV-JD match performance tracing (`performanceTrace.steps` / `slowestSteps`) and persisted sanitized step summary under `MatchAnalysisRecord.performanceTrace` without caching raw CV/JD content.
- Fixed match scoring to prevent low-value keywords or debug terms from contaminating match findings (added `jobDescriptionSectionHeadingGuard` to exclude headers like "Skills & Experience" and "Roles & Responsibilities" from scoring).

## 2026-07-13 - Voice Transcript Calibration and High-Risk Confirmation

- Added deterministic `transcriptReviewPolicyService` and high-risk confirmation gates to block wrongful score degradation on low-confidence voice turns until verified by the user.
- Added context-aware STT calibration (vocabulary/glossary context alignment without auto-injecting terms as spoken evidence) and n-best alternatives provenance tracking.
- Implemented real LLM judge eval script `npm run eval:voice-transcript-review-policy` (average rating 0.97).

## 2026-07-12 - E2E Refine Gate and Voice Interrupt Hardening

- Added stakeholder E2E refine scripts for review-lock API bypass, retention/deletion lifecycle access denial, low-confidence voice confirmation UI, and weak-network/barge-in voice flow.
- Added shared E2E artifact/backend/voice harness helpers and `frontend` aggregate command `npm run test:e2e:role-fit-refine`.
- Added backend `eval:e2e-refine-release-gate`, which reads `output/playwright/*.latest.json` artifacts and writes `backend/eval/reports/e2e-refine-release-gate.latest.{json,md}`.
- Hardened interview-plan creation so `manual_review` match analysis cannot be used to create a usable interview plan by bypassing the frontend.
- Fixed the duplex WebSocket queue so interrupt control messages (`barge_in`, `cancel_assistant_audio`) can interrupt streaming assistant speech instead of waiting behind queued TTS work.
- Current E2E refine gate status is `ready_with_known_issues`: four required artifacts pass, release blockers are none, and the remaining known issue is voice next-question first audio exceeding the 3-second target.

## 2026-07-11 - Role-Fit Closed Loop v2 Final Goal

- Upgraded the product from requirement-centered CV-JD practice into a Role-Fit closed loop: reviewed company context, hiring-logic role intent, candidate evidence graph, proof strategy, interview question metadata, and answer-alignment report now share a traceable contract.
- Added source-confidence and review-confidence separation so user review no longer overwrites source trust.
- Added bounded same-origin website evidence capture, SSRF/content guards, URL-only degraded diagnostics, and manual-vs-website conflict diagnostics.
- Added deterministic CompanyUnderstanding v2 and RoleIntentDecoder v2 fields for business model, users/products, operating context, role purpose, workflow pain points, hiring risks, ideal signals, interview probes, and uncertainty.
- Added Candidate Evidence Graph v2 and Role Evidence Map v2 with proof angles, fit limits, how-to-say-it guidance, avoid-using guidance, and hiring-logic links.
- Added Proof Strategy preparation UX and metadata-aware question ranking while keeping live interview payloads free of recommended evidence hints.
- Added Answer Alignment v2 with six dimensions, evidence-use diagnosis, report QA blocking flags, and plain-language report UI/TXT/PDF export behavior.
- Completed the 12-case Role-Fit V2 adversarial suite and 12/12 human calibration dataset; release threshold is 0.85 and calibration status is `calibrated`.
- Added Role-Fit release gate aggregation, browser visual evidence, and real-backend voice flow evidence. Current release gate status is `ready_with_known_issues`; the known issue is real-backend voice next-question first audio exceeding the 3-second target.
- Added `docs/2026-07-11-role-fit-v2-implementation-narrative.md` to explain how the original product was implemented into the current Role-Fit system and where the actual build differed from the plan.

## 2026-06-23 - Report Integrity, Resumable Recording, Question Deduplication, and Documentation Reconciliation

- Added transcript-based and preparation-time question deduplication with safe `no_unique_question_remaining` completion.
- Added a canonical report-turn dataset that scores only countable questions paired with accepted answers.
- Added question-specific assessment contracts, deterministic score ownership, content-quality checks, evidence-source rows, and transcript-risk warnings.
- Added bounded report QA repair with at most two attempts, post-rewrite grounding, report versions, repair history, QA attempt count, and explicit final statuses.
- Added browser IndexedDB recording durability, idempotent resumable chunks, retry/recovery, asynchronous conversion worker, recording status UI, and non-blocking report navigation.
- Documented Azure-first speech routing with independently configurable ElevenLabs STT/TTS fallback.
- Reclassified retention from missing to implemented-but-operationally-gated: audit, approval-gated cleanup, backup/quarantine, manifests, and a disabled-by-default queued-job worker exist.
- Reconciled README, architecture, workflow, function, API, test/eval, data lifecycle, benchmark, and historical plan documentation with the current code.

## Documentation Alignment - Notion Architecture and Current Code

### Code-document alignment

- Added `docs/code-document-alignment.md` as the current implementation map for the Notion "GAI Voice Agent - Systematic Knowledge Architecture" page.
- Updated architecture docs to reflect `document_chunks.embedding vector(256)`, pgvector runtime retrieval, MongoDB AI artifacts, and the current DeepSeek/Azure Speech/service-layer agent design.
- Reclassified voice from "missing" to product-wired but requiring live E2E verification.
- Reclassified commercial stress testing from proposed to implemented/partial based on `AiUsageEvent`, usage aggregation, report controller payloads, and frontend report display.
- Updated data and product requirement docs to keep JD file upload, retention cleanup, account-wide deletion, and encryption-at-rest guarantees in backlog/partial status.

## Current Gap Closure - Human Review Gates, RAG Hardening, Recording Guardrails, and Eval Alignment

### Analyze flow trust gates
- Added a human review gate for CV parsing before CV-JD matching.
- Limited the CV review panel to fields that affect matching: candidate summary, core skills, experience evidence, project evidence, education and credentials, and key competencies.
- Kept contact details out of the CV review panel so users review match-relevant evidence without exposing unnecessary personal data in the analyze flow.
- Persisted CV review state in the analyze draft so the page can distinguish the currently reviewed CV from a newly uploaded or newly selected CV.
- Changed JD review behavior so every current JD summary must be marked as reviewed before CV-JD matching, even when AI confidence is at or above the 90% gate.
- Hardened the JD human-review stamp so verified JD rubrics clear stale `blockMatch` safeguards before matching.
- Updated analyze action copy so users understand that CV-JD matching depends on a reviewed CV parse and reviewed JD summary.

### CV parse confidence and warnings
- Returned CV `parseConfidence` and `parseWarnings` from recent and selected CV API responses so frontend review UI can show parser quality.
- Added a focused CV review view model that only exposes match-relevant parsed fields.
- Added frontend coverage for the CV review view model to ensure contact details are not included in the matching review surface.

### CV-JD match and human-in-the-loop behavior
- Preserved the backend safeguard behavior where a blocked JD still returns a 0/manual-review match if it has not been human reviewed.
- Allowed blocked-but-human-reviewed JD rubrics to proceed through normal CV-JD matching instead of staying stuck at 0.
- Added robustness coverage for both paths: blocked unreviewed JD remains blocked, while blocked reviewed JD can produce a normal match result.

### RAG and retrieval hardening
- Upgraded the deterministic local embedding from a 32-dimension hash vector to a 256-dimension weighted hash embedding with token features, word n-grams, character n-grams, estimated IDF weighting, signed hashing, and keyword fusion compatibility.
- Marked Mongo `DocumentChunk` usage as a legacy mirror while runtime vector retrieval reads PostgreSQL pgvector chunks.
- Added RAG indexing payloads for match analysis and controller decision records so session retrieval can use CV, JD, match, interview-plan, transcript, and controller evidence.
- Added PostgreSQL dedupe cleanup for existing duplicate `document_chunks` rows.
- Added a unique source/session/chunk/text index so repeated indexing does not create duplicate retrieval chunks.
- Added source/session lookup indexes and metadata `sourceId` indexing for retrieval filtering.
- Added pgvector ANN indexing with HNSW when available and IVFFlat fallback when HNSW is unavailable.
- Added retrieval robustness tests for embedding behavior and RAG index payload content.

### Recording upload guardrails
- Added audio MIME type and extension validation to the session recording upload route before files are passed to MP3 conversion.
- Added a recording upload guard robustness test covering accepted browser audio files and rejected arbitrary files.

### Backend quality gates and eval alignment
- Fixed `npm run test:jd-safeguard` so it points to the existing JD safeguard robustness test.
- Fixed `npm run test:match-safeguard` so it points to the existing guarded match human-review robustness test.
- Confirmed the SEEK JD benchmark is an evaluation runner through `npm run eval:seek`, using the 10 SEEK JD cases under `backend/eval/datasets/jd-parse-seek-benchmark.json`.
- Kept `npm run eval:all` wired to include the SEEK JD benchmark alongside CV parse, JD parse, CV-JD match, interview controller, report QA, end-to-end interview, and Green Agent evals.

### Validation snapshot
- Frontend `npm run lint` passes.
- Frontend `npm run test:all` passes with 12 test files and 34 tests.
- Frontend `npm run build` passes.
- Backend `npm run lint` passes.
- Backend `npm run test:all` passes with 20 test files and 51 tests.
- Backend `npm run test:jd-safeguard` passes.
- Backend `npm run test:match-safeguard` passes.
- Backend `npm run eval:seek` passes with 10 SEEK cases, average score `0.81`, and critical average score `0.83`.

## Current Release - Interview Session Control, Voice Track, Robustness Tests, and Documentation Alignment

### Product scope update
- Updated the project documentation to match the latest backend and frontend code structure.
- Clarified that the project is now a CV + JD interview agent, not a simple mock interview demo.
- Confirmed the current workflow: login, CV upload, JD parsing, CV-JD matching, interview plan generation, text or voice interview session, transcript export, report generation, and report QA.
- Added clearer separation between implemented features, active work, and known technical gaps.

### Interview session setup
- Added interview control mode support through shared frontend/backend settings.
- Added question-limited interview setup with supported question counts: `8`, `12`, and `15`.
- Added time-limited interview setup with supported time limits: `5` minutes and `10` minutes.
- Mapped time-limited sessions to backend question capacity: `5` minutes resolves to `10` questions, and `10` minutes resolves to `15` questions.
- Added interview question type targeting through focus area selection: `technical`, `behavioral`, and `combined`.
- Added backend normalization for seniority level, focus area, control mode, question limit, and time limit.
- Added section targeting so technical-only sessions avoid behavioral sections, behavioral-only sessions avoid technical sections, and combined sessions use both.
- Added interview mode keys that combine seniority, focus area, and control mode for more stable downstream session behavior.

### Interview controller and agentic behavior
- Added shared agent constants for decision types, action types, and tool names.
- Added AI control services for action planning, decision context building, section planning, trajectory tracking, evidence bundling, dynamic slots, and reflection writing.
- Added interview action execution services to separate control decisions from session persistence.
- Added support for grounded interview turn planning through CV evidence, JD evidence, match evidence, and session state.
- Added follow-up control through blueprint anchors and max follow-up limits to reduce repeated or drifting questions.
- Added interview state handling for time-limited sessions so elapsed time can complete the session when the limit is reached.

### JD parser and safeguard track
- Added guarded JD parsing services around JD analysis, critique, and reparse flows.
- Added JD safeguard heuristics to reduce role title leakage, marketing-copy contamination, and weak requirement extraction.
- Added Luma Analytics JD regression coverage to catch title, skill, and company extraction drift.
- Added agentic JD safeguard tests that can run in mock mode with `ENABLE_AGENTIC_SAFEGUARDS=true`.
- Kept deterministic fallback behavior when AI enhancement is disabled or the DeepSeek key is unavailable outside real eval mode.

### CV parsing and CV evidence model
- Added modular CV services for section parsing, signal extraction, achievement extraction, capability extraction, project normalization, and evidence profile building.
- Added CV profile contract building so downstream match and interview planning can consume a more stable CV shape.
- Added CV ownership and lifecycle services for uploaded CV handling.
- Added CV robustness tests covering malformed, incomplete, and role-varied CV fixtures.

### CV-JD match analysis
- Added guarded match services with match critique support.
- Added capability taxonomy, section-aware matching, achievement boosts, transition-aware scoring, and explanation building.
- Added match analysis contract building so generated plans and reports can depend on a stable match result structure.
- Added match safeguard test command: `npm run test:match-safeguard`.

### Report generation and QA
- Split report generation into smaller builder services for metrics, evidence analysis, feedback, coaching, and answer rewrites.
- Added report QA agent support to check report grounding and usefulness.
- Added report export route: `POST /api/report/:sessionId/export`.
- Added frontend report sections for coaching, communication profile, insights, quote analysis, turn breakdown, answer rewrite, and hero/action cards.
- Added report grounding robustness tests to reduce unsupported feedback.

### Retrieval and RAG
- Added retrieval source constants and objective building.
- Added global knowledge retrieval and session evidence retrieval services.
- Added corrective retrieval and retrieval quality assessment services.
- Added retrieval source registry and selector services to separate global knowledge from session-scoped evidence.
- Kept RAG endpoints for importing benchmark data, importing interview knowledge, rebuilding a session index, and retrieving context.

### Voice interview track
- Added Azure Speech service integration for TTS and STT configuration.
- Added real-time speech session service and live STT WebSocket route pattern: `/api/interview/:sessionId/voice/live`.
- Added duplex voice frontend flow with microphone streaming, voice activity detection, assistant audio queue, barge-in handling, and latency tracing.
- Added backend duplex voice socket module and duplex voice orchestration services.
- Added voice latency utilities and tests for frontend trace/summary behavior.
- Added microphone permission and device-check hooks/components for safer voice session setup.
- Added robustness tests for duplex voice behavior and removal of legacy batch voice flow.
- Attached the duplex voice WebSocket server in `backend/index.js` alongside the live STT socket, so `/api/interview/:sessionId/voice/duplex` is now mounted from the backend entry point.
- Lazy-loaded duplex voice session dependencies inside the socket connection flow to keep socket context parsing tests lightweight and avoid importing heavy interview/session services before an authenticated connection exists.
- Added a server wiring robustness test to guard against shipping the frontend duplex voice flow without the backend socket attached.

### Backend architecture and maintainability
- Added `src/api.js` as the API composition layer under `/api`.
- Kept backend entry flow as `index.js -> src/api.js -> route modules`.
- Added shared `asyncHandler`, request context middleware, structured logger, `AppError`, and controller helpers.
- Added more focused services under `src/services/cv`, `src/services/jobDescription`, `src/services/match`, `src/services/interview`, `src/services/session`, `src/services/retrieval`, `src/services/voice`, and `src/services/aiControl`.
- Added background job queue support for longer-running backend tasks.
- Added health route for database status checks.

### Data layer
- Kept the hybrid storage model: PostgreSQL for structured operational data and MongoDB for flexible AI records.
- Added or retained Mongo models for AI logs, document chunks, document content, ground truth, interview plans, match records, normalized CV profiles, normalized JD rubrics, session analysis, session feedback, session reports, session transcripts, and user coaching memory.
- Added PostgreSQL schema support for interview control fields such as control mode, question limit, and time limit.

### Frontend architecture
- Kept React + Vite + Tailwind CSS as the frontend stack.
- Added protected routing around home, analysis, interview, and report pages.
- Added analysis draft persistence for selected CV, raw JD, structured JD, settings, and session mode.
- Added reusable component groups for analyze, home, interview, report, layout, auth, and common UI.
- Added interview display helpers for session title, role labels, mode labels, timers, current focus, and plan progress.
- Added voice-specific UI through `VoiceInterviewPanel`, `TextBackupCard`, device checks, microphone permission handling, VAD, and duplex socket hooks.

### Testing and evaluation
- Changed backend tests to be robustness-focused instead of simple happy-path smoke tests.
- Added backend test groups for CV parsing, JD parsing, JD safeguards, interview control, tool trace contracts, retrieval, report grounding, DeepSeek mode behavior, duplex voice, and legacy batch removal.
- Added `npm run test:all` as the main backend robustness test command.
- Added real AI eval runners for CV parse, JD parse, CV-JD match, interview controller, and report QA.
- Added `npm run quality:all` to run robustness tests first, then real AI eval runners.
- Added DeepSeek fail-fast behavior when `AI_TEST_MODE=real` is used without `DEEPSEEK_API_KEY`.
- Added frontend tests for voice interview panel, microphone permission, voice interview session hook, realtime mic stream, realtime speech socket, VAD core, and voice latency utilities.
- Added frontend `quality:all` command to run tests and build.

### Documentation updates
- Rewrote `README.md` to match the latest backend and frontend code instead of the older demo-focused description.
- Updated setup commands, scripts, route list, architecture notes, testing strategy, environment variables, and known gaps.
- Updated this `version-history.md` to include the newer interview control, voice, safeguard, eval, and maintainability tracks.

## JD Parser Phase 4
- Fixed malformed newline escaping in `tests/jobDescription/jobDescriptionMetamorphic.test.js` so Vitest and Vite import analysis can parse the file correctly.
- Preserved Phase 3 contract compatibility changes while keeping metamorphic stability coverage for lowercase paragraph and reordered variants.

## JD Parser Phase 3
- Fixed downstream JD contract builder to preserve normalized preferred skills and raw preferred evidence together.
- Added candidate ranking tests for header tokenization and labeled company extraction.
- Expanded metamorphic stability coverage with lowercase paragraph and reordered variants.
- Expanded adversarial coverage to ensure marketing noise stays out of company and skill extraction.

## JD Parser Phase 2
- Added normalized bluepoint output for responsibilities, requirements, benefits, and application instructions.
- Added raw section preservation under `rawSections` so original JD evidence is still available.
- Added `evidenceMap` to link normalized points back to source text.
- Added bluepoint normalizers for responsibilities, requirements, benefits, soft skills, and application instructions.
- Updated rubric builder to return `sections` as normalized points and `normalized` as a mirrored structured view.
- Updated schema validator to preserve `rawSections`, `normalized`, and `evidenceMap`.
- Added normalization-focused tests and updated JD section tests to reflect bluepoint output.
