# Kiwi AI Interview Agent

Kiwi AI Interview Agent is a CV and job-description grounded interview coaching platform. It helps a candidate upload a CV, review parsed CV evidence, paste and review a structured job description, generate a CV-JD match analysis, run a text or voice mock interview, and receive an evidence-grounded feedback report with QA checks.

This repository is prepared for academic marking. The project is not a simple chatbot. It is a compound AI system that combines a React frontend, an Express backend, PostgreSQL, MongoDB, RAG retrieval, LLM-backed reasoning, routed Azure/ElevenLabs speech providers, WebSocket voice interaction, report QA and bounded repair, diagnostics, and robustness tests.

## Marker quick links

| Need | File |
| --- | --- |
| Rubric-facing overview | `docs/marker-review-guide.md` |
| End-to-end workflow | `docs/implementation-workflows.md` |
| Key services and functions | `docs/implementation-functions.md` |
| Testing and evaluation plan | `docs/testing-and-evaluation.md` |
| Code-to-document alignment | `docs/code-document-alignment.md` |
| Living repo-docs guide, sync check, and change-log source for repo questions | `repo-docs/README.md` |
| Collaboration and AI-agent rules | `AGENTS.md` |

## Product problem

Generic interview practice tools often ask broad questions and give broad feedback. They do not reliably use the candidate's actual CV, the target job description, previous answers, or evidence from the interview transcript.

Kiwi AI Interview Agent addresses this gap by turning CV evidence and JD requirements into a controlled interview workflow. It supports personalised question preparation, adaptive follow-up, voice or text delivery, and evidence-grounded reporting.

## Commercial logic

The system is designed as a SaaS-style interview coaching product. It can create value by reducing repeated manual coaching effort and by giving candidates role-specific practice at lower marginal cost than human coaching.

The final report should connect this product logic to subscription or pay-per-session pricing, saved human coaching time, provider cost per session, reliability checks, and comparison with generic interview chatbots or manual mock interviews.

## Current implemented workflow

```text
Google login
  -> upload or select CV
  -> parse CV into profile and match evidence
  -> user reviews parsed CV match fields
  -> paste JD
  -> parse JD into a guarded structured rubric
  -> user reviews structured JD rubric
  -> run CV-JD match analysis
  -> build JD question filter and match evidence
  -> generate interview plan and prepared question pool
  -> start text or voice interview
  -> adaptive controller selects follow-up or next question
  -> transcript and question metadata are stored
  -> interview ends by question limit, time limit, or manual end
  -> accepted question/answer pairs form the canonical report-turn dataset
  -> report is generated from CV, JD, plan, pool, and transcript evidence
  -> report QA checks grounding, score consistency, rubric use, rewrites, and transcript risks
  -> failed QA may run at most two grounded wording-repair attempts
  -> versioned report is stored as ready, ready after repair, needs review, or repair failed
```

## Why this is a compound AI system

| Layer | Implementation role |
| --- | --- |
| Input agents | CV upload, CV parsing, JD parsing, JD safeguard checks, human review gates |
| Retrieval layer | Session artifact indexing, CV/JD/transcript retrieval, prepared question pool retrieval, knowledge retrieval |
| Reasoning layer | CV-JD match analysis, evaluator, answer understanding, decision context, action planning |
| Action layer | Interview question generation, voice TTS streaming, transcript persistence, report generation |
| Quality layer | Report QA, QA repair orchestration, claim grounding, diagnostics, test and eval runners |
| Memory and trace layer | Transcript metadata, decision records, user coaching memory, latency traces, AI usage events |

The system uses LLMs, but it does not rely on one large prompt alone. It builds structured evidence first, then uses controller logic and guardrails to decide what to do next.

## Main user-facing features

