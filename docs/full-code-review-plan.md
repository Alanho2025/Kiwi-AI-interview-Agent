# Full Code Review Plan - Kiwi AI Interview Agent

## Overall Assessment

This project is no longer at the stage of "can it run". The main risks now are:

1. Authorization and privacy boundaries are not strict enough.
2. The RAG architecture exists, but retrieval quality and data layering are not stable enough.
3. The upload, analysis, and report workflows can run, but traceability and consistency still need work.
4. Maintainability is starting to show prototype-style patterns.
5. The UI and privacy wording are ahead of the real implementation.

The most important point is that several issues are no longer minor improvements. They are pre-demo and pre-delivery issues.

---

## Review Scope

This full review covers the following tracks:

1. Auth, session, and authorization boundaries
2. RAG design, retrieval quality, and knowledge layering
3. CV upload, file handling, and data lifecycle
4. JD upload, JD analysis, and matching logic
5. Interview engine and report generation
6. Code maintainability and engineering structure
7. Frontend UX, state management, and privacy presentation
8. Documentation, deployment, and delivery consistency

---

# Track 1. Auth, Session, and Authorization Boundaries

## Current Main Issues

### 1. Login does not equal authorization
Many endpoints are protected by `requireAuth`, but they only verify that the user is logged in. They do not verify that the `sessionId` belongs to the current user.

### Impacted Areas
- `backend/src/controllers/sessionController.js`
- `backend/src/controllers/interviewController.js`
- `backend/src/controllers/reportController.js`
- `backend/src/controllers/exportController.js`

### Risk
This creates an object-level authorization problem. If someone knows or guesses a valid `sessionId`, they may be able to:
- read another user's session
- view another user's report
- export another user's transcript
- pause, resume, or end another user's interview

### Why It Matters
This is a broken object-level authorization risk. It is one of the most serious API security problems because resource access is based on IDs and ownership is not enforced consistently.

### Fix Target
Create one shared guard such as:
- `getOwnedSessionOrThrow(sessionId, userId)`

Then apply it to all session-related and report-related actions.

### Recommended Actions
- Add ownership checks to all session endpoints.
- Add ownership checks to interview actions.
- Add ownership checks to report generation and report retrieval.
- Add ownership checks to transcript export.

### Priority
**P0**

---

### 2. Auth strategy is mixed across cookie, localStorage, and Bearer token
The current auth flow mixes multiple patterns:
- backend sets an `httpOnly` cookie
- backend also returns a token
- frontend stores the token in localStorage
- route guard checks localStorage
- API requests may also send Bearer token headers

### Impacted Areas
- `backend/src/controllers/authController.js`
- `backend/src/middleware/authMiddleware.js`
- `frontend/src/pages/Login.jsx`
- `frontend/src/components/auth/ProtectedRoute.jsx`
- `frontend/src/api/client.js`
- `frontend/src/utils/authSession.js`

### Risk
- There is no single source of truth for auth.
- localStorage is exposed to XSS.
- logout does not fully invalidate all client auth states.
- frontend route protection is not truly server-verified.

### Fix Target
Choose one strategy only.

### Recommended Direction
Use **cookie-only auth**.

### Recommended Actions
- Remove token storage from localStorage.
- Keep localStorage only for non-sensitive UI state if needed.
- Use `/auth/me` to verify session state on app load.
- Update `ProtectedRoute` to rely on server session validation.
- Keep `credentials: 'include'` and remove manual Bearer token behavior.

### Priority
**P0**

---

### 3. JWT secret fallback is unsafe
The backend currently allows a fallback secret when environment configuration is missing.

### Risk
If the production environment is missing a proper secret, the app may still run with a predictable fallback value.

### Fix Target
Fail fast in production when `JWT_SECRET` is missing.

### Recommended Actions
- Add environment validation at startup.
- Allow only explicit dev secrets in development.
- Do not allow runtime fallback for production.

### Priority
**P0**

---

# Track 2. RAG Design, Retrieval Quality, and Knowledge Layering

