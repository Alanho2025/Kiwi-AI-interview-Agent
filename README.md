# Kiwi AI Interview Agent

Kiwi AI Interview Agent is a split frontend/backend application for:

- uploading a candidate CV in `PDF` or `DOCX`
- parsing the uploaded document into real text
- pasting a job description and restructuring it
- generating a deterministic CV-to-JD match score
- creating a mock interview session based on the CV, JD, and settings
- running a text-based interview flow with pause, resume, repeat, export, and transcript review

## Current Product Scope

### Analyze Flow

- Upload CV from the frontend
- Extract text from:
- `PDF` via `pdf-parse`
- `DOCX` via `mammoth`
- Paste a job description
- Optionally paraphrase the JD through DeepSeek
- Compare CV text and JD text on the backend
- Generate:
- `matchScore`
- strengths
- gaps
- interview focus
- plan preview

### Interview Flow

- Create a session from analyzed CV/JD data
- Start interview
- Send candidate replies
- Generate next interviewer question
- Pause or resume an interview
- Repeat the last question
- End an interview
- Export transcript as plain text

## Architecture

### Frontend

Location: `frontend/`

Stack:

- React
- Vite
- Tailwind CSS
- React Router

Main responsibilities:

- Render analysis and interview flows
- Call backend APIs
- Persist analysis draft in local storage
- Display transcript, progress, and match results

### Backend

Location: `backend/`

Stack:

- Node.js
- Express
- Multer
- DeepSeek API

Main responsibilities:

- File upload handling
- CV text extraction
- JD paraphrasing
- Deterministic CV/JD comparison
- Interview session lifecycle
- Transcript export

## Project Structure

```text
.
├── AGENTS.md
├── backend
│   ├── controllers
│   ├── middleware
│   ├── routes
│   ├── services
│   ├── src
│   ├── utils
│   ├── index.js
│   └── package.json
├── frontend
│   ├── src
│   │   ├── api
│   │   ├── components
│   │   ├── pages
│   │   └── utils
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Setup

### Prerequisites

- Node.js 22+
- npm

### Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

### Environment

Create `backend/.env` from `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

Variables:

- `PORT`: backend server port
- `DEEPSEEK_API_KEY`: enables JD paraphrasing and interview question generation

## Run Locally

Start backend:

```bash
cd backend && npm run dev
```

Start frontend in a second terminal:

```bash
cd frontend && npm run dev
```

Frontend development requests to `/api` are proxied to `http://localhost:3000`.

## Build

Frontend production build:

```bash
cd frontend && npm run build
```

## Match Score Logic

The current match score is not a free-form LLM score. It is computed on the backend from the uploaded CV text and the provided JD text.

Inputs:

- parsed CV text
- JD text
- extracted skill patterns
- extracted keywords
- extracted requirement phrases
- seniority alignment

The score currently weights:

- skill coverage: 45%
- keyword coverage: 35%
- requirement phrase coverage: 15%
- seniority alignment: 5%

Returned analysis includes:

- `matchScore`
- `strengths`
- `gaps`
- `interviewFocus`
- `matchingDetails`

## API Overview

Base path: `/api`

Routes:

- `POST /upload/cv`
- `GET /upload/recent-cvs`
- `POST /upload/select-cv`
- `POST /job-description/paraphrase`
- `POST /analyze/match`
- `POST /analyze/interview-plan`
- `GET /session/:sessionId`
- `POST /session/save`
- `POST /session/resume`
- `POST /interview/start`
- `POST /interview/reply`
- `POST /interview/repeat`
- `POST /interview/pause`
- `POST /interview/resume`
- `POST /interview/end`
- `POST /export/transcript`

## Known Limitations

- Sessions are currently stored in memory and are lost when the backend restarts.
- Match scoring is deterministic and more reliable than an LLM estimate, but it is still heuristic rather than a full semantic ranking engine.
- Transcript export is plain text only.
- There is no authentication or persistent user profile yet.

## Working Rules

The repository-level collaboration rules are defined in [AGENTS.md](./AGENTS.md).

Key rules:

- ask before making non-trivial changes
- ask before any UI design change
- keep structure aligned with clean code principles
- do not push or rewrite git history without approval
