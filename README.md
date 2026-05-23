# Kiwi AI Interview Agent

Kiwi AI Interview Agent is a CV and job-description based interview practice platform. It helps a candidate upload a CV, parse a job description, compare the CV against the role, generate an interview plan, run a text or voice interview session, and produce a grounded feedback report.

The current codebase is no longer a toy chatbot. It now has a real React frontend, an Express backend, PostgreSQL for structured session data, MongoDB for AI artifacts, DeepSeek-backed generation paths, Azure Speech support, RAG retrieval, robustness tests, and real AI evaluation runners.

## Core workflow

```text
Login
  -> Upload or select CV
  -> Review parsed CV match fields
  -> Paste JD
  -> Parse JD into structured rubric
  -> Review parsed JD rubric
  -> Match CV against JD
  -> Generate interview plan
  -> Run text or voice interview
  -> Export transcript
  -> Generate report
  -> Run report QA
```

## Current feature status

For the full Notion-to-code documentation map, see `docs/code-document-alignment.md`.

### Implemented

- Google login flow
- Protected frontend routes
- CV upload and recent CV selection
- PDF and DOCX CV text extraction
- CV profile parsing and evidence building
- CV parse confidence and match-field human review before matching
- JD parsing, normalization, rubric building, and safeguard checks
- JD summary human review before matching, even when AI confidence is high
- CV-JD match analysis
- Guarded CV-JD match behavior for unreviewed blocked JDs and human-reviewed JDs
- Interview setup with seniority, focus area, control mode, question limit, and time limit
- Text interview session flow
- Duplex voice interview socket attachment and frontend voice shell
- Session MP3 recording upload, conversion, status, and download routes
- Pause, resume, repeat, reply, end, and report navigation
- Transcript storage and export route
- Report generation and report QA
- Session-aware retrieval, global interview knowledge retrieval, and RAG chunk indexing
- PostgreSQL + MongoDB hybrid persistence
- Structured backend logging and shared error handling
- Backend robustness tests
- Frontend voice-related unit tests
- Real AI eval runners for parser, SEEK JD benchmark, match, interview, and report quality

### In progress or partially wired

- Fine-grained ownership hardening across all resources
- Service-level test coverage for every domain service
- Further split of older broad services
- Security and governance hardening after core product flow is complete

### Voice integration status

The frontend is wired for the product-level duplex voice flow through `useVoiceInterviewSession` and `useDuplexVoiceSocket`. The backend now attaches both `attachRealtimeVoiceSocketServer(server)` and `attachDuplexVoiceSocketServer(server)` in `index.js`, so the live STT socket and the product-level duplex voice socket are both mounted from the HTTP server entry point.

Text interview mode remains the safest low-dependency demo path. Voice mode is product-wired, but it still depends on browser microphone permission, authenticated WebSocket access, valid Azure Speech credentials, and a live interview session.

## Tech stack

### Frontend

- React 19
- Vite 6
- React Router 7
- Tailwind CSS 4
- Lucide React
- Motion
- Vitest + Testing Library
- WebSocket-based voice hooks
- Browser microphone APIs

### Backend

- Node.js 22+
- Express 4
- ES modules
- PostgreSQL through `pg`
- MongoDB through Mongoose and MongoDB driver
- Google OAuth verification
- JWT authentication
- DeepSeek API integration
- Azure Speech SDK
- WebSocket server through `ws`
- Vitest robustness tests

## Frontend structure