## Current State
The project already has:
- chunking
- deterministic embedding
- cosine similarity
- keyword overlap
- fusion score
- session artifact indexing
- retrieval layer integration

This is a working RAG foundation, not a fake placeholder. However, it is still closer to a functional prototype than a stable retrieval system.

---

## Main Issues

### 1. Session filtering may block global question banks
When retrieval is filtered by `sessionId`, global knowledge without a `sessionId` may be excluded.

### Risk
This can reduce or block access to:
- `question_bank`
- `behavioural_bank`

The system may appear to have question banks, but retrieval may still behave like fallback mode.

### Symptoms
- agent questions may feel generic
- retrieval evidence may be weak
- question bank value is underused

### Fix Target
Split retrieval into:
1. global bank retrieval
2. session artifact retrieval
3. fusion merge stage

### Recommended Actions
- Separate global and session-scoped retrieval.
- Add source-specific weighting.
- Avoid one shared filter for all source types.

### Priority
**P1**

---

### 2. Embedding is deterministic but not truly semantic
The current embedding implementation is a lightweight deterministic embedding.

### Strengths
- cheap
- predictable
- easy to control
- no external embedding cost

### Weaknesses
- weak semantic similarity
- weak handling of paraphrase and synonym variation
- limited robustness for real language variation

### Fix Options
#### Option A. Improve current design first
- better metadata boosting
- better query expansion
- source-aware weighting
- role and skill tag enhancement

#### Option B. Upgrade to true embeddings later
- OpenAI embeddings
- Voyage
- BGE or E5 local embedding models
- Mongo Atlas vector or pgvector

### Recommended Direction
Start with Option A first. The bigger current issue is data layering and weighting, not just the embedding model.

### Priority
**P1**

---

### 3. Chunking is still too simplistic
The current chunking strategy appears to be mainly fixed-length text slicing.

### Risk
- question context may be split incorrectly
- JD requirements and evidence may be split apart
- report retrieval may pull partial meaning only

### Fix Target
Move to:
- paragraph-aware chunking
- section-aware chunking
- overlap chunking

### Recommended Actions
Use different chunking strategies for:
- transcript
- JD rubric
- interview question bank
- report artifact

### Priority
**P2**

---

# Track 3. CV Upload, File Handling, and Data Lifecycle

## Current State
The upload flow includes:
- multer memory upload
- PDF and DOCX parsing
- local upload storage
- uploaded file metadata records
- document content attachment

## Main Issues

### 1. Privacy and encryption wording is ahead of real implementation
Frontend text presents a strong privacy and encryption story, but the backend implementation currently looks more like local file storage plus metadata handling.

### Risk
This creates a trust gap. The product says more than the system clearly proves.

### Fix Options
#### Option 1. Reduce wording to match implementation
Use wording like:
- securely transmitted and stored
- retention support exists
- privacy controls are evolving

#### Option 2. Implement the missing controls
Add:
- encryption at rest
- key management
- deletion worker or retention worker
- access log
- real file deletion workflow

### Recommended Direction
If a demo or submission is near, reduce wording first, then implement the missing controls.

### Priority
**P0-P1**

---

### 2. Upload security is still prototype level
Current upload validation appears to rely mainly on file extension and size constraints.

### Risk
- fake extensions
- unsafe file acceptance
- virus scan fields may imply checks that do not really happen

### Fix Target
- add MIME validation
- validate parse success
- mark scan status honestly
- do not mark scanning as completed if scanning is not enabled

### Priority
**P1**

---

### 3. Raw CV content may be retained too broadly
The system appears to store raw and normalized CV content, but redacted output may not yet be truly redacted.

### Risk
Sensitive personal information may spread across workflows too easily.

### Fix Target
Define three layers:
1. raw original content
2. normalized processing content
3. redacted display content

Then define which layer is used for retrieval, display, report generation, and export.

### Priority
**P1**

---

# Track 4. JD Upload, JD Analysis, and Matching Logic

## Current State
This is one of the stronger parts of the system.

The JD pipeline already includes:
- text input and parsing
- heuristic plus AI extraction
- rubric normalization
- macro and micro skill structure
- interview target generation
- question plan hints
- CV and JD comparison

