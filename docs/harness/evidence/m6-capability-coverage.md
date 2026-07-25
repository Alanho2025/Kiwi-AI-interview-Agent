# M6 Capability Coverage Evidence

- Generated: 2026-07-26T11:00:23+12:00
- Status: `LOCAL_PASS`
- Mode: `shadow` / `observe`

## Verified locally

- The existing controller-owned registry remains the only runtime capability surface.
- Five fixed capability policies exist: `retrieval`, `interviewer`, `reportGenerator`, `reportQa`, and `interviewEvaluator`.
- The three formal tasks remain `interview_next_turn`, `generate_report`, and `qa_report`.
- Runtime coverage is derived from the actual `Object.keys(agentRegistry)` passed to the controller wrapper.
- Each observed call records capability ID/ref, start/completion/failure lifecycle, timestamps, duration, and error name only.
- Arguments, model prompts, candidate answers, CV/JD text, and return payloads are not copied into capability events.

## Evidence

- `backend/src/services/harness/harnessExecutableControls.js`
- `backend/src/services/masterAiService.js`
- `backend/tests/robustness/contracts/harnessExecutableControls.test.js`
- Backend `npm run test:all` passed; latest contract group 75/75.

## Open gates

- No dynamic model tool discovery was added.
- Production capability-denial telemetry and enforcement thresholds are not verified.
- DeepSeek model-call/token/cost attribution is correlated to workflow/capability when usage exists; live-provider completeness remains unverified.