- Google login and protected routes
- CV upload and recent CV reuse
- PDF and DOCX text extraction
- CV profile parsing and match-field human review
- Pasted JD parsing into a structured rubric
- JD safeguard checks and human review
- CV-JD match analysis with strengths, gaps, evidence references, and fit signals
- Interview setup with question-limited or time-limited modes
- Technical, behavioural, or combined interview focus
- Text interview flow with pause, resume, repeat, reply, end, and transcript export
- Product-wired voice interview through WebSocket, STT, transcript gating, adaptive turn handling, and TTS streaming
- Independent STT/TTS provider routing with Azure as the default and ElevenLabs as the configurable fallback; STT provider selection occurs when the speech session starts
- Prepared question pool based on CV seeds, JD filters, match gaps, and interview settings
- Adaptive follow-up based on candidate answers and coverage state
- Prepared-pool and live transcript-based question deduplication, including a safe wrap-up when no unique question remains
- Evidence-grounded report generation
- Canonical accepted-answer report dataset, question-specific rubrics, evidence sources, transcript-risk warnings, score breakdowns, and communication authenticity feedback
- Bounded report QA repair with post-rewrite grounding, report versions, repair history, and explicit report statuses
- Resumable voice recording through IndexedDB, idempotent chunk upload, background recovery, asynchronous MP3 conversion, status polling, and download
- Backend robustness tests, frontend tests, Playwright E2E, and AI eval runners

## Current technology stack

### Frontend

- React 19
- Vite 6
- React Router 7
- Tailwind CSS 4
- Google OAuth frontend integration
- WebSocket voice hooks
- Browser microphone APIs
- Vitest, Testing Library, and Playwright E2E scripts

### Backend

- Node.js 20+ runtime, with Node.js 22 recommended
- Express 4
- PostgreSQL through `pg`
- MongoDB through Mongoose and the MongoDB driver
- Google OAuth verification
- JWT authentication
- CSRF and rate limiting middleware
- LLM provider integration
- Azure Speech SDK and ElevenLabs STT/TTS HTTP/WebSocket integrations
- WebSocket server through `ws`
- Vitest robustness tests and real AI eval runners

## Repository structure

```text
.
├── README.md
├── AGENTS.md
├── PLAN.md
├── docs/
│   ├── marker-review-guide.md
│   ├── implementation-workflows.md
│   ├── implementation-functions.md
│   ├── testing-and-evaluation.md
│   ├── code-document-alignment.md
│   ├── commercial-product-plan.md
│   ├── full-code-review-plan.md
│   └── version-history.md
├── backend/
│   ├── index.js
│   ├── package.json
│   ├── eval/
│   ├── tests/
│   └── src/
│       ├── api/
│       ├── controllers/
│       ├── db/
│       ├── middleware/
│       ├── repositories/
│       ├── services/
│       └── utils/
└── frontend/
    ├── package.json
    ├── e2e/
    └── src/
        ├── api/
        ├── components/
        ├── hooks/
        ├── pages/
        └── utils/
```

## Key backend areas

| Area | Key paths |
| --- | --- |
| Routes and controllers | `backend/src/api/routes/`, `backend/src/controllers/` |
| CV processing | `backend/src/services/cv/`, `backend/src/controllers/uploadController.js` |
| JD processing | `backend/src/services/jobDescription/`, `backend/src/controllers/jobDescriptionController.js` |
| Match analysis | `backend/src/services/match/`, `backend/src/services/cv/matchAnalysisRecordService.js` |
| Question pipeline | `backend/src/services/questions/` |
| Interview AI control | `backend/src/services/masterAiService.js`, `backend/src/services/aiControl/`, `backend/src/services/agents/interviewerAgent.js` |
| Voice pipeline | `backend/src/api/duplexVoiceSocket.js`, `backend/src/services/voice/` |
| Recording pipeline | `backend/src/services/recording/`, `backend/src/repositories/recordingUploadRepository.js`, `frontend/src/runtime/recording/` |
| Report generation and QA | `backend/src/services/agents/reportGeneratorAgent.js`, `backend/src/services/agents/reportQaAgent.js`, `backend/src/services/report/` |
| Retrieval and RAG | `backend/src/services/retrieval/`, `backend/src/scripts/importInterviewKnowledge.js` |
| Tests and eval | `backend/tests/`, `backend/eval/` |

## API summary

Base path: `/api`

### Health

- `GET /api/health`