## Strengths
- not purely LLM black box
- schema-based thinking is present
- requirements are layered
- interview planning is connected to JD processing

---

## Main Issues

### 1. AI extraction can silently fall back
If AI skill extraction fails, the system can fall back quietly to a weaker heuristic mode.

### Risk
The UI may appear normal even though JD analysis quality has dropped.

### Fix Target
Backend should return explicit mode information such as:
- `analysisMode: hybrid`
- `analysisMode: heuristic_only`
- `warnings: []`

Frontend should surface fallback state clearly.

### Priority
**P1**

---

### 2. Traceability from JD analysis to final interview questions is still limited
The system has question plan hints, but it is still hard to explain clearly:
- why this question was asked
- whether it came from CV gap or JD requirement
- whether it came from question bank or generation

### Fix Target
Each question should carry:
- sourceType
- sourceId
- matchedSkill
- matchedRequirement
- generationReason
- evidence snapshot

### Priority
**P2**

---

# Track 5. Interview Engine and Report Generation

## Current State
The interview system includes:
- start
- reply
- pause
- resume
- repeat
- end
- transcript
- report generation
- report QA

This is already more advanced than a simple chatbot flow.

## Strengths
- question pool support
- retrieval bundle support
- report QA stage exists
- evidence diagnostics exist

---

## Main Issues

### 1. Prompt control and decision logic are still too mixed
The interview system includes long system instruction logic, but the actual interview behavior still seems heavily shaped by question pools, retrieval output, and fallbacks.

### Risk
- prompt changes may not strongly change actual behavior
- debugging agent decisions becomes harder
- policy and wording are tightly mixed

### Fix Target
Separate:
1. decision layer, which decides what to ask
2. surface layer, which decides how to phrase it

### Priority
**P2**

---

### 2. Reports need stronger evidence-level traceability
Reports already include useful content, but each conclusion should be linked more clearly to transcript or retrieved evidence.

### Fix Target
Add report metadata such as:
- `evidenceRefs`
- `sourceTurnIndexes`
- `confidence`

This will also improve report QA quality.

### Priority
**P1**

---

### 3. Transcript export returns full content too directly
The current export flow returns transcript content in API responses.

### Risk
Full transcript text may appear too widely in frontend state, logs, or network tooling.

### Fix Target
Use:
- generated download file route
- signed download URL
- direct streaming download

Avoid returning the full transcript inside ordinary JSON responses.

### Priority
**P1**

---

# Track 6. Code Maintainability and Engineering Structure

## Overall Evaluation
The project structure is stronger than a typical student project, but it still shows clear prototype-style growth patterns.

## Strengths
- backend separation into route, controller, service, and repository layers
- frontend component grouping exists
- naming is mostly readable
- analysis logic is not fully mixed with rendering logic

---

## Main Issues

### 1. Controllers are noisy and log-heavy
There are many debug-style logs such as entry and exit console messages.

### Risk
- real errors are harder to spot
- log quality is inconsistent
- production logging becomes noisy

### Fix Target
Introduce a shared logger with:
- info
- warn
- error
- requestId
- userId
- sessionId

### Priority
**P2**

---

### 2. Some services are becoming too large
Several core services appear to hold too many responsibilities.

### Examples
- session lifecycle and persistence mixed together
- matching and analysis logic are broad
- report generation bundles too much work

### Fix Target
Split by domain responsibility, such as:
- session lifecycle
- session transcript handling
- interview question planning
- interview progression
- report evidence analysis
- report narrative generation

### Priority
**P2**

---

### 3. Formal test coverage is still missing in critical paths
The most important tests are not visual UI tests. They are logic and security tests.

### Most Needed Test Areas
- owner guard behavior
- session lifecycle
- JD parse fallback
- RAG source mixing
- report QA consistency
- auth mode behavior

### Fix Target
Add at least:
1. unit tests
2. service integration tests
3. critical API tests

### Priority
**P1**

---

# Track 7. Frontend UX, State Management, and Privacy Presentation

## Current State
The frontend flow is fairly complete, but the state strategy is still too localStorage-heavy.

