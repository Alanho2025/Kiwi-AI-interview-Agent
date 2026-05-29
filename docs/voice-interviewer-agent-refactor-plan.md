# Voice Interviewer Agent Refactor Plan

Branch: voice-interviewer-clean-refactor
Target branch: main
Status: Phase 0 planning
Runtime code changed: no

## Goal

Improve the live voice interviewer while preserving the current adaptive interview flow.

The target outcome is a more natural voice interviewer with shorter follow-up questions, safer wording, and no regression to current voice telemetry or latency traces.

## Files in scope

- backend/src/services/agents/interviewerAgent.js
- backend/src/services/agents/interviewerAgentQuestionBuilder.js
- backend/src/services/aiControl/interviewModeGuard.js

## Rules

- Do not edit main directly.
- Keep documentation, tests, refactor, and behaviour changes in separate phases.
- Follow the existing Phase 2 safe refactoring plan.
- Write behaviour contracts before refactoring high-risk files.
- Add tests before moving runtime logic.
- Preserve response shapes, fallback behaviour, mode boundaries, and telemetry fields.

## Phase 0 - planning and contracts

Runtime behaviour change: no.

Tasks:

- Add this plan.
- Add a behaviour contract for interviewerAgent.js.
- Add a behaviour contract for interviewerAgentQuestionBuilder.js.
- Add a behaviour note for interviewModeGuard.js.
- Document exports, callers, inputs, outputs, fallbacks, LLM usage, telemetry, and test gates.

Exit gate:

- Documentation is complete.
- No runtime code is changed.

## Phase 1 - baseline tests

Runtime behaviour change: no intended change.

Tasks:

- Add tests for current question builder output shape.
- Add tests for normalizeQuestionIntent.
- Add tests for interview mode guard behaviour.
- Add tests for spoken question quality checks.

Suggested checks:

- cd backend
- npm run lint
- npm run test:agent
- npm run test:voice

If a script does not exist, record that in the pull request.

## Phase 2 - behaviour preserving refactor

Runtime behaviour change: no.

Tasks:

- Make interviewerAgentQuestionBuilder.js the single source for duplicated question builder helpers.
- Keep selected question fields unchanged.
- Keep action routing unchanged.
- Keep guard order unchanged.
- Keep trace shape unchanged.

Disallowed in this phase:

- Do not shorten question templates.
- Do not change prompt wording.
- Do not change mode guard wording.
- Do not change LLM call timing.

## Phase 3 - spoken question wording improvement

Runtime behaviour change: yes.

Tasks:

- Shorten long spoken templates.
- Avoid multi-part voice questions where possible.
- Add candidate-facing wording for internal topics.
- Add spokenSeed metadata where useful.

## Phase 4 - prompt constraint improvement

Runtime behaviour change: yes.

Tasks:

- Update generateConversationalTurn for live voice usage.
- Prefer direct one-question follow-ups.
- Keep adaptive decision context.
- Keep retrieval context.
- Keep fast answer understanding.

## Phase 5 - mode guard fallback cleanup

Runtime behaviour change: yes, limited wording change.

Tasks:

- Shorten fallback text in interviewModeGuard.js.
- Keep mode detection logic unchanged.
- Keep technical and behavioural boundaries unchanged.

## Phase 6 - spoken output diagnostics

Runtime behaviour change: warning-only first.

Tasks:

- Add diagnostics for long spoken questions.
- Add diagnostics for multiple-question patterns.
- Add diagnostics for internal topic wording.
- Do not block or rewrite output until warnings are reviewed.

## Phase 7 - regression check

Tasks:

- Run backend lint.
- Run agent tests.
- Run voice tests.
- Run robustness eval if available.
- Run latency benchmark if available.
- Record unavailable scripts in the pull request.

## Merge strategy

Use staged pull requests:

1. documentation and contracts
2. baseline tests
3. behaviour preserving refactor
4. spoken template improvements
5. prompt constraint improvements
6. mode guard fallback cleanup
7. diagnostics and final regression check
