# Kiwi Match → Interview Preparation Optimization Spec

狀態：approved product direction；implementation-grade draft，尚未授權改 code

日期：2026-07-26 NZST

執行模式：Spec / Review

對應目標：[Kiwi Match → Interview Preparation Optimization Goal](jobsync-match-optimization-goal.md)

UI 計畫：[Kiwi Match UI 優化計畫](UI_match_plan.md)

決策背景：[JobSync 借鑑範圍與 Kiwi Match 方向修正](jobsync-match-optimization.md)

## Overview

### Goal

在不建立第二套 Match algorithm、ATS optimizer 或 CV rewrite flow 的前提下，原地優化 Kiwi 現有完整 CV-JD Match：

```text
reviewed inputs
  -> request-scoped sanitization and validation
  -> existing guarded Match
  -> persisted canonical match_completed
  -> existing JD question filter and pool preparation
  -> candidate-safe interview preparation priorities
  -> targeted interview
```

Streaming 是 transport 與可見進度的改善。JSON route 與 stream route 必須共用 `runCvJdMatchAnalysis` 及既有 downstream authority；不得分別計算兩份 Match。

Interview preparation 不是新的 scorer。它沿用現有 JD question filter、question pool、proof strategy 和 readiness，前端只呈現 allowlisted candidate-safe summary。

### Users

- 已確認 CV、JD 與 session setup，正等待 Match 的候選人；
- 需要知道 evidence、gap 與面試準備優先順序的候選人；
- 需要透過 `performanceTrace` 和 stream correlation 診斷 Match latency/failure 的 developer。

### Risk class

Medium-high。Feature 處理私人 CV、JD、candidate evidence、Match result 和 private question-preparation artifacts。錯誤的 stream semantics 可能讓 partial result 被當作正式 Match；錯誤的 UI projection 可能洩漏預備問題、證據 ID 或 ranking logic；錯誤的 retry 可能重複 persistence 或 session side effects。

### Implementation authority

本文件只授權 goal/spec/UI plan 更新。Code implementation、architecture change、dependency install、real-AI eval、production rollout、destructive operation 和 git push 仍需依 repository rules 另行批准。

### Source of truth

- Match HTTP orchestration：`backend/src/controllers/analyzeController.js`
- Canonical Match entry：`backend/src/services/cv/cvAnalysisService.js`
- Safeguard/cache/recompare：`backend/src/services/match/guardedMatchService.js`
- Match calculation：`backend/src/services/matchService.js`
- Final result：`backend/src/services/match/matchResultBuilder.js`
- Text guard：`backend/src/utils/textProcessing.js`
- Match persistence/trace：`backend/src/services/cv/matchAnalysisRecordService.js`
- Question filter：`backend/src/services/questions/jdQuestionFilterService.js`
- Question pool preparation：`backend/src/services/questions/questionPoolPreparationService.js`
- Analyze orchestration：`frontend/src/pages/AnalyzePage.jsx`
- Result presentation：`frontend/src/components/analyze/AnalysisStatusCard.jsx`
- Candidate-safe preparation view：`frontend/src/components/analyze/ProofStrategyReviewPanel.jsx`
- Action rail：`frontend/src/components/analyze/AnalyzeActionsCard.jsx`
- Existing stream client：`frontend/src/api/client.js`

## Requirements