## Main Issues

### 1. Auth and UI state are treated too similarly
The system currently handles draft state and auth state with a similar localStorage mindset.

### Fix Target
Separate state into:
1. UI preference
2. recoverable draft
3. authentication state

Only the first two should use localStorage.

### Priority
**P1**

---

### 2. Privacy UI reads like a compliance brochure
The privacy modal and related content present a mature compliance posture, but the implementation is not fully there yet.

### Fix Target
Use more accurate categories such as:
- current implementation
- planned controls
- intended user rights
- deletion and retention flow in progress

### Priority
**P0-P1**

---

# Track 8. Documentation, Deployment, and Delivery Consistency

## Current State
README and code are no longer aligned.

The documentation still describes an earlier system state, while the code now includes:
- Postgres integration
- Mongo models
- session history
- report storage
- Google login
- RAG indexing

## Main Issues

### 1. README is behind the implementation
This creates confusion for reviewers, teammates, and future maintenance.

### Fix Target
Rewrite README into:
1. implemented now
2. partially implemented
3. planned next

### Priority
**P1**

---

### 2. Release package is not clean enough
The project package includes delivery noise such as:
- `.env`
- `node_modules`
- `.git`
- `.DS_Store`
- build output folders

### Fix Target
Final delivery package should contain only:
- source code
- docs
- `.env.example`
- package metadata

### Priority
**P1**

---

# Recommended Full Fix Plan

## Phase 1. Security and Trust First
Goal: fix the most serious risks before anything else.

### Tasks
- add session ownership guard everywhere
- unify auth into cookie-only strategy
- remove localStorage token dependency
- enforce production env validation
- align privacy wording with real implementation
- remove `.env` from release package

### Outcome
The system moves from "can demo" to "safer and harder to break".

---

## Phase 2. RAG and Report Reliability
Goal: make interview questioning and reports more evidence-based and consistent.

### Tasks
- split global and session retrieval
- add stage-aware retrieval weighting
- improve chunking strategy
- add report evidence references
- improve JD and question traceability
- expose fallback mode clearly

### Outcome
The RAG pipeline becomes meaningfully useful rather than partially decorative.

---

## Phase 3. Maintainability Refactor
Goal: make the code easier to evolve without creating new bugs.

### Tasks
- split large services by domain responsibility
- separate decision logic from phrasing logic
- introduce structured logging
- reduce noisy console debugging
- add service and API tests
- unify error handling patterns

### Outcome
The project becomes more product-like and less prototype-like.

---

## Phase 4. Documentation and Delivery Formalization
Goal: make the repo ready for submission, review, and long-term maintenance.

### Tasks
- rewrite README
- sync system architecture documentation
- update privacy and data lifecycle docs
- create deployment checklist
- prepare clean release package

### Outcome
The project becomes easier to explain, assess, and hand off.

---

# Current Maturity Ratings

## Architecture Maturity
**7.5/10**

The structure is solid and clearly beyond a casual prototype.

## Security Maturity
**4.5/10**

The biggest concerns are object-level authorization and mixed auth strategy.

## RAG Maturity
**6/10**

It is functional, but not yet reliable enough for stronger trust.

## Maintainability
**6.5/10**

The system is structured, but some core services are starting to become too broad.

## Privacy and Compliance Consistency
**4/10**

The wording currently goes further than the implementation.

## Demo Readiness
**7/10**

The project can be demonstrated, but deeper review will expose several weak points.

---

# Top 10 Immediate Priorities

1. add session owner authorization checks
2. unify auth to cookie-only strategy
3. remove token storage from localStorage
4. add production environment validation
5. align privacy wording with real implementation
6. change transcript export to file-based or streamed export
7. split global and session retrieval in RAG
8. make upload scan status truthful
9. rewrite README to match implementation
10. clean the release package

---

# Final Note

This project has already moved beyond the stage of a basic class prototype. The foundation is real. The main challenge now is not whether the features exist, but whether the system is secure enough, traceable enough, and maintainable enough to support stronger review, future extension, and more trustworthy product claims.
