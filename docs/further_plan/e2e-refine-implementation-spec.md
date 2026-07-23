# E2E Refine Implementation Spec

狀態：final goal mode；已實作並驗證
日期：2026-07-12
Goal：[E2E Refine Implementation Goal](e2e-refine-implementation-goal.md)

## Overview

### Goal

在現有 Kiwi AI Interview Agent 測試版圖上，新增 stakeholder-grade E2E refine gate。這個 gate 不取代 backend robustness 或 eval runners，而是補上目前 browser E2E 和真資料狀態之間的缺口：direct API bypass、low-confidence voice UI、retention/deletion lifecycle、weak-network voice、barge-in interruption。

### Implementation Result

本 spec 已完成 first implementation slice。實際檔案與 script 如下：

- `frontend/e2e/review-lock-bypass.playwright.mjs`
- `frontend/e2e/retention-deletion-lifecycle.playwright.mjs`
- `frontend/e2e/voice-low-confidence-ui.playwright.mjs`
- `frontend/e2e/voice-network-barge-in.playwright.mjs`
- `frontend/e2e/helpers/e2eArtifactHelpers.mjs`
- `frontend/e2e/helpers/e2eBackendHarness.mjs`
- `frontend/e2e/helpers/e2eVoiceHarness.mjs`
- `backend/src/services/match/matchPlanGateService.js`
- `backend/eval/helpers/e2eRefineReleaseGateEvaluator.js`
- `backend/eval/runners/runE2eRefineReleaseGateEval.js`

實作和原 draft 不完全相同的地方：

- Review lock 不只看 `/api/analyze/match`。現有 match service 對 missing/stale Role-Fit review 回 `409`；另外新增 interview-plan gate，防止使用者直接帶 `manual_review` analysis payload 產生 session。
- Retention browser assertion 不再只接受 `Session not found.` 文案。現有 frontend 404 load path 可能 redirect 到 `/analysis`；E2E 把 not-found view、load error status、redirect `/analysis` 都視為 browser access-denial。
- Weak-network/barge-in E2E 先發現 backend duplex WebSocket queue 將所有 message 序列化，導致 `barge_in` 真實上無法 interrupt streaming TTS。實作已讓 `barge_in` / `cancel_assistant_audio` 這類 interrupt control payload 繞過一般 queue，並以 robustness test 與 E2E 鎖住。
- Low-confidence browser E2E first slice 驗 confirmation visible、question count unchanged、no `turn_done` before confirmation；確認後 accepted answer 的完整 saga 仍由 backend transcript-confirmation robustness tests 覆蓋。

### Users

- Product reviewer：需要知道 release 是否真的保護候選人體驗、資料生命週期與人工 review lock。
- Engineering reviewer：需要明確知道哪些 tests 是 mock visual、哪些是真 backend、哪些只是 external/live provider pending。
- Future coding agent：需要一份可直接拆任務、寫紅線測試、補 artifact、接 release gate 的 implementation spec。

### Risk Class

高。這些測試覆蓋 candidate data、voice transcript、recording artifact、review lock、session access 和 report trust。所有測試必須使用 synthetic data、test DB、tmp storage 和 test STT/TTS providers。

### Non-Goals

- 不做 real Azure / ElevenLabs / browser microphone live-provider gate。
- 不跑 real AI eval 或付費 provider。
- 不建立 production compliance claim。
- 不修改 candidate progress dashboard product。
- 不實作 transcript N-Best rerank / LLM correction / offline ASR cleanup。
- 不刪除現有 mock E2E；mock visual tests 仍是合理快速 gate。

## Current-State Comparison