```text
frontend/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── api/
    │   ├── analyzeApi.js
    │   ├── authApi.js
    │   ├── client.js
    │   ├── exportApi.js
    │   ├── interviewApi.js
    │   ├── reportApi.js
    │   ├── sessionApi.js
    │   └── uploadApi.js
    ├── components/
    │   ├── analyze/
    │   ├── auth/
    │   ├── common/
    │   ├── home/
    │   ├── interview/
    │   ├── layout/
    │   └── report/
    ├── hooks/
    │   ├── voice/
    │   ├── useInterviewSession.js
    │   ├── useMicrophonePermission.js
    │   ├── useReportData.js
    │   ├── useVoiceDeviceCheck.js
    │   └── useVoiceInterviewSession.js
    ├── pages/
    │   ├── AnalyzePage.jsx
    │   ├── HomePage.jsx
    │   ├── InterviewPage.jsx
    │   ├── Login.jsx
    │   └── ReportPage.jsx
    └── utils/
```

### Main frontend pages

- `/login` - Google sign-in page
- `/home` - dashboard, profile, privacy card, recent sessions, start session card, and session defaults
- `/analysis` - CV selection, JD input, NZ/interview settings, analysis, and plan generation
- `/interview/:sessionId` - text or voice interview session
- `/report/:sessionId` - feedback report, coaching, insights, answer rewrite, and export actions

### Frontend interview setup

The analysis page passes the following setup into backend plan generation:

- `deliveryMode`: text or voice
- `controlMode`: `question_limited` or `time_limited`
- `questionLimit`: `8`, `12`, or `15`
- `timeLimitMinutes`: `5` or `10`
- `questionType`: technical, behavioral, or combined
- `seniorityLevel`: Junior/Grad, Intermediate, or Advanced
- `enableNZCultureFit`: enabled or disabled

The analysis page also enforces two trust gates before CV-JD matching:

- CV parse review: the user reviews only match-relevant parsed CV fields, not contact details.
- JD parse review: the user reviews the structured JD rubric before matching, even when parser confidence is above the 90% gate.

## Backend structure

```text
backend/
├── index.js
├── package.json
├── .env.example
├── eval/
├── tests/
└── src/
    ├── api.js
    ├── api/
    │   ├── realtimeVoiceSocket.js
    │   ├── duplexVoiceSocket.js
    │   └── routes/
    ├── config/
    ├── constants/
    ├── controllers/
    ├── db/
    │   └── models/
    ├── jobs/
    ├── middleware/
    ├── repositories/
    ├── scripts/
    ├── services/
    │   ├── agenticSafeguards/
    │   ├── agents/
    │   ├── aiControl/
    │   ├── cv/
    │   ├── interview/
    │   ├── jobDescription/
    │   ├── latency/
    │   ├── match/
    │   ├── retrieval/
    │   ├── session/
    │   └── voice/
    └── utils/
```

## Backend architecture

```text
index.js
  -> creates Express app and HTTP server
  -> bootstraps PostgreSQL and MongoDB
  -> mounts /api
  -> attaches realtime and duplex voice WebSocket servers

src/api.js
  -> applies CORS, JSON parsing, request context, optional auth
  -> mounts route groups
  -> applies shared error handler

routes
  -> map HTTP endpoints to controllers

controllers
  -> validate request-level input
  -> call service layer
  -> return formatted response

services
  -> own business logic, AI orchestration, parsing, matching, retrieval, voice, and reporting

repositories/db models
  -> own database access and persistence shape
```

## API summary

Base path: `/api`

### Public or semi-public routes

- `GET /api/health`
- `GET /api/auth/google/config`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Upload routes

- `POST /api/upload/cv`
- `GET /api/upload/recent-cvs`
- `POST /api/upload/select-cv`
- `POST /api/upload/cv/:cvId/rebuild-profile`
- `DELETE /api/upload/cv/:cvId`
- `GET /api/upload/cv/:cvId/export`

### Job description routes

- `POST /api/job-description/paraphrase`

### Analysis routes

- `POST /api/analyze/match`
- `POST /api/analyze/interview-plan`

### Interview routes

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

### Session routes

- `POST /api/session/save`
- `GET /api/session/history`
- `GET /api/session/:sessionId`
- `POST /api/session/resume`
- `DELETE /api/session/:sessionId`

### Export routes

- `POST /api/export/transcript`

