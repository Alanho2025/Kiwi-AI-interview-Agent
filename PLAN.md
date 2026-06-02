# Kiwi AI Interview Agent - Test and Evaluation Edge Case Plan

You are working on the `Alan-workplace` branch of `Alanho2025/Kiwi-AI-interview-Agent`.

This plan is for Codex to implement a stronger test and evaluation strategy. The goal is not to rewrite the product workflow. The goal is to add missing tests, evaluation coverage, edge-case protection, and documentation so the project can clearly show reliability, safety, and human-behaviour robustness.

## 0. Core task

Audit and improve the existing test and evaluation layer across the following product functions:

- CV parse
- CV human review
- JD parse
- JD human review
- Company values / company research enrichment
- CV-JD match
- CV question seed generation
- JD filter and CV-JD match question filtering
- Interview plan and prepared question pool
- AI agent orchestration / adaptive controller
- Question asking and follow-up behaviour
- Voice interview behaviour
- Voice WebSocket / STT / TTS runtime behaviour
- Report generation
- Report QA / QA redo
- MP3 recording download
- Report export as PDF, JSON, and TXT
- Report export visual / artifact quality
- Auth, ownership, and security around CVs, sessions, reports, and recordings
- UX-critical state reset and human-flow behaviour

The final result should make the test suite easier to explain as:

1. Unit tests: isolated pure logic and contracts.
2. Integration tests: routes, service wiring, auth, persistence, and mocked external dependencies.
3. E2E tests: realistic browser-level user behaviour.
4. Human behaviour tests: realistic candidate responses, mistakes, interruptions, edits, shallow answers, self-correction, and degraded inputs.
5. Edge-case tests: invalid input, stale state, missing artifacts, degraded AI services, poor transcript quality, bad exports, and ownership/security violations.

## 1. Non-negotiable implementation rules

Do not remove or weaken existing product behaviour.

Preserve all current AI behaviour, including:

- CV upload and CV parse
- CV review and seed refresh
- CV question seed generation
- JD parse and human review
- JD question filtering
- CV-JD match analysis
- Match analysis persistence
- Interview session creation
- Prepared DB-backed question pool composition
- Legacy fallback question pool
- Adaptive follow-up behaviour
- Voice fast path
- Voice transcript confidence gate
- Voice repair / confirmation path
- Streaming TTS path
- Report generation
- Report QA status
- Export and recording download paths

Do not convert the AI into static templates. Templates are fallback rails only.

Do not make live voice latency worse by adding extra blocking LLM calls inside the live voice turn. Heavy work must stay before the interview starts or in background jobs.

Prefer adding tests and diagnostics before changing production behaviour. If a code change is required, keep it small, targeted, and backed by a test.

Do not introduce flaky real external API tests into default local test commands. Real AI / external service tests must stay behind explicit eval commands or opt-in flags.

## 2. Current test/eval baseline to preserve

The project already has a useful baseline:

- Backend robustness groups under `backend/tests/robustness/*`
- Backend integration tests under `backend/tests/integration/*`
- Backend eval runners under `backend/eval/runners/*`
- Frontend Vitest tests under `frontend/src/**/__tests__/*`
- Frontend Playwright-style E2E scripts under `frontend/e2e/*`
- Existing scripts in `backend/package.json` and `frontend/package.json`

Do not delete existing tests unless they are clearly obsolete and replaced by stronger coverage.

## 3. Required new documentation

Create or update this file:

- `docs/test-evaluation-coverage-matrix.md`

It must contain a clear function-by-function matrix with these columns:

- Function area
- Current tests found
- Current evals found
- Unit coverage
- Integration coverage
- E2E coverage
- Human behaviour coverage
- Edge cases covered
- Edge cases missing
- Recommended next tests
- Priority: P0 / P1 / P2

This document should be written for both the team and the final report appendix. Keep it practical and evidence-based. Do not make claims unless the corresponding test or eval exists.

## 4. Priority order

Implement in this order.

### P0 - Must add or verify

1. Full human E2E happy path.
2. Full human E2E degraded path.
3. CV/JD edit state reset tests.
4. Prepared question degraded warning / diagnostics tests.
5. Report artifact quality tests for PDF export.
6. Ownership/security tests for CV, session, report, and recording access.

### P1 - Should add

1. Voice human behaviour edge cases.
2. Company values degraded and wrong-company cases.
3. Report QA redo / rewrite safety tests.
4. MP3 file validity and recording availability tests.
5. Mode guard matrix for behavioural, technical, and combined interviews.

