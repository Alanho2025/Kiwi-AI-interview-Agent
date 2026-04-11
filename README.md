# Kiwi AI Interview Agent

Kiwi AI Interview Agent is a mock interview platform for CV-based and JD-based interview practice.
It combines a React frontend, an Express backend, PostgreSQL for structured session data, and MongoDB for flexible AI artifacts such as transcripts, analysis, reports, and RAG chunks.

This repository is no longer a simple demo-only prototype. The current codebase already includes:
- Google login flow
- CV upload and parsing
- JD paraphrasing and rubric building
- CV-to-JD analysis
- interview session creation and progression
- report generation and QA
- transcript export
- session-aware RAG indexing and retrieval

## What is implemented now

### Frontend
The frontend is a React + Vite single-page app with protected routes and a multi-step interview workflow.

Main pages:
- `/login` - Google sign-in entry
- `/home` - user profile, recent sessions, saved defaults
- `/analysis` - CV upload, JD input, NZ interview settings, analysis status
- `/interview/:sessionId` - live interview page with reply, pause, resume, repeat, and transcript view
- `/report/:sessionId` - generated report, QA status, feedback insights, export actions

Main frontend groups:
- `src/pages` - route-level pages
- `src/components/analyze` - upload, JD, and settings cards
- `src/components/interview` - interview UI panels and session cards
- `src/components/home` - privacy and dashboard cards
- `src/api` - thin API wrappers by domain
- `src/utils` - auth session helpers and UI formatting helpers

### Backend
The backend is an Express API with route, controller, service, repository, and database layers.

Implemented backend capabilities:
- Google auth endpoints
- CV upload with PDF and DOCX text extraction
- local file persistence for uploaded CVs and transcript exports
- JD paraphrasing into a structured rubric
- deterministic CV-JD matching and interview focus generation
- session creation and persistence in PostgreSQL
- transcript, report, and analysis storage in MongoDB
- interview state progression
- report generation and report QA tasks
- session artifact indexing and RAG retrieval endpoints
- health endpoint for PostgreSQL and MongoDB

### Data layer
The project uses a hybrid storage model.

PostgreSQL stores structured operational data such as:
- users
- interview sessions
- parsed profiles
- parsed skills
- uploaded file metadata

MongoDB stores flexible AI-oriented records such as:
- session analysis
- session transcripts
- session reports
- document chunks
- benchmark and interview knowledge chunks

## Current architecture

```text
Frontend (React/Vite)
  -> domain pages, UI components, local draft state, API wrappers
  -> calls /api/* with credentials

Backend (Express)
  -> routes
  -> controllers
  -> services
  -> repositories / db access

Storage
  -> PostgreSQL for structured session and file metadata
  -> MongoDB for analysis, transcript, report, and RAG documents
  -> local filesystem for uploaded CV files and transcript exports
```

## Maintainability refactor included in this version

Track 6 work started in this repository revision focuses on reducing controller noise and making the backend easier to extend with multiple contributors.

Changes made:
- added a shared `asyncHandler` to remove repetitive controller `try/catch`
- added `requestContext` middleware to generate a per-request `requestId`
- added a shared structured `logger`
- added shared `AppError` helpers for common HTTP errors
- added small controller helpers for required request fields and missing resources
- refactored core controllers to use the shared error and logging flow
- updated startup and error handling to use structured logging instead of scattered `console.log` patterns

Why this matters:
- smaller and cleaner controller diffs
- easier code review when two people are working in parallel
- less noisy merge conflicts
- more consistent backend behavior
- easier future refactor of service-level responsibilities

## Project structure

```text
Kiwi-AI-interview-Agent/
├── backend/
│   ├── index.js
│   ├── package.json
│   └── src/
│       ├── api/
│       │   └── routes/
│       ├── controllers/
│       ├── db/
│       ├── middleware/
│       ├── repositories/
│       ├── scripts/
│       ├── services/
│       │   └── agents/
│       └── utils/
├── frontend/
│   ├── package.json
│   └── src/
│       ├── api/
│       ├── components/
│       ├── pages/
│       └── utils/
├── data/
│   ├── interview-knowledge/
│   └── resume-score-details-normalized/
├── docs/
├── AGENTS.md
└── README.md
```