### Functional requirements

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| MIP-001 | Maintain one authoritative Match pipeline. | JSON and streaming transports both call the current reviewed-input, guarded full Match; no simplified algorithm or user-selectable mode exists. |
| MIP-002 | Remove rejected provisional behavior. | Active consumers are checked, then `settings.matchMode === 'fast'`, fast parser/output and provisional ATS/tailoring fields are removed or explicitly isolated from target runtime. |
| MIP-003 | Normalize request-scoped comparison text. | HTML tags, whitespace, newlines and bullet variants normalize deterministically before matching; persisted original source remains unchanged. |
| MIP-004 | Reject unusable input before expensive work. | `NO_CONTENT`, `TOO_SHORT`, `TOO_LONG` and `CORRUPTED` return stable 400-level errors before embedding、LLM、critic、cache write、persistence 或 question filter. |
| MIP-005 | Preserve Match → question preparation authority. | Only the final persisted Match supplies evidence/gap inputs to the existing JD question filter and pool preparation. |
| MIP-006 | Expose a candidate-safe preparation summary. | UI derives focus count、gap count、question count、focus label、preparation hint 和 risk from existing proof strategy/readiness data. |
| MIP-007 | Protect private preparation artifacts. | Full prepared question text、evidence IDs、coverage IDs、proof points、rank trace、schema names 和 internal scorer terminology never enter the candidate summary. |
| MIP-008 | Stream current-pipeline progress. | A POST stream endpoint emits ordered allowlisted stage events from the same canonical execution. |
| MIP-009 | Deliver one authoritative final event. | Only `match_completed` carries the final persisted Match and permits interview-plan generation. |
| MIP-010 | Separate Match and interview-plan UI state. | Match result remains visible while plan status is preparing、ready 或 failed. |
| MIP-011 | Handle stream errors and retries safely. | Post-header failures emit safe terminal errors; retries are idempotent and do not duplicate Match records、question filters 或 interview sessions. |
| MIP-012 | Preserve non-streaming fallback. | Existing JSON flow remains available during rollout and returns a result parity-equivalent to the stream final event. |
| MIP-013 | Preserve cross-page UI boundaries. | Shared header、top progress、common primitives 和 shared `LoadingInsightPanel` behavior are unchanged; Match-specific progress stays Analyze-local. |

### Non-functional requirements

| Area | Requirement |
| --- | --- |
| Privacy | Never stream raw CV/JD、prompts、full evidence excerpts、owner IDs、private question items、internal critic reasoning 或 chain-of-thought. |
| Reliability | Event order is deterministic; every terminal stream has exactly one `match_completed` or `match_failed`. |
| Idempotency | One client request ID maps to at most one persisted Match record and one question-filter side effect. |
| Performance | Progress reporting adds no model/tool calls and less than 50 ms local orchestration overhead excluding network flush. |
| Compatibility | Existing saved Match records、JSON flow 和 preparation readers remain readable during rollout. |
| Observability | Stream events、final result 和 `performanceTrace` share request/match correlation without candidate content. |
| UX language | Candidate-facing labels use plain English and describe user-understandable work, not service/function names. |
| Maintainability | Controllers stay transport-focused; sanitization、event formatting、idempotency 和 candidate projection live in focused services/utilities. |

### Security and privacy rules

- Preserve authentication、CSRF、owner scoping 和 persisted Role-Fit review gates。
- Derive progress from allowlisted stage IDs；never serialize arbitrary trace metadata。
- Do not place CV/JD source、private evidence excerpts 或 prepared question text in stream/log payloads。
- Validate event and candidate-summary payloads before response writes。
- A disconnected client must not bypass cleanup、ownership 或 idempotency。
- Candidate preparation summary is a projection of existing authority, never a second source of truth。

## Contracts

### Transport contracts

Both transports call the same service:

```yaml
POST /api/analyze/match:
  response: application/json
  authority: existing canonical Match service
  status: compatibility fallback

POST /api/analyze/match/stream:
  request:
    body:
      cvId: string
      rawJD: string
      jdRubric: object
      settings: existing session settings
    headers:
      Accept: text/event-stream
      X-Match-Request-Id: uuid
  response: text/event-stream
  authority: same canonical Match service
```

`settings` must not use `matchMode` to choose runtime behavior. A supplied legacy value is ignored during a bounded compatibility window and then rejected by request validation.

### Stream event envelope

```yaml
MatchStreamEvent:
  schemaVersion: match_stream_event_v1
  type: match_started|input_validated|stage_progress|match_completed|match_failed
  requestId: string
  sequence: integer
  occurredAt: ISODate
  stage:
    id: input_validation|role_fit_gate|cv_load|cache_lookup|evidence_match|quality_review|persistence|question_filter|complete
    label: string
    status: started|completed|skipped|failed
  data: object|null
```

Rules:

