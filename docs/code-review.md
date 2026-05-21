# Code Review Notes

Review date: 2026-03-31

Status note: this is now a historical review. Several high-risk items below have since been implemented or partially implemented. For current status, use `docs/code-document-alignment.md` and `README.md`.

## Summary

The project is now in a workable split frontend/backend state and the core CV-to-JD comparison uses parsed document text instead of mock text. The highest remaining risks are persistence, automated testing, and UX-level error handling.

## Findings

### 1. No persistent storage

Severity: High

Current status: largely resolved, with remaining lifecycle hardening gaps.

- PostgreSQL schema setup now exists in `backend/src/db/initPostgresSchema.js`.
- MongoDB models now exist under `backend/src/db/models/`.
- Uploaded file metadata, sessions, CV document content, transcripts, reports, usage events, and audit logs now have persistence paths.
- Remaining gaps are retention cleanup, account-wide deletion, encryption-at-rest guarantees, and complete ownership tests.

Current references:

- `backend/src/db/initPostgresSchema.js`
- `backend/src/controllers/uploadController.js`
- `backend/src/services/sessionService.js`
- `backend/src/services/fileRepositoryService.js`
- `backend/src/db/models/`

Recommendation:

- move sessions and uploaded-document metadata into a database or durable store
- use a file/object store only for documents, not session state

### 2. Match scoring is deterministic but still heuristic

Severity: Medium

Current status: still relevant, but the implementation is more structured than this original note.

- The match layer now includes guarded matching, capability matching, semantic evidence, transition-aware scoring, achievement boosting, explanation building, and validation target construction.
- It still should not be presented as universally calibrated across all industries or random JDs.

Current references:

- `backend/src/services/match/`
- `backend/src/services/cv/cvAnalysisService.js`
- `backend/src/services/cv/matchAnalysisRecordService.js`

Recommendation:

- add a reviewable score breakdown to the UI
- consider structured JD extraction and weighted must-have/nice-to-have scoring

### 3. User-facing feedback is still alert-based

Severity: Medium

Current status: partially resolved.

- The analysis and interview pages now use product UI components such as status banners, workflow cards, panels, and report sections.
- This should still be reviewed before final submission because privacy and compliance text is ahead of some backend guarantees.

Affected files:

- `frontend/src/pages/AnalyzePage.jsx`
- `frontend/src/pages/InterviewPage.jsx`
- `frontend/src/components/analyze/CVManagementCard.jsx`

Recommendation:

- replace browser dialogs with product-native toast, modal, and inline status components

### 4. No automated tests

Severity: Medium

Current status: resolved for core robustness coverage, still incomplete for full E2E/live-provider coverage.

- Backend robustness tests exist under `backend/tests/robustness/`.
- Frontend tests exist under `frontend/src/**/__tests__/` and `frontend/src/**/*.test.*`.
- Real/mocked eval runners exist under `backend/eval/runners/`.
- Missing coverage remains around live browser + Azure voice E2E, wider CV-JD match calibration, and route-complete ownership tests.

Recommendation:

- add backend service tests for:
- file extraction
- match score calculations
- session lifecycle
- add frontend smoke tests for main page flows

### 5. Session lifecycle still needs business rules

Severity: Low

Current status: partially resolved.

- Session start, reply, pause, resume, repeat, end, elapsed time, question limits, time-limited capacity, and completion state now exist in the interview/session services.
- Further hardening is still useful around ownership tests and live voice edge cases.

Current references:

- `backend/src/controllers/interviewController.js`
- `backend/src/services/interview/`
- `backend/src/config/interviewBlueprints.js`

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
