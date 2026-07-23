# Kiwi AI Interview Agent

An advanced **Compound AI System** for evidence-grounded, Role-Fit aligned interview coaching.

Unlike simple chatbot wraps, Kiwi AI Interview Agent is a compound AI architecture that helps candidates prepare for specific roles by parsing CVs and Job Descriptions (JDs), extracting structured rubrics, establishing a Candidate Evidence Graph, running adaptive mock interviews (text/realtime WebSocket voice), and generating self-healing reports backed by a verification harness.

---

## 💡 Why I Built This (Motivation & Key Challenges)

### The Problem with Generic AI Coaches
Most mock interview tools are simple wrappers around an LLM chat endpoint. They suffer from three core issues:
1. **Generic Questions**: They ask generic questions (e.g., "Tell me about yourself") without anchoring them to the candidate's actual CV or the role's specific business challenges.
2. **Superficial Feedback**: They give high-level, ungrounded feedback (e.g., "Great job, just add more detail") that does not evaluate specific evidence or authenticity.
3. **Fragile Conversation Flow**: They often repeat questions, fail to explore details (follow-up depth), or suffer from transcription-based score degradation.

### The Solution: A Controlled Compound AI Pipeline
Kiwi solves these problems by structuring the preparation, matching, and interview flow into a traceable, multi-agent pipeline. It focuses on **Role-Fit Closed Loop v2**—aligning company business problems with candidate proof strategies—and protects the live experience via a developer-facing **Product Harness** and **ASR Calibration Gates**.

---

## 📈 Product Evolution & Milestones

The project was built through systematic engineering iterations, transitioning from a basic text mock interview tool into a robust, observable enterprise-ready coaching engine:

```text
Phase 1: Basic MVP (Text Flow)
   └── CV/JD Parsing -> Rubric Match -> Text Interview -> Feedback Report
Phase 2: Role-Fit v2 Closed Loop
   └── Company website snippets -> Role Intent Decoder -> Candidate Evidence Graph -> Proof Strategy Review -> Answer Alignment v2
Phase 3: Realtime Voice Hardening
   └── WebSocket Duplex Speech -> Custom VAD -> Low-Confidence Confirmation Gate -> TTS Queue Bypass
Phase 4: Product Harness & Parity
   └── WorkflowRun Timeline -> Shadow/Observe/Enforce gates -> Replay Evals & Performance Trace
```

### 1. Phase 1: Foundation (Text MVP)
- Implemented CV profile parsing (PDF/DOCX) and pasted Job Description parsing.
- Built a basic match analysis and text-based interview loop with a simple question pool.
- Established the hybrid data layer: PostgreSQL for relational states (sessions, usage) and MongoDB for document content and AI logs.

### 2. Phase 2: Role-Fit v2 Closed-Loop Upgrade
- **Website Context Capture**: Same-origin website evidence collection with SSRF guards.
- **Role Intent Decoder**: Inferred business model, pain points, ideal candidate signals, and targeted interview probes instead of just raw requirement extraction.
- **Candidate Evidence Graph**: Generated tailored proof angles, fitting limits, and how-to-say-it guidelines.
- **Proof Strategy Panel**: High-impact UI allowing users to review best evidence angles prior to the live interview.
- **Answer Alignment v2**: Evaluation across 6 dimensions with evidence-use analysis and QA blocking flags.

### 3. Phase 3: Realtime Voice & Reliability Hardening
- Built a **WebSocket duplex voice pipeline** (`/api/interview/:sessionId/voice/duplex`) using Azure Speech SDK and ElevenLabs STT/TTS routing.
- Implemented **custom Voice Activity Detection (VAD)** and **speech barge-in handling** to interrupt streaming assistant responses immediately.
- Added a **transcript review & confirmation policy** for low-confidence turns to prevent poor transcription from degrading the candidate's score.
- Buffered speech chunks durably using browser IndexedDB for resilient background uploads.

### 4. Phase 4: Product Harness & Parity (Observability)
- Created the **Product Harness (G0-G6 / M1-M5)** framework: a non-intrusive tracing agent mapping every turn to a queryable, versioned `WorkflowRun`.
- Designed `shadow -> observe -> warn -> enforce` states so that safety, context, and memory validations run transparently without affecting production logic.
- Implemented **CV-JD Match performance tracing** (`performanceTrace.steps`) to profile latency across all match stages.

---

## 🛠️ Technology Stack & Techniques

| Layer | Technologies & Techniques |
| --- | --- |
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, React Router 7, Google OAuth |
| **Backend** | Node.js 20+ (Express 4), WebSockets (`ws`), Microsoft Cognitive Services SDK |
| **Data Layer** | PostgreSQL (relational state), MongoDB / Mongoose (AI artifacts), Browser IndexedDB |
| **AI & RAG** | pgvector runtime retrieval, 256-dimension custom weighted hash embeddings |
| **Quality & QA** | Report QA Agent (grounding audits, wording self-repair), Heading Guards |
| **Observability** | Product Harness `WorkflowRun` correlation, performance latency profiling |

---

## ⚙️ Project Architecture & Data Flow