- `sequence` starts at 1 and increases by one。
- `match_started` is the first event。
- `match_completed` or `match_failed` is the final event。
- `stage.label` comes from a fixed candidate-safe map。
- A cache hit emits completed/skipped stages honestly；it does not simulate work。
- Keep-alive comments do not consume sequence numbers。
- No event carries partial score or a provisional Match result。

### Candidate-safe stage labels

| Stage | Candidate label | Meaning |
| --- | --- | --- |
| `input_validation` | Checking your inputs | Confirming the CV and job description can be analysed |
| `role_fit_gate` | Reviewing role requirements | Confirming the reviewed role scope |
| `cv_load` / `cache_lookup` | Preparing your reviewed CV | Loading approved evidence for matching |
| `evidence_match` | Matching your CV evidence | Checking support for important requirements |
| `quality_review` | Quality-checking the match | Checking that scores and evidence agree |
| `persistence` | Saving your analysis | Saving the canonical Match result |
| `question_filter` | Preparing your interview focus | Building the next-step preparation from the saved Match |
| `complete` | Match analysis complete | The persisted result is ready |

The UI must not expose `embedding`、provider、cache key、critic、prompt、schema 或 internal service names。

### Terminal event contracts

```yaml
match_completed:
  data:
    matchAnalysisId: string
    evidenceRefs: [object]
    result: MatchAnalyzeResult
    performanceTrace:
      schemaVersion: match_performance_trace_v1
      totalMs: number
      stepSummary: [object]
      slowestSteps: [object]

match_failed:
  data:
    code: NO_CONTENT|TOO_SHORT|TOO_LONG|CORRUPTED|ROLE_FIT_REVIEW_REQUIRED|MATCH_FAILED|PERSISTENCE_FAILED
    message: string
    retryable: boolean
    failedStage: string
    repairTarget: cv|jd|match|null
```

`match_failed.message` is user-safe。Stack traces、provider payloads 和 raw model output remain in redacted developer logs。

### Input normalization contract

```yaml
NormalizedMatchInput:
  rawSourceRef:
    cvId: string
    jdFingerprint: string|null
  normalized:
    cvText: string
    jdText: string
  validation:
    cv:
      characterCount: integer
      status: valid
    jd:
      characterCount: integer
      status: valid
  sanitizationVersion: match_text_sanitization_v1
```

Rules:

- Normalize a request-scoped copy；do not overwrite uploaded CV or saved JD。
- Reject invalid data before role-profile build、semantic evidence、critic、cache write 或 persistence。
- Store only sanitized metrics/version in trace；do not duplicate normalized candidate text solely for this feature。
- Preserve meaningful technical punctuation such as C++、C#、.NET、CI/CD 和 email punctuation。

### Interview preparation summary contract

This is a candidate-facing projection of existing question-pool/proof-strategy authority:

```yaml
InterviewPreparationSummary:
  schemaVersion: interview_preparation_summary_v1
  status: preparing|ready|degraded
  focusAreaCount: integer
  gapCount: integer
  questionCount: integer
  focusAreas:
    - kind: evidence|gap
      label: string
      preparationHint: string
      risk: string|null
```

Projection rules:

- Build only after the final persisted Match has entered existing question preparation。
- Prefer existing `questionPoolInfo.proofStrategy` and readiness data；do not recalculate Match or invent a second plan。
- `preparationHint` may tell the candidate what kind of truthful example to prepare, but must not invent candidate facts。
- `focusAreas` is bounded and ordered by existing preparation authority。
- Do not include full prepared question text、question IDs、evidence IDs、proof points、coverage state、rank trace 或 private question metadata。
- If preparation is degraded, show the safe summary and readiness limitation without exposing internal errors。

### Frontend state contract

```yaml
matchStreamState:
  status: idle|connecting|running|completed|failed
  requestId: string|null
  lastSequence: integer
  currentStage: string|null
  completedStages: [string]
  error:
    code: string
    message: string
    retryable: boolean
    repairTarget: cv|jd|match|null
  result: MatchAnalyzeResult|null

interviewPlanState:
  status: idle|preparing|ready|degraded|failed
  summary: InterviewPreparationSummary|null
  sessionId: string|null
  error:
    message: string
    retryable: boolean
```