| Area | Current implementation | Gap after comparison | Required change |
| --- | --- | --- | --- |
| Full human flow | `frontend/e2e/specs/full-interview-human-flow.spec.js` mock 所有 API | 只能證明 UI 渲染與 flow stitching | 保留；不要拿它宣稱 backend/RAG quality |
| Question pipeline | `frontend/e2e/specs/question-pipeline.spec.js` mock session states | 能看 browser question state，但不能驗真 backend state transition | 保留；新增 hybrid API path 補真後端 |
| Role-Fit visual | `frontend/e2e/specs/role-fit-browser-visual.spec.js` pass，產出 screenshots | 視覺 gate 已補，但資料仍 mock | 保留並接 aggregator |
| Voice smoke | `voice-realtime-latency.playwright.mjs` mock WebSocket / mock VAD | 穩定但不是真 backend | 保留作 browser orchestration smoke |
| Voice real backend | `voice-real-backend.playwright.mjs` 用 test STT/TTS 跑真 backend socket | 已補真 backend flow；未補 low-confidence UI、weak network、barge-in E2E | 擴充或新增 sibling scripts |
| Recording recovery | `recording-recovery.playwright.mjs` 驗 IndexedDB recovery，但 backend mocked | 沒驗真 recording_uploads/chunks 或 deletion | 新增 retention/deletion lifecycle hybrid E2E |
| Retention | `backend/tests/robustness/retention/*` 存在，並決定納入 backend `test:all`；release gate 只做 source/model/registry contract | 沒有 browser/API lifecycle gate | 保留 `test:retention` focused command；新增 hybrid E2E |
| Review lock | Frontend happy path 會 Mark CV/JD reviewed；backend service tests 擋 legacy review marker | 沒有 direct API bypass E2E | 新增 review-lock bypass hybrid E2E |
| Voice low confidence | Backend confidence gate / transcript confirmation tests 存在 | 沒有 browser UI 和 question counter E2E | 新增 voice low-confidence UI E2E |
| Weak network / barge-in | Backend/frontend unit tests 有 barge-in；real-backend voice E2E 沒 throttle / interruption | 不能回答弱網與插話體驗 | 新增 CDP network + barge-in E2E |

## Requirements

### Functional Requirements

1. E2E scripts must declare a truth level:
   - `mock_visual`
   - `mock_browser_orchestration`
   - `hybrid_backend`
   - `real_backend_voice`
   - `live_provider_required`
2. New hybrid tests must seed and use synthetic user/session/CV/JD/recording data.
3. Review-lock bypass E2E must prove direct API calls cannot create usable match/plan when required review artifacts are absent or unverified.
4. Low-confidence voice E2E must prove a contentful low-confidence transcript triggers confirmation UI and does not increment formal question count.
5. Retention/deletion E2E must prove deleted/expired test artifacts cannot be read through normal API/UI paths.
6. Weak-network voice E2E must record latency, errors, socket events and UI recovery state.
7. Barge-in E2E must prove assistant audio can be interrupted and the interruption does not become an interview question.
8. Aggregated E2E refine gate must fail when required non-SLO artifacts are missing or failed.
9. Aggregated E2E refine gate must keep current voice 3 second next-question SLO as `known_issue`, not release blocker, unless flow itself fails.

### Non-Functional Requirements

1. Default local run must be deterministic and use test providers.
2. Each browser E2E must clean up spawned servers and close browser contexts.
3. Artifacts must be bounded JSON, no raw CV, no full transcript beyond synthetic test strings, no audio payload.
4. Screenshots may be emitted only for visual gates and must live under ignored `output/playwright/`.
5. Tests must avoid sleeps as assertions; use events, DOM states, API responses or artifact checks.
6. Network throttle tests must have bounded timeout and clear failure reason.

### Security and Privacy Requirements

1. No real `.env` secrets may be printed or committed.
2. No real CV, JD, transcript, recording or user identifier may be used.
3. Retention/deletion tests must run only against test DB / tmp storage and must refuse production-looking env.
4. Direct API bypass tests must authenticate as a synthetic test user and must not use existing user records.
5. Artifact reports must redact tokens, cookies, storage keys and direct personal contact fields.

## Contracts

