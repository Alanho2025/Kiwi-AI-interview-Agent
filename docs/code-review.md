# Code Review Notes

Review date: 2026-03-31

## Summary

The project is now in a workable split frontend/backend state and the core CV-to-JD comparison uses parsed document text instead of mock text. The highest remaining risks are persistence, automated testing, and UX-level error handling.

## Findings

### 1. No persistent storage

Severity: High

- Sessions and uploaded CV metadata are stored in memory only.
- Restarting the backend loses all session state and recent CVs.

Affected files:

- `backend/services/sessionService.js`
- `backend/controllers/uploadController.js`

Recommendation:

- move sessions and uploaded-document metadata into a database or durable store
- use a file/object store only for documents, not session state

### 2. Match scoring is deterministic but still heuristic

Severity: Medium

- The match score now compares actual uploaded CV text and JD text.
- However, the scoring model is still based on keyword, skill, phrase, and seniority heuristics.
- It is more reliable than a model-only estimate, but it is not yet a semantic ranking engine.

Affected file:

- `backend/services/matchService.js`

Recommendation:

- add a reviewable score breakdown to the UI
- consider structured JD extraction and weighted must-have/nice-to-have scoring

### 3. User-facing feedback is still alert-based

Severity: Medium

- Errors and confirmations in the frontend still rely heavily on `alert()` and `window.confirm()`.
- This makes the product feel less professional and harder to scale.

Affected files:

- `frontend/src/pages/AnalyzePage.jsx`
- `frontend/src/pages/InterviewPage.jsx`
- `frontend/src/components/analyze/CVManagementCard.jsx`

Recommendation:

- replace browser dialogs with product-native toast, modal, and inline status components

### 4. No automated tests

Severity: Medium

- The repo currently has no unit, integration, or API tests for the parsing, matching, or interview flows.

Recommendation:

- add backend service tests for:
- file extraction
- match score calculations
- session lifecycle
- add frontend smoke tests for main page flows

### 5. Session lifecycle still needs business rules

Severity: Low

- Interviews can continue conceptually beyond the intended scripted flow because there is no final enforcement around question exhaustion or completion criteria.

Affected file:

- `backend/controllers/interviewController.js`

Recommendation:

- define a clear rule for when the interview ends automatically
- prevent further replies after completion

## Positive Changes Already In Place

- split frontend/backend structure is now coherent
- frontend has its own Vite entry and API layer
- backend is a standalone API server
- CV upload now extracts real PDF/DOCX text
- CV/JD matching is deterministic and based on actual document text
- README and repo rules now exist