Rules:

- `generateInterviewPlan` may run only after `matchStreamState.status=completed` and `result.matchAnalysisId` exists。
- Match result renders immediately after canonical completion。
- Plan preparation never returns Match UI to loading skeleton。
- Plan retry does not rerun a valid Match。
- Progress UI never derives a score。

### Idempotency contract

```yaml
MatchRequestIdentity:
  requestId: uuid
  userId: owner_ref
  cvId: string
  jdFingerprint: string|null
  settingsHash: string
  status: running|completed|failed
  matchAnalysisId: string|null
```

- Repeating a completed request ID returns/replays the existing terminal result。
- Repeating a running request does not start a second model/critic execution。
- Another user cannot query or reuse the request ID。
- Identity stores refs/hash/status，not raw CV/JD。

## Event Flow

```text
Client POST /analyze/match/stream
  -> match_started
  -> input_validation started/completed
  -> existing role-fit/CV/cache/Match/quality stages
  -> persistence completed
  -> match_completed(final persisted Match)
  -> existing question preparation starts
  -> interviewPlanState preparing
  -> interviewPlanState ready|degraded|failed
```

The stream reporter observes current orchestration。It must not decide scoring、skip safeguards、build a second Match or expose private preparation artifacts。

## Failure Modes

| Failure | Required behavior | Retry |
| --- | --- | --- |
| Invalid CV/JD before headers | Normal 400 JSON error or immediate safe failure；no expensive call | After user repairs identified input |
| Invalid CV/JD after stream starts | `match_failed` with stable code and repair target；close stream | After input repair |
| Provider/quality failure under existing fallback | Preserve current guarded policy and emit honest stage status | Existing retry/fallback policy |
| Persistence failure | Never emit `match_completed` | Same request ID |
| Question filter/pool degraded | Preserve Match result；show degraded preparation status | Plan-only retry when safe |
| Plan failure after Match | Preserve Match result；right rail offers preparation retry | Do not rerun Match |
| Disconnect before side effects | Abort cancellable work and do not persist | Same request ID |
| Disconnect after persistence begins | Finish idempotent persistence and record disconnect | Recover terminal result |
| Duplicate/reordered frontend event | Ignore `sequence <= lastSequence` and detect gaps | Reconnect/recover |
| Candidate-summary projection error | Hide unsafe detail and show degraded preparation state | Repair projection/plan only |

## BDD Scenarios

```gherkin
Scenario: Clean reviewed inputs use the existing full Match
  Given a reviewed CV and a reviewed Role-Fit JD
  When the user starts a streaming Match
  Then the backend runs the same guarded canonical matcher as the JSON route
  And no fast or simplified branch is selected
  And the final event contains a persisted matchAnalysisId

Scenario: Corrupted CV is rejected before expensive work
  Given a CV containing an excessive run of invalid special characters
  When the user starts a Match
  Then the request fails with CORRUPTED
  And no embedding, LLM, critic, cache write, Match record or question filter is invoked

Scenario: Valid technical punctuation is preserved
  Given a valid CV containing C++, C#, .NET, CI/CD and email punctuation
  When input normalization runs
  Then the content remains valid
  And meaningful technical tokens remain available to the matcher

Scenario: JSON and stream results are equivalent
  Given identical reviewed inputs and frozen mock providers
  When one request uses JSON and another uses streaming
  Then both final results have identical scoring, decision and evidence
  And both obey the same persistence and question-filter rules

Scenario: Progress never exposes internal reasoning
  Given the quality safeguard requests a recompare
  When stage progress is streamed
  Then the candidate sees a plain-language quality-check stage
  And no critic prompt, raw response, private evidence excerpt or chain-of-thought is emitted

Scenario: Only canonical completion starts interview planning
  Given several progress events have arrived without match_completed
  When the user remains on Analyze
  Then generateInterviewPlan is not called
  And no partial score is treated as completed

Scenario: Match remains visible while preparation runs
  Given match_completed contains a persisted matchAnalysisId
  And question preparation is still running
  When Analyze renders
  Then the complete Match result is visible
  And the preparation panel says Preparing your interview focus
  And the right rail says Preparing your interview session

Scenario: Ready preparation shows a safe summary
  Given the existing proof strategy is ready
  When the candidate summary is projected
  Then it includes focus count, gap count, question count, focus labels, hints and risks
  And each hint uses existing candidate-safe guidance

Scenario: Preparation does not expose the question pool
  Given the prepared pool contains private question text, evidence IDs and rank trace
  When the Analyze response and UI are rendered
  Then none of those private fields are present
  And only the allowlisted preparation summary is shown

Scenario: Preparation failure does not rerun Match
  Given the Match completed and question preparation failed
  When the user retries interview preparation
  Then the saved Match remains visible
  And the canonical Match is not recomputed

Scenario: Persistence failure is terminal
  Given the stream has emitted match_started
  And Match persistence fails
  When the controller handles the failure
  Then it emits exactly one match_failed event with PERSISTENCE_FAILED
  And it never emits match_completed

Scenario: Retry does not duplicate persisted state
  Given a stream disconnects after persistence begins
  When the client retries with the same X-Match-Request-Id
  Then the backend does not start a second canonical Match
  And at most one matchAnalysisId and one question-filter side effect exist
```