### P2 - Nice to add if time allows

1. Mobile / browser-specific voice smoke test.
2. Accessibility and button-state tests.
3. Long report visual regression snapshot.
4. More real AI eval datasets.
5. Latency budget regression gates.

## 5. Full human E2E happy path

Add a realistic E2E test that acts like a normal user.

Suggested file:

- `frontend/e2e/specs/full-interview-human-flow.spec.js`

Recommended scenario:

1. User is authenticated in test mode.
2. User opens `/analysis`.
3. User uploads a CV fixture.
4. CV review page shows parsed fields.
5. User edits one CV review field.
6. User confirms CV review.
7. User pastes JD text.
8. User runs JD parse.
9. JD review page shows structured JD rubric.
10. User edits one JD requirement.
11. User confirms JD review.
12. User chooses text interview mode.
13. User generates CV-JD match and interview plan.
14. User starts interview.
15. AI asks first meaningful question from prepared evidence when available.
16. User gives a shallow answer.
17. AI asks a follow-up.
18. User gives a stronger answer.
19. AI returns to a root or match-gap question.
20. User ends interview.
21. Report is generated or loaded.
22. QA status is visible.
23. PDF export button works.
24. JSON/TXT export buttons work.
25. MP3 download is hidden or disabled for text-mode sessions.

Implementation rule:

- It is acceptable to mock external LLM and speech services.
- Avoid mocking every product route. Prefer test-mode backend routes or deterministic service mocks that still exercise frontend state and API wiring.
- If this is too large for one test, split it into `analysis-flow`, `interview-flow`, and `report-flow`, but keep a single documented end-to-end path.

## 6. Full human E2E degraded path

Add one E2E or integration-heavy scenario for degraded inputs.

Recommended scenario:

1. Sparse CV with no experience section.
2. Low-detail JD or JD with company context mixed into requirements.
3. Human review corrects or confirms the parse.
4. Match produces gaps and lower confidence.
5. Prepared question pool is created with fallback questions.
6. Candidate gives vague answer.
7. AI asks probing or rephrase follow-up.
8. Report is generated with low-confidence / insufficient-evidence markers.
9. QA status shows `needs_review` or flags.
10. PDF export clearly shows warning or avoids unsupported claims.

Expected behaviour:

- System should not hallucinate missing evidence.
- System should not silently act like all preparation artifacts are healthy.
- UI should show degraded state where available.

## 7. Function-by-function edge cases

### 7.1 CV parse

Add or verify tests for:

- Empty PDF / empty DOCX should reject and not create fake CV profile.
- Scanned PDF or no readable text should reject with clear error.
- Corrupted file, wrong extension, or oversized file should return clear error and not crash.
- Two-column CV, table-heavy CV, or line-broken CV should not hallucinate sections.
- CV with no experience section should continue with warning.
- CV with no skills section should lower confidence and not invent skills.
- CV with only skills list should mark evidence as weak.
- Dates, phone numbers, and email addresses should not be counted as achievements.
- Project titles should not be polluted by dates or page-break markers.
- Email, phone, and address should be masked in display view.
- Empty human-reviewed CV profile should reject.
- Re-uploading or changing CV after match should reset stale match/session state or force regeneration.

Suggested test areas:

- `backend/tests/robustness/cv/*`
- `frontend/src/utils/__tests__/cvReviewViewModel.test.js`
- New E2E analysis flow test.

### 7.2 CV human review

Add or verify tests for:

- User edits parsed fields and confirms review.
- Review state changes from unreviewed to verified.
- Downstream matching uses reviewed evidence, not stale auto-parse evidence.
- Empty review fields are rejected.
- Editing CV after match clears or invalidates old match and interview plan.
- Pressing space and enter inside review text fields works correctly.
- Multiple quick confirm clicks should not create duplicate seed refresh jobs.

### 7.3 JD parse

Add or verify tests for:

- Empty JD blocks parsing.
- Very short JD returns low confidence and requires review.
- JD that is mostly company description should not become a role requirement list.
- Multi-role JD should not be merged into a single clean role without warning.
- SEEK-style JD field misclassification should be corrected by safeguard.
- Salary, location, visa, and working hours should not become technical requirements.
- Company context should not become must-have candidate requirements.
- raw JD edit clears old structured JD, old review status, match, and interview plan.

Suggested test areas:

- `backend/tests/robustness/jd/*`
- `frontend/src/utils/__tests__/jdHumanReview.test.js`
- New E2E analysis flow test.

### 7.4 JD human review

Add or verify tests for:

- `edited` JD does not remove safeguard blocking.
- `verified` JD can override review-needed blocking safely.
- User edits one requirement and confirms.
- JD review status is visible in UI.
- Confirming JD starts company values enrichment only after review.
- Changing JD after confirm resets stale summary and match.

### 7.5 Company values / company research enrichment

Add tests for:

- Missing company name should not hallucinate values.
- Ambiguous company name should produce low confidence or require disambiguation.
- Broken company website URL should fall back to JD-only context.
- Website timeout should not block interview creation.
- JD-only company values should be marked as lower confidence than verified website values.
- Wrong-company result should not be injected into questions or reports.
- Changing JD or company website should create a new fingerprint and not reuse stale enrichment.
- Pending enrichment should be visible as pending or best-effort if UI exposes it.

Suggested test areas:

- `backend/tests/robustness/company/*`
- `backend/eval/runners/runCompanyResearchEval.js`
- Add missing docs coverage in `docs/test-evaluation-coverage-matrix.md`.

### 7.6 CV-JD match

Add or verify tests for:

- Skills-list-only evidence cannot fully meet hard requirements.
- Project evidence alone cannot satisfy commercial-years requirements.
- Adjacent evidence should be partial or manual review, not met.
- Qualification requirements require direct qualification evidence.
- Education should not satisfy behavioural or role-context requirements.
- PostgreSQL can count as related SQL evidence but must keep evidence status reasonable.
- Soft skill requirements should use behavioural evidence, not skill-list-only evidence.
- CV and JD must be human reviewed before match.
- Stale `matchAnalysisId` must not be used after CV or JD changes.
- Match score must be explainable through strengths, gaps, and requirement checks.
- Empty or weak evidence should lower confidence and should not create polished unsupported output.

Suggested test areas:

- `backend/tests/robustness/match/*`
- `backend/tests/integration/api/*`
- E2E analysis flow.

### 7.7 CV question seed generation

Add or verify tests for:

- Rich CV produces technical, behavioural, ownership, depth, result, and STAR seed candidates.
- Sparse CV does not crash and creates fallback seeds with low confidence.
- Skills-list-only CV does not create fake project ownership seeds.
- Multiple important projects produce project-specific seeds.
- Project tags are not polluted by dates or page-break markers.
- Weak soft-skill evidence and strong technical evidence remain separate.
- Seed generation failure during upload is retried during review or plan generation.
- Review refresh replaces or deactivates stale seeds.
- Seed count zero should set degraded diagnostics or warning.
- Seed records should not store unnecessary raw sensitive CV text.

Suggested test areas:

- `backend/tests/robustness/questions/cvQuestionSeedService.test.js`
- Add DB persistence tests if the model/service exists.

### 7.8 JD filter and match question filtering

Add or verify tests for:

- JD filter build failure should not crash match but must expose degraded diagnostics.
- All seeds suppressed should trigger fallback root questions.
- Important match gaps should create boosted validation questions.
- Behavioural-only JD should not force technical-only questions.
- Technical-only JD should not drift into generic personality questions.
- Duplicate requirements should be deduplicated.
- Must-have requirements should rank above nice-to-have items.
- Stale JD filter must not be used after JD edit.
- Diagnostics should expose `jdFilterReady`, decision counts, and match gap question count.

Suggested test areas:

- `backend/tests/robustness/questions/*`
- `backend/tests/robustness/match/*`
- E2E question pipeline diagnostics.

### 7.9 Interview plan and prepared question pool

Add or verify tests for:

- Missing CV seeds triggers seed retry during plan generation.
- Missing JD filter creates degraded plan status but still creates fallback pool when appropriate.
- Missing match analysis rejects plan or shows clear fallback reason.
- Technical mode prioritises technical questions.
- Behavioural mode prioritises STAR and soft-skill questions.
- Combined mode balances technical and behavioural coverage.
- Short interview duration reduces question count and follow-up depth.
- Question-limited interview does not over-ask.
- Duplicate root questions are deduplicated.
- Closing/wrap-up question exists.
- Regenerated session does not reuse stale question pool.
- Pool diagnostics expose prepared count, fallback count, wrap-up count, match-gap count, and degraded reason.

Suggested test areas:

