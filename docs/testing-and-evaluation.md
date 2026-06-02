# Testing and Evaluation Guide

This document explains how testing and evaluation are organised in the current `Alan-workplace` branch.

## Testing strategy

The project uses a robustness-first testing strategy. Normal startup and manual clicking prove that the app can run. Automated tests focus on edge cases, workflow contracts, fallback behavior, and regressions that are easy to miss during a demo.

## Backend commands

Run from `backend/`.

```bash
npm run lint
npm run test:all
npm run test:questions
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
| `npm run test:all` | Runs all mock-mode robustness groups |
| `npm run test:questions` | Runs question pipeline robustness tests |
| `npm run test:report` | Runs report robustness tests |
| `npm run test:voice` | Runs voice robustness tests |
| `npm run eval:local` | Runs local deterministic evals without real provider calls |
| `npm run eval:real` | Runs real provider-backed evals where configured |
| `npm run eval:all` | Runs the plan eval suite |
| `npm run quality:local` | Runs lint, robustness tests, and local evals |
| `npm run quality:all` | Runs local checks and real eval checks |

## Frontend commands

Run from `frontend/`.

```bash
npm run lint
npm run test:all
npm run test:voice
npm run test:e2e:question-pipeline
npm run test:e2e:voice-latency
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
- Interview micro-planning
- Interview turn orchestration
- Follow-up question behavior
- Question metadata persistence
- Report generation and grounding
- Report QA behavior
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

- Live voice E2E depends on Azure Speech credentials, browser microphone access, authenticated WebSocket state, and network health.
- CV-JD match calibration should be expanded with more weak, partial, transition, overqualified, and noisy cases before broad claims are made.
- Route-level ownership tests should be expanded across CV, session, report, transcript, recording, and RAG resources.
- Cost-benefit analysis must be completed in the final report using measured usage data and clearly stated assumptions.