## Implementation Boundaries

### Backend

- Keep `analyzeController` thin；delegate stream formatting、idempotency and progress reporting。
- Reuse `runCvJdMatchAnalysis`；do not fork a stream-specific matcher。
- Add a small progress-reporter interface at existing orchestration boundaries。
- Keep existing JD question filter、pool composer、preparation and proof strategy as preparation authority。
- Build only a bounded candidate projection from existing readiness/proof-strategy output。
- Remove Fast Match and provisional ATS/tailoring output only after active-consumer and saved-record compatibility checks。
- Preserve JSON fallback during rollout。

### Frontend

- Add a stream API wrapper using existing stream client。
- Parse frames in a focused utility/hook；do not put protocol parsing in `AnalyzePage`。
- Add an Analyze-specific `MatchProgressPanel`；do not modify shared `LoadingInsightPanel` used by Report。
- Separate Match and plan state in `AnalyzePage`。
- Enhance existing `ProofStrategyReviewPanel` instead of adding ATS or CV-improvement sections。
- Keep current detailed Match evidence inside `AnalysisStatusCard`。
- Keep `AnalyzeActionsCard` in the 380px action rail and change status/action only。

### Locked shared UI boundaries

- Do not change shared `AppHeader` or top `StepProgress`。
- Do not reorder the six cards controlled by `AnalysisWorkflowShell`。
- Do not change global `Card`、`Button`、`StatusBanner` or design tokens for this feature。
- Do not change other pages through common component behavior。
- Preserve desktop `minmax(0,1fr) + 380px` and current mobile sticky-action behavior。

### Data and observability

- Reuse `performanceTrace` request correlation and stage timing。
- Add request ID/event counts without candidate content。
- Do not create a stream-only Match collection or second preparation record。
- Match record and plan state remain separate；question generation starts only from persisted Match。

## Rollout Plan

| Phase | Scope | Exit gate |
| --- | --- | --- |
| MIP-P0 | Consumer audit、single-path contracts、rejected-field removal plan | Tests identify all active Fast/ATS/tailoring consumers and protect saved-record readability |
| MIP-P1 | Input guard hardening | Unit/API tests prove stable errors and zero downstream calls |
| MIP-P2 | Backend stream route、reporter、idempotency | Sequence/parity/disconnect/persistence tests pass |
| MIP-P3 | Frontend real progress and Match/plan state separation | Focused Vitest、lint and browser state flow pass |
| MIP-P4 | Enhanced preparation-priority panel | Projection allowlist、privacy、responsive and component tests pass |
| MIP-P5 | Broad regression and human review | Backend `test:all`、frontend `quality:all`、browser evidence and human review pass |

Transport rollout may use `ENABLE_MATCH_STREAMING`。The flag controls delivery availability only；it never selects a different Match algorithm。

## Acceptance Criteria

