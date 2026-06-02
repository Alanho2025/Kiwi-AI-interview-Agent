# Kiwi AI Interview Agent - Remaining Test and Evaluation Plan

Branch: `Alan-workplace`

Question pipeline work is complete. Do not rework root-question, follow-up, CV seed, JD filter, prepared question pool, match-gap question, or question diagnostics logic unless a later regression test clearly proves a real issue.

This plan focuses on the remaining test and evaluation gaps:

- CV parse and CV human review
- JD parse and JD human review
- Company values / company research enrichment
- CV-JD match reliability
- Voice interview runtime and UX behaviour
- Report generation
- Report QA and QA redo
- MP3 recording download
- Report export as PDF, JSON, and TXT
- Report export visual quality
- UX-critical state reset and navigation behaviour

## 1. Ask-before-changing rule

If it is unclear whether a failure comes from the test, the test setup, the product expectation, or the running code, stop and ask the user before changing production code or changing the expected result.

Ask the user in this format:

1. What failed.
2. Possible causes.
3. What would change for each option.
4. Which direction should be approved.

Do not guess and silently change behaviour when the root cause is unclear.

Examples:

- If an E2E test fails because UI copy differs from the selector, ask before changing UI text or weakening the selector.
- If report QA only marks `needs_review` but the test expects automatic regeneration, ask before adding that loop.
- If voice confidence gating rejects a transcript but the test expects it to pass, ask before relaxing the gate.
- If PDF layout differs but remains readable, ask before changing the renderer.

This rule is mandatory.

## 2. Preserve completed behaviour

Do not remove or weaken existing behaviour:

- CV upload and CV parse
- CV review and seed refresh
- CV question seed generation
- JD parse and review
- JD question filtering
- CV-JD match analysis
- Match analysis persistence
- Session creation
- Prepared DB-backed question pool
- Legacy fallback question pool
- Adaptive follow-up behaviour
- Voice fast path
- Transcript confidence gate
- Voice repair and confirmation path
- Streaming TTS path
- Report generation
- Report QA status
- Export and recording download paths

Do not add extra blocking LLM calls to the live voice turn.

Keep real paid AI or external-service evals opt-in. Do not place them in ordinary local tests.

## 3. Required documentation

Create or update:

- `docs/test-evaluation-coverage-matrix.md`

The matrix must cover:

- Current tests and evals found
- Unit, integration, E2E, and human-behaviour coverage
- Edge cases covered
- Edge cases missing
- Recommended next tests
- Priority: P0 / P1 / P2

Mark the completed question pipeline as `completed / preserve only`.

## 4. Priority order

### P0 - Must add or verify

1. Full human E2E happy path, without reworking question logic.
2. Full human E2E degraded path, without reworking question logic.
3. CV/JD edit state reset tests.
4. Report artifact quality tests for PDF export.
5. MP3 recording availability and failure behaviour.

### P1 - Should add

1. Voice human behaviour edge cases.
2. Company values degraded and wrong-company cases.
3. Report QA redo / rewrite safety tests.
4. MP3 file validity tests if route or storage allows it.
5. UX button-state and loading-state tests.

### P2 - Add if time allows

1. Mobile or browser-specific voice smoke test.
2. Accessibility checks for main flows.
3. Long report visual regression snapshot.
4. More real AI eval datasets.
5. Latency budget regression gates.

## 5. Full human E2E happy path

Suggested file:

- `frontend/e2e/specs/full-interview-human-flow.spec.js`

Scenario:

1. User opens `/analysis` in test mode.
2. User uploads a CV fixture.
3. CV review page shows parsed fields.
4. User edits one CV review field.
5. User confirms CV review.
6. User pastes JD text.
7. User runs JD parse.
8. JD review page shows structured JD rubric.
9. User edits one JD requirement.
10. User confirms JD review.
11. User chooses text interview mode.
12. User generates CV-JD match and interview plan.
13. User starts interview.
14. User submits at least one answer.
15. User ends interview.
16. Report is generated or loaded.
17. QA status is visible.
18. PDF export works.
19. JSON/TXT export works.
20. MP3 download is hidden or disabled for text-mode sessions.

Use deterministic mocks for external LLM and speech services where needed. Do not mock every product route if a test-mode backend path can be used safely.

## 6. Full human E2E degraded path

Scenario:

1. Sparse CV with no experience section.
2. Low-detail JD or JD with company context mixed into requirements.
3. Human review corrects or confirms the parse.
4. Match produces gaps and lower confidence.
5. Interview can still start with clear degraded or low-confidence state where available.
6. Candidate submits a weak or vague answer.
7. User ends interview.
8. Report is generated with low-confidence or insufficient-evidence markers.
9. QA status shows `needs_review` or flags when appropriate.
10. PDF export clearly shows warning or avoids unsupported claims.

Expected behaviour:

- Do not hallucinate missing evidence.
- Do not silently act like all preparation artifacts are healthy.
- Show degraded state where available.
- Do not rework question logic unless a real regression is found and the user approves.

## 7. Edge cases by remaining function

### 7.1 CV parse and CV human review

Add or verify tests for:

- Empty PDF or DOCX rejects without creating a CV profile.
- Scanned or unreadable PDF rejects with clear error.
- Corrupted file, wrong extension, or oversized file returns clear error.
- Two-column, table-heavy, or line-broken CV does not invent sections.
- Missing experience section continues with warning.
- Missing skills section lowers confidence and does not invent skills.
- Skills-list-only CV marks evidence as weak.
- Dates, phone numbers, and emails are not counted as achievements.
- Project titles are not polluted by dates or page breaks.
- Contact details are masked in display view.
- Empty human-reviewed CV profile rejects.
- User edits parsed fields and confirms review.
- Downstream matching uses reviewed evidence.
- Editing CV after match invalidates old match and interview plan.
- Space and Enter work inside review text fields.

### 7.2 JD parse and JD human review

Add or verify tests for:

- Empty JD blocks parsing.
- Very short JD returns low confidence and requires review.
- Company-description-only JD does not become candidate requirements.
- Multi-role JD does not become a clean single role without warning.
- SEEK-style field misclassification is corrected by safeguard.
- Salary, location, visa, and working hours do not become technical requirements.
- Company context does not become must-have candidate requirements.
- Editing raw JD clears old structured JD, review status, match, and plan.
- `edited` JD does not remove safeguard blocking.
- `verified` JD can override review-needed blocking safely.
- User edits one requirement and confirms.
- JD review status is visible in UI.
- Company values enrichment starts only after JD review.
- Changing JD after confirm resets stale summary and match.

### 7.3 Company values / company research

Add or verify tests for:

- Missing company name does not hallucinate values.
- Ambiguous company name gives low confidence or requires disambiguation.
- Broken company website falls back to JD-only context.
- Website timeout does not block interview creation.
- JD-only company values are marked lower confidence than verified website values.
- Wrong-company result is not injected into questions or reports.
- Changing JD or company website creates a new fingerprint.
- Pending enrichment is visible as pending or best-effort if UI exposes it.

### 7.4 CV-JD match

Add or verify tests for:

- Skills-list-only evidence cannot fully meet hard requirements.
- Project evidence alone cannot satisfy commercial-years requirements.
- Adjacent evidence should be partial or manual review, not met.
- Qualification requirements require direct qualification evidence.
- Education should not satisfy behavioural or role-context requirements.
- PostgreSQL can count as related SQL evidence with reasonable status.
- Soft-skill requirements use behavioural evidence, not skills list only.
- CV and JD must be human reviewed before match.
- Stale `matchAnalysisId` is not used after CV or JD changes.
- Match score is explainable through strengths, gaps, and requirement checks.
- Weak evidence lowers confidence and does not create polished unsupported output.

### 7.5 Voice interview behaviour

Add or verify tests for:

- Mic permission denied shows clear UI error.
- Speaker/audio context locked requires user action to unlock.
- Wrong voice socket path is rejected.
- Missing or invalid auth is rejected before loading a session.
- Duplicate `speech_start` is ignored safely.
- Mismatched `clientTurnId` in `speech_end` is ignored safely.
- Audio sent before `speech_start` is clearly handled with diagnostics.
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

### 7.6 Report generation and QA

Add or verify tests for:

- Transcript too short produces low-confidence or insufficient-evidence report.
- Missing CV/JD artifacts fails clearly or produces degraded report status.
- Missing interview plan does not produce unsupported claims.
- Report claims are backed by CV, JD, plan, prepared pool, or transcript evidence.
- Report does not invent skills, experience, results, or company values.
- Report includes strengths, gaps, recommendations, and evidence references where available.
- Session not completed blocks final report or labels draft clearly.
- LLM failure does not create fake report.
- Empty retrieval does not hallucinate.
- QA without existing report throws `Report not found`.
- Hallucinated claims are flagged.
- Generic report is flagged as low usefulness.
- User rewrite prompt preserves evidence.
- Prompt asking to add unsupported claims must not add unsupported content.
- QA fail sets `needs_review`.
- Repeated QA redo avoids infinite loops.

### 7.7 MP3 recording download

Add or verify tests for:

- Text-mode session shows no MP3 option or disabled button.
- Voice session without recording shows unavailable state.
- Recording still processing shows processing state.
- Missing MP3 returns clear error.
- Zero-byte or corrupted MP3 is rejected where possible.
- Long interview recording can still be downloaded.
- Browser download failure shows retryable error.
- Archive job failure exposes unavailable status.

### 7.8 Report export and visual quality

Add or verify tests for:

- No report data blocks export.
- JSON export includes metadata, QA status, and report content.
- TXT export is readable and does not contain `[object Object]`.
- PDF export includes candidate name, target role, scores, strengths, gaps, recommendations, QA status, and evidence summary where available.
- Long report text wraps and paginates without cutoff.
- Special characters, Chinese text, apostrophes, bullets, and symbols do not break PDF export.
- Missing optional sections do not create blank or broken PDF sections.
- QA `needs_review` appears visibly in exported PDF.
- Very long report does not overlap or cut off text.
- Empty sections are hidden or rendered as `No evidence available`.
- Missing candidate name uses a safe fallback label.
- Missing score does not show `NaN`.
- Exported file can be opened and has non-zero size.

### 7.9 UX-critical state and navigation behaviour

Add or verify tests for:

- User changes CV after match: match, plan, session, and report reset or become invalid.
- User changes JD after parse: structured JD, review status, match, plan, and session reset.
- User navigates away and returns: draft restore works without stale verified state.
- Browser back/forward does not skip required review gates.
- Generate plan button disabled until CV and JD are human verified.
- Voice mode start disabled until device checks pass.
- Loading states prevent double-submit.
- Errors are visible and actionable.
- User can edit text fields with spaces and newlines.
- Buttons are disabled/enabled consistently.

## 8. Commands to keep passing

Backend:

```bash
cd backend
npm run lint
npm run test:all
npm run test:cv
npm run test:jd
npm run test:match
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
npm run test:e2e
npm run build
```

Question-specific commands can be run as regression checks, but they are not the main target of this plan:

```bash
cd backend
npm run test:questions
npm run test:agent

cd ../frontend
npm run test:e2e:question-pipeline
```

Eval commands should remain explicit and opt-in:

```bash
cd backend
npm run eval:local
npm run eval:real
npm run eval:all
```

## 9. Expected final output

When this plan is complete, provide:

1. A summary of files changed.
2. A table of new tests added by function area.
3. Which commands passed.
4. Which commands were not run and why.
5. Any edge cases still not covered.
6. Any production code changes and why they were necessary.
7. Any places where the ask-before-changing rule was triggered.
8. Any risky areas that should be manually tested in the browser.

## 10. Acceptance criteria

The work is acceptable when:

- `docs/test-evaluation-coverage-matrix.md` exists and is accurate.
- At least one full human E2E happy path is added or the existing E2E is extended to cover the full product path.
- A degraded human path is added or documented with tests.
- CV/JD stale-state reset tests exist.
- Report export quality is tested beyond simply checking that a handler was called.
- MP3 download availability and failure behaviour are tested.
- Existing tests still pass.
- Real external service tests remain opt-in.
- Completed question-pipeline behaviour is preserved, not rewritten.
- The ask-before-changing rule is followed whenever failure cause is ambiguous.

## 11. Important judgement rule

Do not overclaim. If a test only mocks API responses, describe it as frontend E2E with mocked API. If a test uses real routes but mocked LLM, describe it as integration with mocked AI. If a test uses real LLM eval, describe it as real AI eval.

The final documentation must distinguish:

- Code-level correctness
- Route/service integration correctness
- Browser user-flow correctness
- AI output quality
- Artifact quality
- Commercial robustness

The product is allowed to be resilient with fallbacks, but fallback/degraded behaviour must be visible, tested, and documented. Silent degradation is the main risk to remove.
