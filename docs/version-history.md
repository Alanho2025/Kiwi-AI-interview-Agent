# Version History

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
- Known integration note: the current backend entry point attaches the live STT socket. The duplex socket module exists, but it still needs to be attached in `index.js` before the full duplex frontend flow can work end to end.

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