```yaml
scripts:
  frontend:
    test:e2e:review-lock: "node e2e/review-lock-bypass.playwright.mjs"
    test:e2e:voice-low-confidence: "node e2e/voice-low-confidence-ui.playwright.mjs"
    test:e2e:voice-network-barge-in: "node e2e/voice-network-barge-in.playwright.mjs"
    test:e2e:retention-deletion: "node e2e/retention-deletion-lifecycle.playwright.mjs"
    test:e2e:role-fit-refine: "runs the four scripts above in stable order"
  backend:
    test:retention: "NODE_ENV=test AI_TEST_MODE=mock node tests/helpers/runVitestGroups.js tests/robustness/retention"
    eval:e2e-refine-release-gate: "NODE_ENV=test AI_TEST_MODE=mock node eval/runners/runE2eRefineReleaseGateEval.js"

artifacts:
  review_lock:
    path: "output/playwright/review-lock-bypass.latest.json"
    schemaVersion: "review_lock_bypass_e2e_report_v1"
  voice_low_confidence:
    path: "output/playwright/voice-low-confidence-ui.latest.json"
    schemaVersion: "voice_low_confidence_ui_e2e_report_v1"
  retention_deletion:
    path: "output/playwright/retention-deletion-lifecycle.latest.json"
    schemaVersion: "retention_deletion_lifecycle_e2e_report_v1"
  voice_network_barge_in:
    path: "output/playwright/voice-network-barge-in.latest.json"
    schemaVersion: "voice_network_barge_in_e2e_report_v1"
  aggregate:
    path: "backend/eval/reports/e2e-refine-release-gate.latest.json"
    schemaVersion: "e2e_refine_release_gate_report_v1"

aggregate_gate:
  releaseStatus:
    allowed: ["ready", "ready_with_known_issues", "blocked"]
  blockers:
    - "missing_required_artifact"
    - "review_lock_bypass_allowed_usable_match"
    - "low_confidence_incremented_question_count"
    - "retention_deleted_artifact_readable"
    - "voice_flow_failed"
    - "barge_in_not_acknowledged"
    - "browser_errors_present"
  knownIssues:
    - "voice_next_question_3s_slo_exceeded"
    - "weak_network_latency_degraded"
  external:
    - "live_azure_stt_not_run"
    - "live_elevenlabs_tts_not_run"
    - "production_retention_telemetry_unavailable"
```

### Artifact Base Shape

```json
{
  "schemaVersion": "string",
  "generatedAt": "ISO-8601",
  "passed": true,
  "truthLevel": "hybrid_backend",
  "resultType": "string",
  "assertions": ["string"],
  "knownIssues": [],
  "blockers": [],
  "browserErrors": [],
  "apiCalls": [
    { "method": "POST", "path": "/api/analyze/match", "status": 403 }
  ]
}
```

## BDD Scenarios

### Scenario: Direct match API cannot bypass review lock

```gherkin
Scenario: Unreviewed Role-Fit input cannot create a usable match
  Given a synthetic authenticated user
  And a synthetic CV record exists but the reviewed CV profile is not verified
  And the JD rubric has Role-Fit review status "unreviewed" or "edited"
  When the test sends POST /api/analyze/match directly without using the UI review buttons
  Then the response must not create a usable matchAnalysisId
  And the current implementation rejects the request with 409 when verified Role-Fit review is missing or stale
  And the artifact records "review_lock_bypass_blocked"
```

```gherkin
Scenario: Manual-review payload cannot bypass plan creation
  Given a synthetic authenticated user
  And the test builds an analysisResult with decision.label "manual_review"
  When the test sends POST /api/analyze/interview-plan directly
  Then the current implementation returns 400
  And no interview session is created
```

```gherkin
Scenario: Verified Role-Fit input still allows the normal path
  Given the same user has a reviewed CV profile
  And the JD Role-Fit review status is "verified"
  When the test sends the normal match request
  Then the response returns a usable matchAnalysisId
  And the follow-up interview-plan request can create a session
```

### Scenario: Low-confidence contentful voice transcript asks for confirmation

```gherkin
Scenario: Low-confidence transcript does not advance question count
  Given a voice interview session is in progress
  And the backend uses test realtime STT with confidence 0.28
  And the transcript has enough words to be contentful
  When the browser sends speech_start, audio chunks, and speech_end
  Then the UI shows an understanding confirmation prompt
  And currentQuestionIndex remains unchanged
  And no accepted answer is written yet
  And the artifact records "low_confidence_confirmation_visible"
```