## API summary

Base path: `/api`

Public or semi-public routes:
- `GET /api/health`
- `GET /api/auth/google/config`
- `POST /api/auth/google`
- `POST /api/auth/logout`

Authenticated route groups:
- `/api/upload`
- `/api/job-description`
- `/api/analyze`
- `/api/interview`
- `/api/session`
- `/api/export`
- `/api/rag`
- `/api/report`

Key endpoints:
- `POST /api/upload/cv`
- `GET /api/upload/recent-cvs`
- `POST /api/upload/select-cv`
- `POST /api/job-description/paraphrase`
- `POST /api/analyze/match`
- `POST /api/analyze/interview-plan`
- `POST /api/interview/start`
- `POST /api/interview/reply`
- `POST /api/interview/pause`
- `POST /api/interview/resume`
- `POST /api/interview/repeat`
- `POST /api/interview/end`
- `GET /api/session/history`
- `GET /api/session/:sessionId`
- `POST /api/export/transcript`
- `POST /api/report/generate`
- `POST /api/report/qa`
- `GET /api/report/:sessionId`
- `POST /api/rag/rebuild-session`
- `POST /api/rag/retrieve`

## Environment setup

### Prerequisites
- Node.js 22+
- npm
- PostgreSQL
- MongoDB
- Google OAuth client ID
- DeepSeek API key for AI-backed generation paths

### Backend setup
```bash
cd backend
npm install
cp .env.example .env
```

Expected environment values include items such as:
- `PORT`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `DEEPSEEK_API_KEY`
- PostgreSQL connection settings
- MongoDB connection settings

Start backend:
```bash
cd backend
npm run dev
```

### Frontend setup
```bash
cd frontend
npm install
npm run dev
```

The Vite app runs on the default dev port and talks to the backend through the configured API client and dev proxy setup.

## Scripts

### Backend
```bash
npm run dev
npm run start
```

### Frontend
```bash
npm run dev
npm run build
npm run preview
npm run clean
npm run lint
```

## Data import and RAG utilities

The repository includes normalized datasets and import scripts.

Important script files:
- `backend/src/scripts/importResumeScoreDetails.js`
- `backend/src/scripts/importInterviewKnowledge.js`
- `backend/src/scripts/transformResumeScoreDetails.js`

These support:
- benchmark case import
- interview knowledge import
- normalized chunk creation
- session artifact indexing for retrieval

## What is strong already

- clear frontend page separation
- backend has route, controller, service, and repository layers
- hybrid data model matches the product needs well
- interview flow is more than a single chatbot call
- report generation has a dedicated QA path
- RAG is already integrated, not just mocked in slides

## Current gaps and known technical debt

These are still important and should be treated honestly.

Not fully solved yet:
- some core services are still too large, especially `sessionService`
- formal automated test coverage is still limited
- privacy wording and implementation depth may still need better alignment
- auth and ownership hardening is a separate high-priority track
- transcript export still returns transcript content in JSON
- some frontend state patterns are still localStorage-heavy

## Recommended next engineering steps

1. Continue splitting broad backend services by domain responsibility.
2. Add service-level and API-level tests for session lifecycle and report generation.
3. Finish the auth and ownership hardening track.
4. Separate global knowledge retrieval and session-scoped retrieval more clearly.
5. Clean the release package before final submission or handoff.

## Notes for collaborators

If two people are working on this repository at the same time, avoid both people editing the same broad service file in parallel unless there is a clear split.

Safer collaboration pattern:
- one person handles auth, session ownership, and privacy hardening
- one person handles maintainability, logging, controller cleanup, and docs
- create short-lived feature branches
- keep PR scope small
- merge structure changes before feature changes whenever possible

## Repository docs

Additional notes and planning documents are already in the repo:
- `docs/code-review.md`
- `docs/data_related.md`
- `docs/database_architecture_plan.md`
- `docs/ui-ux-proposal.md`
- `docs/website_feature.md`
- `summary.md`
- `schema-gap-map.md`

## Final status

This project is beyond the stage of a toy mockup. The key challenge now is not whether features exist, but whether the system is clean enough, secure enough, and maintainable enough to support continued development and a strong review.