### Recording routes

- `POST /api/recordings/session-audio`
- `GET /api/recordings/session-audio/:sessionId/status`
- `GET /api/recordings/session-audio/:sessionId/download`

### Report routes

- `POST /api/report/generate`
- `POST /api/report/qa`
- `GET /api/report/:sessionId`
- `POST /api/report/:sessionId/export`

### RAG routes

- `POST /api/rag/import-benchmark`
- `POST /api/rag/import-interview-knowledge`
- `POST /api/rag/rebuild-session`
- `POST /api/rag/retrieve`

### WebSocket routes

- `/api/interview/:sessionId/voice/live` - live STT socket attached in the backend entry point
- `/api/interview/:sessionId/voice/duplex` - product-level duplex voice socket attached in the backend entry point

## Interview control behavior

The backend normalizes interview settings in `src/config/interviewBlueprints.js`.

### Supported control modes

| Mode | Behavior |
| --- | --- |
| `question_limited` | Ends by configured question count |
| `time_limited` | Uses time limit and maps to a backend question capacity |

### Supported question limits

- 8 questions
- 12 questions
- 15 questions

### Supported time limits

| Time limit | Backend question capacity |
| --- | --- |
| 5 minutes | 10 questions |
| 10 minutes | 15 questions |

### Supported focus areas

| Focus area | Sections used |
| --- | --- |
| Technical | Opening, technical, wrap-up |
| Behavioral | Opening, behavioural, wrap-up |
| Combined | Opening, technical, behavioural, wrap-up |

## AI and agentic workflow

The backend has moved toward an agentic design without depending on an external agent framework as the only control layer.

Current AI-related groups include:

- `masterAiService.js` - high-level AI coordination
- `services/agents` - interviewer, retrieval, report generator, and report QA agents
- `services/aiControl` - action planning, decision context, evidence bundles, section planning, trajectory, reflection, and memory
- `services/agenticSafeguards` - shared safeguard utilities and DeepSeek JSON client
- `services/jobDescription` - guarded JD parsing, reparse, critic, schema validation, and normalization
- `services/match` - guarded match analysis, scoring, explanation, and validation target building
- `services/retrieval` - global knowledge retrieval, session evidence retrieval, corrective retrieval, quality assessment, and source selection

The intent is:

```text
Plan
  -> choose action
  -> retrieve evidence
  -> generate or refine output
  -> validate/guardrail result
  -> persist decision and session state
```

## Data layer

### PostgreSQL

PostgreSQL stores structured operational data, including:

- users
- uploaded file metadata
- parsed profile records
- skills
- interview sessions
- session control fields such as control mode, question limit, and time limit
- pgvector-backed RAG `document_chunks` for runtime vector retrieval

### MongoDB

MongoDB stores flexible AI-oriented data, including:

- AI logs
- legacy document chunk mirror records for migration/debug compatibility
- document content
- evaluation ground truth
- interview plans
- match analysis records
- normalized CV profiles
- normalized JD rubrics
- RAG benchmark cases
- session analysis
- session feedback detail
- session reports
- session transcripts
- user coaching memory

### Local filesystem

The backend still uses local file persistence for uploaded CV files, transcript/report export artifacts, and converted session MP3 recordings.

## Environment setup

### Prerequisites

- Node.js 22+
- npm
- PostgreSQL
- MongoDB
- Google OAuth client ID
- DeepSeek API key for real AI generation and eval
- Azure Speech resource for voice features

### Backend setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Expected backend environment values:

```bash
PORT=3000
POSTGRES_URL=postgresql://user:password@host:5432/database
MongoDB_URI=mongodb://localhost:27017/kiwi_ai
JWT_SECRET=replace_with_a_real_secret
GOOGLE_CLIENT_ID=your_google_client_id
DEEPSEEK_API_KEY=your_deepseek_key
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=eastasia
AZURE_SPEECH_ENDPOINT=https://eastasia.api.cognitive.microsoft.com/
AZURE_SPEECH_TTS_VOICE=en-NZ-MollyNeural
AZURE_SPEECH_STT_LANGUAGE=en-NZ
```