### Auth

- `GET /api/auth/csrf`
- `GET /api/auth/google/config`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Upload and CV review

- `POST /api/upload/cv`
- `GET /api/upload/recent-cvs`
- `POST /api/upload/select-cv`
- `POST /api/upload/cv/:cvId/review-profile`
- `POST /api/upload/cv/:cvId/rebuild-profile`
- `DELETE /api/upload/cv/:cvId`
- `GET /api/upload/cv/:cvId/export`

### JD, analysis, and plan generation

- `POST /api/job-description/paraphrase`
- `POST /api/job-description/company-values/enrichment`
- `POST /api/analyze/match`
- `POST /api/analyze/interview-plan`

### Interview

- `POST /api/interview/start`
- `POST /api/interview/warm-adaptive`
- `POST /api/interview/reply`
- `POST /api/interview/realtime-voice-turn`
- `POST /api/interview/realtime-voice-turn-stream`
- `POST /api/interview/repeat`
- `POST /api/interview/pause`
- `POST /api/interview/resume`
- `POST /api/interview/end`
- `POST /api/interview/synthesize`
- `GET /api/interview/:sessionId/question-diagnostics` — disabled when `NODE_ENV=production`

### Sessions

- `POST /api/session/save`
- `GET /api/session/history`
- `GET /api/session/:sessionId`
- `POST /api/session/resume`
- `DELETE /api/session/:sessionId`

### Report and export

- `POST /api/report/generate`
- `POST /api/report/qa` — QA, or prompt-guided rewrite when `userPrompt` is supplied
- `POST /api/report/qa-check` — QA without prompt rewrite
- `GET /api/report/:sessionId`
- `POST /api/report/:sessionId/export`
- `POST /api/export/transcript`

### Recording

- `POST /api/recordings/session-audio`
- `POST /api/recordings/session-audio/uploads`
- `PUT /api/recordings/session-audio/uploads/:uploadId/chunks/:sequence`
- `POST /api/recordings/session-audio/uploads/:uploadId/finalize`
- `POST /api/recordings/session-audio/uploads/:uploadId/retry`
- `GET /api/recordings/session-audio/uploads/:uploadId/status`
- `GET /api/recordings/session-audio/:sessionId/status`
- `GET /api/recordings/session-audio/:sessionId/download`

### RAG, usage, and operations

- `POST /api/rag/import-benchmark`
- `POST /api/rag/import-interview-knowledge`
- `POST /api/rag/rebuild-session`
- `POST /api/rag/retrieve`
- `GET /api/usage/summary`
- `GET /api/usage/recent-sessions`
- `GET /api/usage/execution/:sessionId`
- `GET /api/ops-lite/summary`

### WebSocket routes

- `/api/interview/:sessionId/voice/live`
- `/api/interview/:sessionId/voice/duplex`

The backend also mounts the same Express router without `/api` for legacy frontend builds. New clients and documentation should use the canonical `/api` routes.

### Frontend routes

- Public: `/`, `/pricing`, `/contact-sales`, `/login`
- Protected: `/dashboard`, `/analysis`, `/interview/:sessionId`, `/report/:sessionId`, `/ops-lite`
- `/home` redirects to `/dashboard`

## Data layer

| Store | Role |
| --- | --- |
| PostgreSQL | Structured operational data, users, uploaded file metadata, sessions, AI usage events, and pgvector-backed runtime RAG chunks |
| MongoDB | Flexible AI-oriented records, document content, match analysis, CV/JD normalized artifacts, transcripts, versioned session reports, and coaching memory |
| Browser IndexedDB | Durable unacknowledged voice-recording chunks and resumable-upload metadata |
| Local filesystem | Development uploads, exports, resumable recording chunks, quarantined retention files, and converted MP3 recordings |

## Environment setup

### Prerequisites

- Node.js 20+, with Node.js 22 recommended
- npm
- PostgreSQL
- MongoDB
- Google OAuth client configuration
- LLM provider configuration for real AI generation and eval
- Azure Speech configuration for the default live voice path; ElevenLabs credentials are needed when its STT or TTS fallback is enabled

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

