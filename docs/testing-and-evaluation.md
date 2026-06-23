# Testing and Evaluation Guide

This document explains how testing and evaluation are organised in the current `Alan-workplace` branch, aligned with package scripts on 2026-06-23.

## Testing strategy

The project uses a robustness-first testing strategy. Normal startup and manual clicking prove that the app can run. Automated tests focus on edge cases, workflow contracts, fallback behavior, and regressions that are easy to miss during a demo.

## Backend commands

Run from `backend/`.

```bash
npm run lint
npm run test:all
npm run test:questions
npm run test:recording
npm run test:report
npm run test:voice
npm run eval:local
npm run eval:real
npm run eval:all
npm run quality:local
npm run quality:all
```

| Command | Purpose |
| --- | --- |
| `npm run lint` | Runs backend ESLint |
| `npm run test:all` | Runs the package-script integration and robustness groups listed in `backend/package.json` (98 test files at the alignment date) |
| `npm run test:questions` | Runs question pipeline robustness tests |
| `npm run test:recording` | Runs recording robustness tests |
| `npm run test:report` | Runs report robustness tests |
| `npm run test:voice` | Runs voice robustness tests |
| `npm run eval:local` | Runs local deterministic evals without real provider calls |
| `npm run eval:real` | Runs real provider-backed evals where configured |
| `npm run eval:all` | Runs the 15-suite plan eval, including real-provider CV/JD/SEEK/match/interview/report/baseline evals; requires credentials and cost approval |
| `npm run quality:local` | Runs lint, robustness tests, and local evals |
| `npm run quality:all` | Runs local checks and real eval checks |

`test:all` does not currently include `backend/tests/unit`, `backend/tests/robustness/retention`, or `backend/tests/robustness/interview`. Run those paths explicitly when changing those areas; do not describe `test:all` as every test file in the repository.

## Frontend commands

Run from `frontend/`.

```bash
npm run lint
npm run test:all
npm run test:voice
npm run test:e2e:question-pipeline
npm run test:e2e:voice-latency
npm run test:e2e:recording-recovery
npm run build
npm run quality:all
```

| Command | Purpose |
| --- | --- |
| `npm run lint` | Runs frontend ESLint |
| `npm run test:all` | Runs frontend Vitest tests |
| `npm run test:voice` | Runs voice-related component, hook, and utility tests |
| `npm run test:e2e:question-pipeline` | Runs the browser-level question pipeline flow |
| `npm run test:e2e:voice-latency` | Runs the voice latency smoke E2E path |
| `npm run test:e2e:recording-recovery` | Runs resumable recording recovery in Playwright |
| `npm run build` | Builds the frontend |
| `npm run quality:all` | Runs lint, tests, and build |

## Recommended marker-safe validation set

For a fast but meaningful local check:

```bash
cd backend
npm run lint
npm run test:questions
npm run test:report
npm run test:voice

cd ../frontend
npm run lint
npm run test:all
npm run test:e2e:question-pipeline
npm run build
```

For full validation, use:

```bash
cd backend
npm run quality:all

cd ../frontend
npm run quality:all
```

Only run real provider-backed evals when the required environment variables are configured.

## Backend robustness coverage

Current backend robustness groups cover areas such as:

- CV parsing and reviewed profile behavior
- JD parsing and safeguard behavior
- CV-JD match and human-review guarding
- Question seed generation
- JD question filtering
- Prepared question pool creation
- Question-pool preparation and transcript-based question deduplication
- Interview micro-planning
- Interview turn orchestration
- Follow-up question behavior
- Question metadata persistence
- Report generation and grounding
- Canonical report-turn pairing, question-specific rubric selection, evidence classification, content quality, transcript risks, score consistency, and bounded QA repair
- Resumable recording chunk storage, upload contracts, worker conversion, and retry behavior
- Voice policy and duplex voice behavior
- Retrieval and RAG behavior
- Server and contract stability

## Frontend coverage

Current frontend coverage includes:

- voice interview panel behavior
- microphone permission hooks
- duplex voice session hooks
- voice activity detection utilities
- voice latency trace and summary helpers
- CV review view model
- JD human review metadata stamping
- interview page voice-mode behavior
- report UI view model behavior
- evidence-source, transcript-risk, turn-breakdown, answer-rewrite, recording-status, and score-breakdown report components
- IndexedDB recording queue, upload manager/registry, Background Sync registration, and recording recovery E2E
- question pipeline E2E flow

## Evaluation coverage

The backend `eval/` folder contains curated eval runners for:

- CV parse quality
- JD parse quality
- SEEK JD benchmark quality
- CV-JD match quality
- interview controller quality
- report QA quality
- baseline comparison
- retrieval quality
- agent trajectory quality
- company research quality
- voice quality
- stability
- preparation stability
- voice robustness
- deterministic end-to-end interview behavior

Eval reports are written to:

```text
backend/eval/reports/*.latest.json
backend/eval/reports/*.latest.md
```

## Rubric connection

| Rubric requirement | Testing/eval support |
| --- | --- |
| Technical soundness | Robustness tests for CV, JD, match, questions, report, retrieval, and voice |
| Completeness of claims | Tests and eval reports provide evidence for implemented behavior |
| Baseline comparison | Baseline eval script supports comparison against simpler alternatives |
| Trust and robustness | Safeguard, fallback, grounding, voice, and report QA tests check edge cases |
| Reproducibility | Commands and eval outputs make the project easier to inspect and rerun |

## Known validation gaps

- Live speech-provider E2E depends on Azure and/or ElevenLabs credentials according to the configured provider order, browser microphone access, authenticated WebSocket state, and network health.
- Recording recovery is browser-profile dependent; closing the originating browser before upload acknowledgement delays recovery until that profile opens the app again.
- CV-JD match calibration should be expanded with more weak, partial, transition, overqualified, and noisy cases before broad claims are made.
- Route-level ownership tests should be expanded across CV, session, report, transcript, recording, and RAG resources.
- Cost-benefit analysis must be completed in the final report using measured usage data and clearly stated assumptions.