Notes:

- `POSTGRES_URL` is required for PostgreSQL.
- `MongoDB_URI` or `MONGODB_URI` can be used for MongoDB.
- `MONGO_REQUIRED=true` makes backend startup fail if MongoDB is unavailable.
- `AI_TEST_MODE=real` requires `DEEPSEEK_API_KEY` and should fail fast if the key is missing.
- `AI_TEST_MODE=mock` uses deterministic mock AI output for robustness tests.
- `ENABLE_AGENTIC_SAFEGUARDS=true` enables safeguard-specific test paths.
- RAG runtime retrieval uses PostgreSQL pgvector. MongoDB document chunks are kept as a legacy mirror, not the primary vector store.

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

By default, the frontend calls `/api`. Vite proxies `/api` to `http://127.0.0.1:3000` and supports WebSocket proxying.

Optional frontend environment value:

```bash
VITE_API_BASE_URL=/api
```

## Scripts

### Backend scripts

```bash
npm run dev
npm run start
npm run test
npm run test:all
npm run test:jd-safeguard
npm run test:match-safeguard
npm run eval:jd
npm run eval:seek
npm run eval:cv
npm run eval:match
npm run eval:interview
npm run eval:report
npm run eval:e2e
npm run eval:green
npm run eval:all
npm run quality:all
```

### Backend script meaning

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start backend server |
| `npm run start` | Start backend server |
| `npm run test:all` | Run robustness test group in mock AI mode |
| `npm run test:jd-safeguard` | Run JD safeguard robustness test |
| `npm run test:match-safeguard` | Run match safeguard robustness test |
| `npm run eval:jd` | Run real JD parse eval |
| `npm run eval:seek` | Run the 10-case SEEK JD benchmark |
| `npm run eval:cv` | Run real CV parse eval |
| `npm run eval:match` | Run real CV-JD match eval |
| `npm run eval:interview` | Run real interview controller eval |
| `npm run eval:report` | Run real report QA eval |
| `npm run eval:e2e` | Run deterministic end-to-end interview eval |
| `npm run eval:green` | Run Kiwi Green Agent benchmark |
| `npm run quality:all` | Run robustness tests, then real AI evals |

### Frontend scripts

```bash
npm run dev
npm run build
npm run preview
npm run clean
npm run start
npm run test
npm run test:all
npm run quality:all
```

### Frontend script meaning

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build frontend |
| `npm run preview` | Preview production build |
| `npm run clean` | Remove `dist` |
| `npm run start` | Start Vite preview on `0.0.0.0` |
| `npm run test:all` | Run frontend Vitest tests |
| `npm run quality:all` | Run frontend tests, then build |

## Testing strategy

The current test direction is robustness-first.

`npm run dev` already proves the app can start. The automated tests focus on edge cases and regressions that normal manual clicking may miss.

### Backend robustness coverage

Current backend robustness tests cover:

- CV parsing edge cases
- JD parsing edge cases
- JD parser agentic safeguards
- Luma Analytics JD safeguard regression
- Guarded match human-review behavior
- Interview control behavior
- Tool trace contract stability
- Retrieval behavior
- RAG index payload and embedding behavior
- Recording upload guard behavior
- Report grounding
- DeepSeek mock vs real mode behavior
- Duplex voice behavior
- Legacy batch voice removal

### Frontend test coverage

Current frontend tests cover:

- Voice interview panel behavior
- Microphone permission hook
- Voice interview session hook
- Realtime mic stream helper
- Realtime speech socket helper
- Voice activity detection core
- Voice latency trace and summary helpers
- CV review view model
- JD human review metadata stamping
- Interview page voice-mode behavior

### Eval coverage