By default, the frontend calls `/api`. Vite proxies `/api` to the local backend and supports WebSocket proxying.

Relevant runtime configuration notes (most values are demonstrated in `backend/.env.example`):

- Azure is the primary STT provider and ElevenLabs is the fallback; TTS order is configured independently.
- `RECORDING_WORKER_ENABLED=true`; the worker starts only when PostgreSQL bootstrap succeeds.
- `RETENTION_WORKER_ENABLED=false`; enable it only after the retention audit/cleanup and deployment storage policy are understood.
- PostgreSQL and MongoDB can start in degraded mode unless `POSTGRES_REQUIRED` or `MONGO_REQUIRED` is enabled, but the complete product flow needs its persistence services.

## Development and test commands

### Backend

```bash
cd backend
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

### Frontend

```bash
cd frontend
npm run lint
npm run test:all
npm run test:e2e:question-pipeline
npm run test:e2e:voice-latency
npm run test:e2e:recording-recovery
npm run build
npm run quality:all
```

`eval:real`, `eval:all`, and backend `quality:all` include real-provider work and must only be run with configured credentials, cost/quota awareness, and explicit approval. Backend `test:all` runs the groups listed in `backend/package.json`; it does not currently include every unit, retention, or interview test file.

## Safe demo path

For the most stable marker demo:

1. Start PostgreSQL and MongoDB.
2. Start backend.
3. Start frontend.
4. Login with Google.
5. Upload a CV.
6. Review the parsed CV match fields.
7. Paste a JD.
8. Generate and review the structured JD rubric.
9. Run CV-JD match.
10. Generate the interview plan.
11. Start text interview mode.
12. Complete the interview.
13. Open the report page.
14. Show evidence badges, source snippets, turn rubrics, transcript-risk warnings, score breakdown, coaching, QA status, and commercial stress-test information where available.

Voice mode is product-wired, but it should only be demonstrated when credentials for the configured Azure/ElevenLabs speech-provider order, browser microphone permission, authenticated WebSocket access, and a live in-progress interview session are all working in the same environment.

## Honest limitations

- Voice mode is wired, but live quality depends on the configured speech-provider credentials, browser audio permissions, WebSocket connection health, and microphone conditions. Provider fallback occurs when a speech session starts; an active STT turn is not switched mid-recording.
- Recording upload is resumable and MP3 conversion is asynchronous. Report viewing does not prove that recording conversion has finished; the report page exposes recording state separately.
- Some preparation steps are resilient by design. If CV seeds, JD filters, or prepared question pool creation fail, the system may fall back instead of blocking the interview.
- The deterministic local embedding is acceptable for MVP retrieval experiments, but a production semantic retrieval plan would need a stronger embedding model.
- A retention audit/cleanup pipeline and disabled-by-default worker exist, but account-wide deletion, encryption-at-rest guarantees, and deployment-specific retention operations remain incomplete.
- Privacy UI wording about account cancellation or automatic 12-month deletion is ahead of the implemented self-service backend flow and must not be treated as an enforced guarantee.
- Some ownership checks and route-level tests still need hardening before production use.
- Commercial value evidence must be supported by the final report's market analysis and cost-benefit analysis. The repository provides implementation and measurement hooks, not market proof by itself.
- Cost estimates currently price DeepSeek and Azure Speech. ElevenLabs usage events are recorded but carry zero estimated cost until a provider-specific pricing model is added.
- Report generation performs QA and may run at most two grounded wording-repair attempts. Deterministic integrity failures skip wording repair, and unresolved output remains `needs_review` or `repair_failed`; this is not an unbounded self-healing loop.

## How to read this repository for marking

1. Read `docs/marker-review-guide.md` first.
2. Read `docs/implementation-workflows.md` for the full product workflow.
3. Read `docs/implementation-functions.md` for the key service/function map.
4. Run the safe demo path in text mode.
5. Use `docs/testing-and-evaluation.md` to select a test command set.
6. Use `docs/code-document-alignment.md` to check which claims are implemented, partial, or future work.