```gherkin
Scenario: Confirmed low-confidence answer can continue
  Given a pending transcript confirmation is visible
  When the candidate confirms the transcript and adds a short clarification
  Then the answer is processed as accepted
  And the next interview question can be emitted
  And only the accepted answer / next real question affects question count
```

### Scenario: Deleted or expired session is not readable

```gherkin
Scenario: Soft-deleted session cannot be read through UI or API
  Given a synthetic user owns a completed session with report and recording status
  When the test calls DELETE /api/session/:sessionId
  Then GET /api/session/:sessionId returns 404 or an equivalent not-found response
  And GET /api/report/:sessionId cannot return sensitive report content
  And the browser route for that session shows a not-found/deleted state or redirects to a safe analysis route
```

```gherkin
Scenario: Deleted CV cannot be selected, exported, or used for match
  Given a synthetic user owns a CV file and document content
  When the test calls DELETE /api/upload/cv/:cvId
  Then GET recent CVs no longer includes that CV
  And GET /api/upload/cv/:cvId/export is rejected
  And POST /api/analyze/match with that cvId is rejected
```

### Scenario: Weak network voice flow remains recoverable

```gherkin
Scenario: Voice flow under bounded slow network emits artifact instead of hanging
  Given a real-backend voice E2E session with test STT/TTS providers
  And Playwright CDP network emulation applies 300ms RTT
  When the candidate completes one spoken answer
  Then the test receives turn_done or a bounded degraded-state event
  And the UI does not crash
  And the artifact records assistantFirstAudioMs, nextQuestionFirstAudioMs, turnDoneMs, and network profile
```

### Scenario: Barge-in interrupts assistant speech

```gherkin
Scenario: Candidate speech interrupts assistant audio without counting as a question
  Given assistant speech is active in a real-backend voice E2E session
  When the browser sends a barge_in event or VAD-triggered speech_start during assistant playback
  Then the backend emits barge_in_ack with interrupted=true
  And frontend audio queue stops or clears active playback
  And the transcript records interruption as system / acknowledgement metadata
  And currentQuestionIndex does not increment because of the interruption
```

## Implementation Notes

### E2E-R0: Inventory and Shared Helpers

- Add a small `frontend/e2e/helpers/` layer only if it removes duplication across real-backend scripts.
- Prefer reusing `voice-real-backend.playwright.mjs` server bootstrap for new real-backend voice scripts.
- Do not add a package unless explicitly approved.
- All scripts should write artifacts before throwing when possible, so failures are diagnosable.

### E2E-R1: Review Lock Bypass

- First write a failing Playwright or Node browser test that authenticates a synthetic user and calls backend APIs directly from the test process.
- Use existing `/api/analyze/match` and `/api/analyze/interview-plan`.
- The test should assert product outcome, not only HTTP status:
  - no usable matchAnalysisId for unverified input
  - no prepared question pool/session created from unsafe input
  - diagnostics explain review required
- If current code returns `200 manual_review score=0`, spec can accept it only if downstream session generation is blocked or degraded safe.

### E2E-R2: Low-Confidence Voice UI

- Use real backend + test STT/TTS providers.
- Set test env:
  - `VOICE_STT_PROVIDER_ORDER=test`
  - `VOICE_TTS_PROVIDER_ORDER=test`
  - `TEST_REALTIME_STT_CONFIDENCE=0.28`
  - `TEST_REALTIME_STT_TRANSCRIPT=<contentful synthetic answer>`
- Assert both backend events and browser UI:
  - inbound `stt_final`
  - inbound confirmation prompt / assistant text
  - visible confirmation text
  - unchanged question count
  - no browser errors
- Confirmation follow-up can be second scenario or second phase if first slice is too large.

### E2E-R3: Retention / Deletion Lifecycle

- Use test DB only; refuse to run if `NODE_ENV !== test`.
- Start with soft delete and access denial:
  - DELETE session
  - DELETE CV
  - recording status after delete must not expose downloadable audio