The backend `eval/` folder contains curated datasets and runners for:

- CV parse quality
- JD parse quality
- SEEK JD parsing quality
- CV-JD match quality
- Interview controller quality
- Report QA quality
- End-to-end interview scenario quality
- Green Agent benchmark quality

Eval reports are written into:

```text
backend/eval/reports/*.latest.json
backend/eval/reports/*.latest.md
```

## Data import and RAG utilities

Important script files:

- `backend/src/scripts/importResumeScoreDetails.js`
- `backend/src/scripts/importInterviewKnowledge.js`
- `backend/src/scripts/transformResumeScoreDetails.js`

RAG-related routes support:

- benchmark import
- interview knowledge import
- session index rebuild
- context retrieval

RAG services support:

- PostgreSQL pgvector runtime retrieval
- legacy Mongo chunk mirroring for migration/debug compatibility
- 256-dimensional weighted hash embeddings
- token, word n-gram, character n-gram, estimated IDF, and keyword fusion scoring
- duplicate cleanup and idempotent source/session/chunk indexing
- session evidence retrieval
- global knowledge retrieval
- corrective retrieval
- retrieval quality assessment
- retrieval objective building
- retrieval source selection

## Current strengths

- Clear frontend page split
- Stronger backend modularity than earlier versions
- Better JD parsing safeguards
- Human review gates for CV and JD parse quality before matching
- Hardened RAG indexing and retrieval storage
- Better interview control settings
- More realistic test strategy
- Real AI eval runners instead of only mocked tests
- Hybrid data model fits the product use case
- Report generation has QA and evidence-based sections
- Voice groundwork is meaningful and not just a UI button

## Known gaps and technical debt

- Duplex voice is now mounted in the backend entry point, but it still depends on valid Azure Speech credentials, valid auth, and an in-progress interview session.
- Some broad services still need more splitting.
- Some ownership checks should be hardened across every route and resource.
- `.env.example` has a typo-like duplicated `POSTGRES_URL=POSTGRES_URL=...` value and should be cleaned.
- `JWT_SECRET` still has development fallback behavior in some auth paths.
- Transcript export and report export behavior should be reviewed for final submission requirements.
- MongoDB degraded mode is useful for development, but final deployment should define whether MongoDB is required.
- Frontend still uses local draft persistence for analysis setup. This is useful, but privacy wording should match actual storage behavior.
- Full end-to-end voice testing still needs real browser microphone, Azure Speech, and authenticated session coverage.
- CV-JD match eval coverage is still small and should be expanded beyond the current curated cases before claiming broad random-JD reliability.
- The deterministic local embedding is acceptable for MVP retrieval experiments, but a real embedding model migration plan is still needed for production-grade semantic retrieval.

## Recommended next engineering steps

1. Fix `.env.example` so PostgreSQL setup is clean.
2. Run backend `npm run test:all` and frontend `npm run quality:all` after every structural change.
3. Run `npm run eval:all` only when a real DeepSeek key is configured.
4. Expand CV-JD match eval coverage with more weak, partial, transition, overqualified, and noisy SEEK cases.
5. Add route-level ownership tests for CV, session, report, transcript, recording, and RAG access.
6. Continue splitting older broad services into smaller domain services.
7. Keep README, version history, and test docs aligned after each release-level change.

## Suggested demo path

For a stable current demo:

1. Start backend.
2. Start frontend.
3. Login with Google.
4. Upload a CV.
5. Review the parsed CV match fields and mark the CV as reviewed.
6. Paste a JD.
7. Generate the structured JD summary.
8. Review the parsed JD rubric and mark the JD as reviewed.
9. Run CV-JD match analysis.
10. Select text interview mode.
11. Choose question-limited or time-limited setup.
12. Run the interview.
13. Export transcript.
14. Generate report and QA.

Use voice mode after backend, frontend, Azure Speech credentials, auth token storage, and microphone permission are all available in the same environment.