- `backend/tests/robustness/questions/questionPoolComposerService.test.js`
- `frontend/e2e/specs/question-pipeline.spec.js`

### 7.10 AI agent orchestration / adaptive controller

Add or verify tests for realistic candidate behaviour:

- Candidate says `I do not know`.
- Candidate asks `Can you repeat?`.
- Candidate says the question is too hard.
- Candidate gives a long but vague answer.
- Candidate gives a strong answer with concrete result evidence.
- Candidate self-corrects in the same answer.
- Candidate answers a different question.
- Candidate asks to pause or stop.
- Candidate gives private information accidentally.
- Evaluator should not cause infinite follow-up loops.
- Evaluator should not skip important match gaps too early.
- Repeated questions should be avoided unless it is an explicit rephrase or follow-up.
- Time limit and question limit should complete the interview.
- Empty retrieval should trigger fallback with degraded metadata.
- Stale memory should not override the latest answer.

Suggested test areas:

- `backend/tests/robustness/agent/*`
- `backend/eval/runners/runInterviewControllerEval.js`
- `backend/eval/runners/runAgentTrajectoryEval.js`

### 7.11 Question asking and follow-up

Add or verify tests for:

- Existing opening question is not duplicated.
- Missing question pool falls back to safe self-introduction or fallback question.
- Empty answer is rejected.
- Duplicate answer submission is blocked by turn lock.
- Pressing Enter repeatedly does not create duplicate next questions.
- Backend remains source of truth for current question index.
- Time limit and question limit complete session.
- Empty nextQuestion falls back safely.
- `displayText`, `baseQuestionText`, and `spokenQuestionText` remain traceable.
- Prepared root question marks pool item as asked.
- Follow-up question does not consume prepared root item.
- Follow-up stays linked to parent root question.
- After enough depth, controller returns to root question or match-gap question.

Suggested test areas:

- `backend/tests/robustness/agent/*`
- `frontend/e2e/specs/question-pipeline.spec.js`

### 7.12 Voice interview behaviour

Add or verify tests for:

- Mic permission denied shows clear UI error.
- Speaker/audio context locked requires user action to unlock.
- Wrong WebSocket path is rejected.
- Missing/invalid auth is rejected before loading session.
- Duplicate `speech_start` is ignored safely.
- Mismatched `clientTurnId` in `speech_end` is ignored safely.
- Audio sent before `speech_start` is buffered, ignored with diagnostics, or clearly handled.
- Full audio queue drops chunks with diagnostics, not silent failure.
- Empty transcript triggers repair prompt.
- Very short transcript like `yes` is rejected.
- Low confidence transcript asks confirmation or record-again.
- Filler transcript like `thank you` is rejected.
- Common STT technical misrecognitions are normalized without changing answer meaning.
- User interrupts AI while TTS is playing and barge-in cancels active assistant speech.
- User corrects transcript and system merges corrected answer.
- First question latency is traced separately from RAG/adaptive latency.
- Azure STT/TTS failure shows fallback or clear error.
- Mobile Safari or browser audio limitations are handled where practical.

Suggested test areas:

- `backend/tests/robustness/voice/*`
- `backend/tests/integration/voice/*`
- `frontend/src/hooks/voice/**/__tests__/*`
- `frontend/e2e/voice-realtime-latency.playwright.mjs`

### 7.13 Voice WebSocket / STT / TTS integration

Add or verify tests for:

- Authenticated socket loads owned session and ensures interview is in progress.
- JSON events and binary audio are routed to the voice agent.
- Unauthenticated socket is rejected.
- Session not in progress is rejected.
- Barge-in emits formal tool trace.
- `session_start`, `speech_start`, `speech_end`, `session_stop`, and binary chunks follow the expected event contract.
- Mock STT accepted transcript reaches adaptive next-turn path.
- Mock STT rejected transcript does not save scored answer.
- Mock TTS streaming emits text/audio completion events.

### 7.14 Report generation

Add or verify tests for:

- Transcript too short produces low-confidence or insufficient-evidence report.
- Missing CV/JD artifacts fails clearly or produces degraded report status.
- Missing interview plan does not produce unsupported claims.
- Report claims must be backed by CV, JD, interview plan, prepared pool, or transcript evidence.
- Report should not invent skills, experience, results, or company values.
- Report should include strengths, gaps, recommendations, and evidence references where available.
- Report already exists: regenerate should replace, version, or clearly update status.
- Session not completed should block final report or label draft clearly.
- LLM failure should not create fake report.
- Empty retrieval should not hallucinate.
- Cost accounting should remain non-negative and tied to usage events.