- Full retention cleanup saga can be separate subphase:
  - run audit dry-run
  - approve test manifest
  - run cleanup against synthetic candidates
  - assert Postgres/Mongo/tmp storage convergence
- Do not claim production telemetry.

### E2E-R4: Weak Network + Barge-In

- Use CDP `Network.emulateNetworkConditions` for bounded slow network.
- Barge-in can be driven by explicit WebSocket `barge_in` event first; VAD-driven barge-in can be added after stable event-level coverage.
- Interrupt control messages must not wait behind streaming `speak_text`; otherwise real backend cannot emit `barge_in_ack.interrupted=true` until after TTS is already done.
- Required assertions:
  - `barge_in_ack.interrupted === true`
  - no further active audio chunks are played for interrupted token
  - UI state reaches listening / user_speaking / recoverable state
  - no question count increment from interruption

### E2E-R5: Aggregated Gate

- Add backend helper `e2eRefineReleaseGateEvaluator`.
- It reads all required artifacts from `output/playwright`.
- It writes:
  - `backend/eval/reports/e2e-refine-release-gate.latest.json`
  - `backend/eval/reports/e2e-refine-release-gate.latest.md`
- The gate should be separate from Role-Fit release gate first. After stable, Role-Fit release gate can consume its summary.

## Verification

### Required Checks After Implementation

| Area | Command |
| --- | --- |
| Backend retention robustness | `cd backend && npm run test:retention` |
| Backend contracts / release gate | `cd backend && npm run test:contracts` |
| Frontend E2E review lock | `cd frontend && npm run test:e2e:review-lock` |
| Frontend E2E voice low confidence | `cd frontend && npm run test:e2e:voice-low-confidence` |
| Frontend E2E retention deletion | `cd frontend && npm run test:e2e:retention-deletion` |
| Frontend E2E voice network / barge-in | `cd frontend && npm run test:e2e:voice-network-barge-in` |
| Aggregate gate | `cd backend && npm run eval:e2e-refine-release-gate` |
| Existing Role-Fit gate | `cd backend && npm run eval:role-fit-release-gate` |
| Frontend lint | `cd frontend && npm run lint` |
| Backend lint | `cd backend && npm run lint` |
| Spec lint | `python3 /Users/heminghan/.codex/skills/spec-driven-development-blueprint/scripts/spec_lint.py docs/further_plan/e2e-refine-implementation-spec.md --format json` |
| Whitespace | `git diff --check` |

### Acceptance Criteria

1. Review lock bypass test fails before the missing guard is implemented or confirms existing guard at API level.
2. Low-confidence E2E proves visible confirmation and stable question count.
3. Retention/deletion E2E proves deleted synthetic session/CV cannot be read or reused.
4. Weak-network voice E2E completes with artifact or explicit degraded-state artifact, not timeout-only failure.
5. Barge-in E2E observes `barge_in_ack` and audio cancellation.
6. Aggregated gate reports `ready`, `ready_with_known_issues`, or `blocked`.
7. Voice next-question 3 second SLO remains known issue until a separate latency goal fixes it.
8. Docs clearly state mock vs hybrid vs live-provider boundaries.

## Rollback Plan

- New scripts should be additive. If a new E2E is flaky, remove it from aggregate gate but keep the artifact and failing evidence for triage.
- Do not delete existing mock E2E when adding hybrid tests.
- Do not change production retention behavior solely to satisfy E2E; fix service contract with backend robustness tests first.
- If CDP network emulation is unstable in local environment, keep event-level barge-in E2E as required and mark network throttle as diagnostic until stabilized.

## Resolved Decisions

1. Unsafe `/api/analyze/match` currently returns `409` for missing/stale Role-Fit review; unsafe manual-review `/api/analyze/interview-plan` returns `400`. The product contract is no usable match/plan.
2. Weak-network CDP throttle is included in `npm run test:e2e:role-fit-refine`; packet loss and live provider checks remain optional diagnostics.
3. E2E-R3 first implementation covers soft delete + access denial. Full retention cleanup saga remains in backend robustness/cleanup scripts.
4. `tests/robustness/retention` is included in backend `npm run test:all`, while `npm run test:retention` remains available as a focused command.