- [x] No runtime Fast Match branch or user-facing mode selector remains。
- [x] Provisional ATS/tailoring fields are removed；no ATS/CV-improvement UI exists。
- [x] Clean input preserves full Match semantics。
- [x] Invalid input is rejected before matcher work with stable repair-targeted errors。
- [x] Stream emits ordered allowlisted events and exactly one terminal event。
- [ ] JSON and stream final-result parity is 100% on frozen fixtures。
- [x] Only persisted `match_completed` triggers interview preparation。
- [x] Match remains visible while preparation is preparing、degraded 或 failed。
- [x] Ready UI shows bounded focus/gap/question counts、hints and risks from existing proof strategy。
- [x] Full prepared questions、private evidence IDs and ranking artifacts never reach candidate payload/UI。
- [ ] Retry/disconnect tests prove at-most-once persistence and no duplicate session side effects。
- [x] Shared header、steps、action rail geometry、common primitives and shared loading behavior remain unchanged。
- [x] Focused backend/frontend tests and mocked desktop browser Voice-entry flow pass。
- [x] Real-provider/production claims remain pending until separately approved and evidenced。

## Verification

### Unit tests

- `textProcessing` normalization、valid technical punctuation and all validation codes。
- Stream envelope/schema、stage map、sequence and terminal-event rules。
- Candidate preparation projection allowlist and degraded fallback。
- Frontend stream parser/reducer and Match/plan state reducer。

### Integration tests

- Authenticated owner-scoped stream route。
- Invalid-input no-downstream-call assertions。
- JSON/stream final parity with frozen mock providers。
- Cache hit、quality recompare、question-filter warning and persistence-failure sequences。
- Disconnect/retry/idempotency behavior。
- Only persisted completion starts question preparation。
- Candidate response excludes private pool/proof/rank fields。

### Browser checks

- User sees real stage progress instead of an indefinite/timer-driven spinner。
- Error copy returns to the correct CV/JD review step。
- Match result appears before question preparation finishes。
- Preparation ready/degraded/failed states do not hide Match。
- Right rail transitions from Generate → preparing → Start/Retry without moving。
- Header、top progress、six-step workflow and other pages are unchanged。
- Desktop、tablet and mobile preserve current layout/sticky behavior。

### Eval and human review

- Frozen cases for corruption、technical punctuation、privacy projection and request replay。
- Human review of at least 12 varied CV/JD pairs for preparation usefulness and clarity。
- Measure first-event latency、total runtime、added orchestration overhead and longest silent interval。
- Do not run paid real-AI eval without approval。

### Commands

```bash
cd backend
npm run test:match
npm run test:questions
npm run test:contracts
npm run test:server
npm run lint
npm run test:all

cd ../frontend
npm run test:all
npm run lint
npm run quality:all
```

Spec completeness:

```bash
python3 /Users/heminghan/.codex/skills/spec-driven-development-blueprint/scripts/spec_lint.py docs/jobsync-match-optimization-spec.md --format json
```

## Rollback

- Disable stream transport and fall back to existing JSON endpoint。
- Keep the same canonical Match service and saved-record readers。
- If the enhanced preparation projection fails privacy or clarity gates, fall back to the current `ProofStrategyReviewPanel`。
- Do not restore Fast Match、ATS guidance 或 CV-improvement UI as a rollback。

## Unresolved Decisions

No product-direction decision blocks this spec。Implementation review still must confirm:

1. bounded compatibility duration for legacy request/output fields；
2. storage location and TTL for request-idempotency records；
3. whether recovery replays terminal events or adds an owner-scoped status endpoint；
4. whether question preparation progress remains in the Match stream or uses the existing plan request state after `match_completed`。

These choices affect implementation detail, not the single-Match → interview-preparation direction。

Evidence status：2026-07-26 local product code 已完成 single-path cleanup、input guard、canonical SSE、Match/plan state separation、preparation UI 和 mocked browser Voice entry。Durable retry/idempotency、explicit JSON/stream frozen-fixture parity、disconnect recovery、tablet/mobile manual review、real-provider 与 production gate 仍未完成。