Suggested test areas:

- `backend/tests/robustness/report/*`
- `backend/tests/integration/api/interviewReportRoute.integration.test.js`
- `backend/eval/runners/runReportQaEval.js`

### 7.15 Report QA / QA redo

Add or verify tests for:

- QA without existing report throws `Report not found`.
- Malformed report fails gracefully.
- Hallucinated claims are flagged.
- Missing CV/JD gap coverage is flagged.
- Generic report is flagged as low usefulness.
- Empty user prompt runs QA only.
- User prompt like `make it more professional` can rewrite while preserving evidence.
- User prompt asking to add fake claims must not add unsupported content.
- If rewrite is supported, rewritten report must rerun QA or clearly show rewrite status.
- QA fail should set `needs_review`.
- Repeated QA redo should avoid infinite loops.
- Regenerating report should reset stale QA result or mark QA as stale.

Suggested test areas:

- `backend/tests/robustness/report/*`
- `frontend/src/hooks/__tests__/useReportData.test.jsx`
- `backend/eval/runners/runReportQaEval.js`

### 7.16 MP3 recording download

Add or verify tests for:

- Text-mode session shows no MP3 option or disabled button.
- Voice session without recording shows unavailable state.
- Recording still processing shows processing state.
- Missing MP3 returns clear error.
- Zero-byte or corrupted MP3 is rejected where possible.
- Long interview recording can still be downloaded.
- User cannot download another user's recording.
- Browser download failure shows retryable error.
- Archive job failure exposes unavailable status.

Suggested test areas:

- `backend/tests/robustness/recording/*`
- `frontend/src/hooks/__tests__/useReportData.test.jsx`
- Add integration test if route exists.

### 7.17 Report export PDF / JSON / TXT

Add or verify tests for:

- No report data blocks export.
- JSON export includes metadata, QA status, and report content.
- TXT export is readable and does not contain `[object Object]`.
- PDF export includes candidate name, target role, scores, strengths, weaknesses/gaps, recommendations, QA status, and evidence summary where available.
- Long report text wraps and paginates without cutoff.
- Special characters, Chinese text, apostrophes, bullets, and symbols do not break PDF export.
- Missing optional sections do not create blank or broken PDF sections.
- QA `needs_review` appears visibly in exported PDF.
- Audit timeout does not block download if export itself succeeded.
- jsPDF/html2canvas failure shows clear error.

Suggested test areas:

- `frontend/src/hooks/__tests__/useReportData.test.jsx`
- `frontend/src/utils/__tests__/reportViewModel.test.js`
- Add dedicated PDF utility tests if PDF generation logic is isolated.

### 7.18 Report export visual / artifact quality

Add tests for user-facing artifact quality:

- Very long report does not overlap or cut off text.
- Empty sections are hidden or rendered as `No evidence available`.
- `needs_review` QA state is visible.
- Unsupported or QA-flagged claims are not presented as final truth.
- Font size remains readable.
- Page breaks do not split cards badly where avoidable.
- Evidence tables/lists are paginated or compacted.
- NZ workplace fit section missing does not create a blank section.
- Missing candidate name uses a safe fallback label.
- Missing score does not show `NaN`.
- Exported file can be opened and has non-zero size.

If visual snapshot testing is too heavy, implement deterministic PDF content tests first.

### 7.19 Auth, ownership, and security

Add or verify tests for:

- Unauthenticated CV upload is rejected.
- User cannot select another user's CV.
- User cannot run match with another user's CV ID.
- User cannot load another user's session.
- User cannot generate or read another user's report.
- User cannot download another user's recording.
- WebSocket without token/cookie is rejected.
- Wrong WebSocket origin is rejected if origin checks exist.
- Repeated upload / AI / report calls are rate limited where middleware exists.
- Sensitive transcript or CV fields are redacted where redaction is part of the product contract.

Suggested test areas:

- `backend/tests/robustness/server/*`
- `backend/tests/integration/api/*`
- `backend/tests/robustness/recording/*`
- `backend/tests/robustness/cv/*`

### 7.20 UX-critical state and navigation behaviour

Add or verify tests for:

- User changes CV after match: match, plan, session, and report should reset or become invalid.
- User changes JD after parse: structured JD, review status, match, plan, and session should reset.
- User navigates away and returns: draft restore should work without stale verified state.
- Back/forward browser navigation does not skip required review gates.
- Generate plan button disabled until CV and JD are human verified.
- Voice mode start disabled until device checks pass.
- Loading states prevent double-submit.
- Errors are visible and actionable.
- User can edit text fields with spaces and newlines.
- Buttons are disabled/enabled consistently.

Suggested test areas:

- `frontend/e2e/specs/full-interview-human-flow.spec.js`
- `frontend/src/pages/**/__tests__/*`
- `frontend/src/hooks/**/__tests__/*`

## 8. Required test naming convention

Use clear names that explain behaviour, not implementation trivia.

Good examples:

- `rejects scanned CV with no readable text instead of creating fake profile`
- `clears stale match when reviewed JD changes`
- `does not consume prepared root question when asking follow-up`
- `flags report when it contains unsupported skill claims`
- `rejects another user's recording download`

Avoid vague names like:

- `works`
- `handles error`
- `test function`

## 9. Required diagnostics to expose or verify

If these diagnostics already exist, add tests. If they do not exist, add small non-invasive diagnostics only where useful.

Question diagnostics should include:

- `cvSeedsCount`
- `cvSeedSamples`
- `jdFilterReady`
- `jdFilterDecisionCounts`
- `preparedRootQuestionCount`
- `fallbackRootQuestionCount`
- `wrapUpQuestionCount`
- `matchGapQuestionCount`
- `poolDegraded`
- `poolDegradedReason`
- `askedPreparedRootCount`
- `latestTurnKind`
- `latestScenario`
- `latestPreparedQuestionId`
- `latestParentQuestionId`
- `latestFollowUpIntent`

Voice diagnostics should include where available:

- `transcriptGateDecision`
- `usedPartialFallback`
- `bridgeAcknowledgementUsed`
- `warmContextHit`
- `firstSentenceReadyMs`
- `firstAudioSentMs`
- `ignoredPreSpeechAudioChunks`
- `clientTurnId`

Report diagnostics should include where available:

- `qaResult.passed`
- `latestStatus`
- `needsReviewReason`
- `evidenceCoverage`
- `unsupportedClaims`
- `rewriteApplied`
- `executionCost`

## 10. Commands to keep passing

After changes, run the relevant commands.

Backend:

```bash
cd backend
npm run lint
npm run test:all
npm run test:cv
npm run test:jd
npm run test:match
npm run test:questions
npm run test:agent
npm run test:report
npm run test:voice
npm run test:recording
npm run test:server
```

Frontend:

```bash
cd frontend
npm run lint
npm run test:all
npm run test:voice
npm run test:e2e:question-pipeline
npm run test:e2e
npm run build
```

Eval commands should remain explicit and opt-in:

```bash
cd backend
npm run eval:local
npm run eval:real
npm run eval:all
```

Do not make real paid LLM/API evals part of ordinary local tests.

## 11. Expected final output

When this plan is complete, provide:

1. A summary of files changed.
2. A table of new tests added by function area.
3. Which commands passed.
4. Which commands were not run and why.
5. Any edge cases still not covered.
6. Any production code changes and why they were necessary.
7. Any risky areas that should be manually tested in the browser.

## 12. Acceptance criteria

The work is acceptable when:

- `docs/test-evaluation-coverage-matrix.md` exists and is accurate.
- At least one full human E2E happy path is added or the existing E2E is extended to cover the full product path.
- A degraded human path is added or documented with tests.
- CV/JD stale-state reset tests exist.
- Prepared question diagnostics or degraded pool behaviour is tested.
- Report export quality is tested beyond simply checking that a handler was called.
- MP3 download availability and failure behaviour are tested.
- Ownership/security tests cover at least CV, session, report, and recording access where routes exist.
- Existing tests still pass.
- Real external service tests remain opt-in.

## 13. Important judgement rule

Do not overclaim. If a test only mocks API responses, describe it as frontend E2E with mocked API. If a test uses real routes but mocked LLM, describe it as integration with mocked AI. If a test uses real LLM eval, describe it as real AI eval.

The final documentation must distinguish:

- Code-level correctness
- Route/service integration correctness
- Browser user-flow correctness
- AI output quality
- Artifact quality
- Commercial robustness

The project is allowed to be resilient with fallbacks, but fallback/degraded behaviour must be visible, tested, and documented. Silent degradation is the main risk to remove.
