# Marker Review Guide

Status: current implementation guide, aligned with code on 2026-06-23.

## Recommended review path

1. Read `README.md` for setup, routes, and the product boundary.
2. Read `docs/implementation-workflows.md` for the end-to-end runtime flow.
3. Read `docs/implementation-functions.md` for the workflow-defining service map.
4. Use `docs/code-document-alignment.md` before describing a feature as implemented.
5. Use `docs/testing-and-evaluation.md` to select checks. Real-provider evals require credentials, cost awareness, and explicit approval.
6. Read `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` before judging or changing voice behavior.

## Safest demonstration

Use the authenticated text-interview path:

```text
CV upload or selection
-> CV match-field review
-> pasted JD parsing and review
-> CV-JD match
-> interview plan and prepared question pool
-> text interview
-> report generation, QA, and bounded repair
-> evidence sources, turn breakdowns, transcript risks, and export
```

Text mode avoids microphone, STT, TTS, and live WebSocket provider dependencies.

## Features that are implemented and product-wired

- Google authentication, protected API routes, CSRF protection, rate limiting, and ownership checks on the main user-owned resources.
- PDF/DOCX CV extraction, recent-CV reuse, match-field review, rebuild, soft delete, and safe export.
- Pasted JD parsing, safeguard critic/reparse logic, human review, and optional company-value enrichment.
- CV-JD matching, evidence references, JD question filters, CV question seeds, and prepared question pools.
- Adaptive text and voice interviews with explicit question metadata, transcript-based question deduplication, and safe pool exhaustion.
- Azure-first speech routing with independently configured ElevenLabs STT/TTS fallback; STT provider selection occurs when the speech session starts.
- Resumable voice recording with browser IndexedDB, chunk manifests, retry/recovery, asynchronous MP3 conversion, and recording status UI.
- Evidence-grounded reporting from accepted interview answers, question-specific assessment rubrics, deterministic scores, transcript-risk warnings, claim-level evidence rows, QA, and up to two grounded wording-repair attempts.
- PostgreSQL/pgvector runtime retrieval, MongoDB AI artifacts, usage/cost aggregation, diagnostics, robustness tests, browser E2E tests, and opt-in real-AI eval runners.

## Claims that need qualification

- Voice is wired but still requires live verification with the configured speech providers, authenticated WebSocket access, browser permission, network conditions, and a real microphone.
- The 256-dimensional weighted hash embedding is an MVP retrieval mechanism, not a production semantic-embedding claim.
- The retention audit, approved cleanup pipeline, queued-job worker, quarantine, and backup services exist. The worker is disabled by default, and account-wide deletion and encryption-at-rest guarantees remain incomplete.
- Privacy modal copy that mentions account cancellation or automatic 12-month deletion is not proof of an implemented self-service account-deletion flow.
- Usage-cost output is an estimate, not billing-grade accounting or market validation. DeepSeek and Azure are priced; ElevenLabs usage is recorded with zero estimated cost until provider-specific pricing is added.
- Report repair is bounded and conditional. Deterministic integrity failures are not hidden by an LLM rewrite.
- JD input is pasted text. JD file upload is not implemented.

## Document status rules

- `README.md`, `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`, and the current guides named above describe present behavior.
- Files with dates in their names are point-in-time audits, plans, or design records unless their header says otherwise.
- Files named `*-plan.md`, `*-proposal.md`, or `qa.md` are planning history and must not be used alone as proof of implementation.
- Generated reports under `backend/eval/reports/` and `backend/eval/googleAgentsCli/reports/` record a specific evaluation run; they are not evergreen architecture documentation.

## Current high-value code references

| Area | References |
| --- | --- |
| Application routes | `backend/src/api.js`, `backend/src/api/routes/`, `frontend/src/App.jsx` |
| Interview selection and deduplication | `backend/src/services/questions/`, `backend/src/services/agents/interviewerAgent.js` |
| Voice routing | `backend/src/services/voice/realtimeSpeechProviderRouter.js`, `backend/src/services/voice/ttsProviderRouter.js` |
| Resumable recording | `backend/src/services/recording/`, `frontend/src/runtime/recording/` |
| Report integrity | `backend/src/services/agents/reportGeneratorAgent.js`, `backend/src/services/agents/reportQaAgent.js`, `backend/src/services/report/` |
| Report UI | `frontend/src/pages/ReportPage.jsx`, `frontend/src/components/report/`, `frontend/src/utils/reportView/` |
| Tests and evals | `backend/tests/`, `backend/eval/`, `frontend/src/**/*.test.*`, `frontend/e2e/` |
