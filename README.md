# Kiwi AI Interview Agent 🥝

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 🚀 Project Introduction

**Kiwi AI Interview Agent** is an AI-powered mock interview platform designed to help job seekers practice interviews tailored to their CV and target job descriptions. 

### Key MVP Features
- **Auth**: Google OAuth login
- **Document Upload**: CV (PDF/DOCX) + Job Description (file/text paste)
- **Smart Parsing**: Extract skills, experience, projects from real documents
- **CV-JD Matching**: Deterministic scoring (skills 45%, keywords 35%, etc.)
- **Interview Simulation**: 5-min AI-led session (self-intro + follow-ups via DeepSeek)
- **Real-time Interaction**: Voice/text input, pause/resume/repeat
- **Feedback & Export**: Report with strengths/gaps + transcript export

Built for NZ job market with optional cultural fit questions. Current state: Functional MVP with in-memory sessions (persistence planned).

**User Flow**: Login → Upload CV/JD → Analyze Match → Start Interview → Get Report.

## 🛠 Initial Setup (After Clone)

**Note**: `node_modules` not committed. Run installs manually.

### Prerequisites
- Node.js 22+
- npm
- DeepSeek API key (for AI features)

### 1. Clone & Install
```bash
git clone <repo> Kiwi-AI-interview-Agent
cd Kiwi-AI-interview-Agent
```

**Backend:**
```bash
cd backend
npm install
cp .env.example .env  # Add DEEPSEEK_API_KEY=your_key_here
```

**Frontend:**
```bash
cd ../frontend
npm install
```

### 2. Run Development Servers
Terminal 1 (Backend): `cd backend && npm run dev` (runs on http://localhost:3000)

Terminal 2 (Frontend): `cd frontend && npm run dev` (proxies /api to backend)

Open http://localhost:5173 (Vite default).

**Production Build**: `cd frontend && npm run build` → serve `dist/`.

## 🏗 System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │    Storage      │
│ (React/Vite)    │◄──►│ (Node/Express)   │◄──►│ - Local files   │
│ - UI Components │    │ - API Routes     │    │ - Future S3     │
│ - Voice UI      │    │ - Parsing/Match  │    └─────────────────┘
│ - Local Storage │    │ - Session Mgmt   │         ▲
└─────────────────┘    └─────────────────┘         │
                           ▲                        │
                    ┌─────────────────┐             │
                    │     Database    │             │
                    │ - Postgres      │◄────────────┘
                    │   (planned)     │
                    │ - Mongo (docs)  │
                    └─────────────────┘
```

- **Frontend**: Single-page app, API client, real-time interview UI.
- **Backend**: REST API, file processing, AI integration.
- **Current Storage**: In-memory sessions + local uploads (backend/uploads).
- **Planned**: Postgres (users/sessions/files) + MongoDB (transcripts/plans/raw docs).

## ✨ Main Features

| Feature | Description |
|---------|-------------|
| **Analysis** | Upload CV/JD → Parse → Match score + plan preview |
| **Interview** | Start/pause/end session, reply via mic/text, auto-end @5min |
| **AI Questions** | Self-intro → CV/JD-based follow-ups (DeepSeek) |
| **Feedback** | Post-session report (impression, strengths, gaps) |
| **Export** | Transcript as TXT |
| **UX** | Responsive, status banners, progress tracking |

## 🌐 API Architecture

**Base Path**: `/api` (proxied in dev)

**Grouped Routes**:
- **Upload**: `POST /upload/cv`, `GET /upload/recent-cvs`
- **Analyze**: `POST /analyze/match`, `POST /job-description/paraphrase`
- **Session**: `POST /session/save`, `GET /session/:id`
- **Interview**: `POST /interview/start|reply|pause|resume|end|repeat`
- **Export**: `POST /export/transcript`

**Example** (curl analyze):
```bash
curl -X POST http://localhost:3000/api/analyze/match \
  -H 'Content-Type: application/json' \
  -d '{"cvText": "CV content", "jdText": "JD content"}'
```

Full list in current README → controllers/routes.

## 🛠 Technology Summary

### Backend (`backend/package.json`)
| Category | Tech |
|----------|------|
| Server | Node.js, Express 4.21 |
| Upload/Parse | Multer, pdf-parse 2.4, mammoth 1.12 |
| DB | pg 8.20 (Postgres), mongodb/mongoose 9.4 |
| AI/Auth | DeepSeek, JWT 9.0, Google Auth Lib |
| Utils | cors 2.8, dotenv 17.2 |

**Scripts**: `npm run dev` (node index.js)

### Frontend (`frontend/package.json`)
| Category | Tech |
|----------|------|
| Framework | React 19, Vite 6.2 |
| Styling | TailwindCSS 4.1 (@tailwindcss/vite) |
| UI/Routing | lucide-react, react-router-dom 7.14, motion 12.23 |
| Auth | @react-oauth/google 0.13, jwt-decode |
| Other | clsx 2.1, tailwind-merge 3.5 |

**Scripts**: `npm run dev|build|preview`

## 📁 Project Structure
```
.
├── backend/          # API server
│   ├── src/          # controllers/services/db/api
│   ├── uploads/      # CVs/dummy
│   └── package.json
├── frontend/         # React SPA
│   ├── src/components/ # Analyze/Interview/UI
│   └── package.json
├── docs/             # Architecture plans
├── AGENTS.md         # AI collab rules
└── TODO.md           # Progress tracker
```

## ⚖️ Match Score Logic
Heuristic (not pure LLM):
- Skills: 45%
- Keywords: 35%
- Phrases: 15%
- Seniority: 5%

Returns: `matchScore`, strengths, gaps, focus.

## 🚧 Limitations & Roadmap
- **Current**: In-memory sessions (lost on restart), basic auth, no tests, alert-based UX.
- **Next**: Full DB persistence, tests, modals/toasts, multi-session history.
See `docs/` for DB/UI plans.

## 🤝 Contributing
Follow [AGENTS.md](AGENTS.md). Ask before changes!

## 📄 License
MIT

