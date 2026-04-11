# Track 6 Maintainability Plan

## Goal

Refactor the project toward a cleaner, lower-risk structure that supports:
- multi-person collaboration
- easier feature growth
- lower merge conflict risk
- lower change cost for existing features

This plan follows the rules in `docs/clean-code-rules.md`.

## Current Priority Order

### Phase 1
- split `backend/src/services/sessionService.js`
- split oversized frontend page modules
- reduce controller orchestration noise in interview flow

### Phase 2
- introduce clearer mapper / formatter / builder layers
- tighten service vs persistence boundaries
- standardize error handling patterns further

### Phase 3
- add focused tests for isolated logic
- formalize file ownership and extension patterns
- update documentation to match the refactored structure

## Current Hotspots

### Backend
- `backend/src/services/sessionService.js`
- `backend/src/controllers/interviewController.js`
- `backend/src/services/matchService.js`
- `backend/src/services/jobDescriptionService.js`

### Frontend
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/pages/ReportPage.jsx`

## Refactor Strategy

### Session domain first
The session domain affects:
- interview state
- transcript persistence
- question persistence
- session listing
- plan updates

This makes it the best first target for maintainability work.

### Target split for session domain
- `sessionLifecycleService.js`
- `sessionTranscriptService.js`
- `sessionQuestionService.js`
- `sessionShared.js`

## Working Rule

Each batch should be:
- safe enough to run without broad breakage
- large enough to reduce one real maintainability hotspot
- packaged immediately after completion

## Expected Outcome

When Track 6 is complete:
- large multi-purpose files are reduced
- responsibilities are clearer
- future features can be added with smaller diffs
- review and testing become easier
- merge conflict risk is lower

## Progress Log
- v1.1.0: Split `sessionService.js` into lifecycle, transcript, question, and shared session modules.
- v1.2.0: Slimmed `interviewController.js` by moving session loading, state transitions, answer persistence, and audit logging into interview services.
- v1.3.0: Split `HomePage.jsx` into dedicated home sections and extracted session display helpers. Split `ReportPage.jsx` into report view builders and dedicated report sections.
- v1.4.0: Split `sessionLifecycleService.js` into lifecycle orchestration, persistence helpers, and session view builders. Split `AnalyzePage.jsx` by extracting analyze draft helpers and a dedicated action card.
- v1.5.0: Split job description parsing into AI extraction, heuristic extraction, and rubric builder modules. Split CV/JD matching into rubric normalization, score builders, question plan builder, and analyze result builder.

- v1.6.0: Split `reportGeneratorAgent.js` into evidence analysis, metric builders, coaching builders, draft builders, and shared helpers. Ran a post-refactor hotspot scan to identify the next maintainability targets.

## Post-v1.6.0 Hotspot Scan

### Highest priority remaining hotspots
- `frontend/src/utils/reportViewBuilder.js`
- `backend/src/services/scoringSchemaService.js`
- `backend/src/services/session/sessionPersistenceService.js`
- `frontend/src/pages/InterviewPage.jsx`
- `backend/src/repositories/sessionRepository.js`

### Notes
- The report generator domain is now split, but report-related display and coaching logic still has concentration in `frontend/src/utils/reportViewBuilder.js` and `backend/src/services/reportCoachingService.js`.
- Session lifecycle orchestration is cleaner now, but persistence work is still concentrated in `sessionPersistenceService.js`.
- The next frontend maintainability target should be `InterviewPage.jsx`, because it is still acting as both a page container and a conversation-flow coordinator.
- The next backend maintainability target should be `scoringSchemaService.js`, because it is still a broad rule-and-shape service instead of a smaller validation and builder layer.

## v1.7.0 progress

### Frontend React-focused maintainability refactor
- Added `useInterviewSession` to separate interview state orchestration from `InterviewPage.jsx`.
- Split interview page layout into `InterviewPageHeader`, `InterviewSidebar`, and `InterviewRightRail`.
- Added `useReportData` so report fetching and mutation logic no longer lives directly inside `ReportPage.jsx`.
- Added `ReportActionBar` to make report actions reusable and page structure thinner.
- Split `reportViewBuilder.js` into a report-view domain folder:
  - `reportView/shared.js`
  - `reportView/insights.js`
  - `reportView/coaching.js`
  - `reportView/viewModel.js`
  - `reportView/index.js`
- Kept `reportViewBuilder.js` as a barrel export for low-risk compatibility.
- Verified frontend production build after refactor.

### React-specific structure direction
- Pages should orchestrate route params, high-level status, and section composition only.
- Reusable UI and side panels should live in components, not page files.
- Fetching and mutation state should prefer custom hooks when a page starts mixing data logic with UI composition.
- View-model and formatter logic should live in utility or builder modules, not in JSX files.