```text
Google OAuth / Auth Gates
  └─► [CV Upload / Parse] ──► Human Review Gate ──┐
  └─► [JD Pasted / Parse] ──► Safeguard Guardrails ┴─► [CV-JD Match & Latency Trace]
                                                            │
  ┌─────────────────────────────────────────────────────────┘
  ├─► [Role-Fit Company Context / Intent Decoding]
  ├─► [Candidate Evidence Graph / Proof Strategy]
  └─► [Prepared Question Pool / Metadata Ranking]
        │
        ▼
  [Interview Session (Text / WebSocket Duplex Voice)] ◄──► [Product Harness Tracing]
        │                                                     - WorkflowRun Spans
        ▼                                                     - Shadow Memory Logging
  [Canonical Turn Dataset]
        │
        ▼
  [Report Generation & QA Agent] ──► Grounding Audit ──► Bounded Wording Repair (x2)
        │
        ▼
  [Report Publication (Score Breakdown, Quote Analysis, Commercial Cost rolled up)]
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- Node.js 20+ (Node.js 22 recommended)
- PostgreSQL
- MongoDB
- Google OAuth credentials
- Microsoft Azure Speech Service subscription (or ElevenLabs API key as fallback)

### 1. Database Setup
Ensure PostgreSQL and MongoDB services are running locally.

Create your PostgreSQL database:
```sql
CREATE DATABASE kiwi_interview;
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```
Update `.env` with your database URIs, Google OAuth credentials, and Azure Speech keys.

Start the backend development server:
```bash
npm run dev
```

### 3. Seed Global Knowledge
Import baseline interview benchmark rubrics and search-retrieval data:
```bash
node src/scripts/importInterviewKnowledge.js
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Evaluation Runners

The system includes comprehensive testing suites, E2E browser checks, and LLM-as-judge evaluation runners.

### Backend Tests & Evaluations
```bash
cd backend

# Run the complete robustness suite (15 groups, 600+ test scenarios)
npm run test:all

# Run specific robustness checks
npm run test:jd            # Job Description parsing stability
npm run test:match         # CV-JD match engine
npm run test:voice         # Duplex WebSocket voice state machine
npm run test:retention     # Data retention policies and cleanup

# Run Product Harness replay validation suites
npm run eval:harness-m1    # Milestone 1: Shadow telemetry & timeline parity
npm run eval:harness-m2    # Milestone 2: Observed contracts
npm run eval:harness-m3    # Milestone 3: Adaptive memory projections
npm run eval:harness-m4    # Milestone 4: Report publication gates
npm run eval:harness-m5    # Milestone 5: Voice reliability final evidence

# Run LLM-as-Judge evaluations
npm run eval:seek          # Seek JD benchmarking (10 cases)
npm run eval:voice-transcript-review-policy # LLM judge on high-risk transcript review
```

### Frontend Checks & Playwright E2E
```bash
cd frontend

# Run frontend vitest suite
npm run test:all

# Run Playwright E2E suites (synthetic providers, local browser checks)
npm run test:e2e:role-fit-refine  # Stakeholder refine gate (review lock bypass, low-confidence UI)
npm run test:e2e:role-fit-visual  # Visual validation checks
```

---

## 🔎 Important Quality Documents & References

To inspect the architectural details and specifications of individual features, read:
- **Marker Review Guide**: [`docs/marker-review-guide.md`](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/marker-review-guide.md) — Scoring rubrics, implemented vs. backlog list.
- **Product Harness Verdict**: [`docs/harness/goal.md`](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/harness/goal.md) — Canonical live milestone status.
- **Voice Interactivity Contracts**: [`VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`](file:///Users/heminghan/Kiwi-AI-interview-Agent/VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md) — Voice state machine specification.
- **Workflows Map**: [`docs/implementation-workflows.md`](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/implementation-workflows.md) — End-to-end payload routing.
- **Key Functions List**: [`docs/implementation-functions.md`](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/implementation-functions.md) — Critical backend service definitions.
- **Code Alignment Audit**: [`docs/code-document-alignment.md`](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/code-document-alignment.md) — Map of claims to actual source directories.
- **Repo-docs Change Log**: [`repo-docs/change-log.md`](file:///Users/heminghan/Kiwi-AI-interview-Agent/repo-docs/change-log.md) — Log of recent feature validation and patches.

---

## ⚠️ Honest Limitations

- **Voice Latency**: The next-question first-audio latency target is $\le 3$ seconds. While local automated tests with mock STT/TTS pass this, live speech providers over real network connections currently exhibit latency exceeding the 3-second SLO.
- **Data Deletion**: Although a background retention job runner exists (`npm run retention:cleanup`), account-wide immediate deletion, self-service profile deletion, and database-level encryption-at-rest remain backlog items.
- **RAG Embedding Complexity**: The custom 256-dimension weighted hash embedding is designed as a local, dependency-free retrieval mechanism. For enterprise-grade production, this should be migrated to a semantic dense vector model (e.g., text-embedding-3).
- **Cost Rollups**: LLM cost estimation is implemented for DeepSeek and Azure Speech. ElevenLabs WebSocket costs are recorded as zero-rated usage events until a provider pricing model is introduced.
