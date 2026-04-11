# Kiwi AI Interview Agent - Version History

This file tracks structural and behaviour changes for engineers.
It is not a release marketing note.
It is used to explain why a version exists, what changed, and what remains open.

## v1.3.0 - CV lifecycle, ownership guard, and export hardening

### Why this version exists
This batch closes the main remaining CV-domain gaps against the code review plan and the commercial product plan.
The focus is on lifecycle controls, ownership checks, safer upload rules, persisted match analysis, and session snapshot consistency.

### Main changes
- Added shared CV ownership helpers:
  - `backend/src/services/cv/cvOwnershipService.js`
- Added CV lifecycle service:
  - rebuild profile
  - soft delete
  - export redacted and normalized CV data
  - file: `backend/src/services/cv/cvLifecycleService.js`
- Added persisted match analysis records:
  - `backend/src/db/models/matchAnalysisRecordModel.js`
  - `backend/src/services/cv/matchAnalysisRecordService.js`
- Updated analyze flow:
  - `/analyze/match` now persists a `matchAnalysisId`
  - `/analyze/interview-plan` can create a session from an owned `matchAnalysisId`
- Updated session persistence:
  - session analysis now stores retrieval snapshots with `matchAnalysisId` and evidence refs
  - interview plan now stores a `questionPlanSnapshot`
- Updated interview plan schema to support internal trace metadata while keeping the frontend payload clean
- Added CV lifecycle endpoints:
  - rebuild profile
  - delete CV
  - export CV data
- Strengthened upload validation:
  - extension validation
  - MIME validation
- Kept question trace metadata internal and stripped it from session payloads sent to the frontend

### Open limits after this version
- No background retention worker yet
- No encrypted-at-rest file storage yet
- No self-service bulk account deletion yet
- Frontend does not yet expose dedicated UI actions for rebuild/delete/export

## v1.2.0 - CV domain separation and safe frontend flow

### Main changes
- Added CV section parsing, profile building, and display view services
- Extended `DocumentContent` to hold CV profile and display artifacts
- Changed analyze flow so the frontend sends `cvId` instead of raw CV text
- Session payloads now prefer `cvDisplay` instead of returning full CV text
- Analyze draft storage now saves safe CV metadata instead of full extracted CV text
- Added this version history concept and connected it to the clean delivery workflow

## v1.1.0 - Match analysis persistence and session trace foundation

### Main changes
- Added persisted match analysis support as an internal session input pattern
- Added question trace metadata foundation so interview planning can stay explainable internally
- Connected session creation to analysis outputs instead of treating analysis as a transient UI-only result

## v1.0.0 - CV upload domain baseline

### Main changes
- Upload flow now creates extracted CV content, profile data, and display-safe summaries
- Recent CV and selected CV responses now return safe summary data instead of raw CV text
- Frontend analyze flow no longer sends raw CV text through match and session creation

## Track 6 structural history before the CV domain batches

### v1.1.0
- Split `sessionService.js` into lifecycle, transcript, question, and shared session modules

### v1.2.0
- Slimmed `interviewController.js` by moving session loading, state transitions, answer persistence, and audit logging into interview services

### v1.3.0
- Split `HomePage.jsx` into dedicated home sections and extracted session display helpers
- Split `ReportPage.jsx` into report view builders and dedicated report sections

### v1.4.0
- Split `sessionLifecycleService.js` into lifecycle orchestration, persistence helpers, and session view builders
- Split `AnalyzePage.jsx` by extracting analyze draft helpers and a dedicated action card

### v1.5.0
- Split JD parsing into AI extraction, heuristic extraction, and rubric builder modules
- Split CV/JD matching into rubric normalization, score builders, question plan builder, and analyze result builder

### v1.6.0
- Split `reportGeneratorAgent.js` into evidence analysis, metric builders, coaching builders, draft builders, and shared helpers
- Ran a hotspot scan to identify the next maintainability targets

### v1.7.0
- Added `useInterviewSession` to separate interview state orchestration from `InterviewPage.jsx`
- Split interview page layout into dedicated page sections
- Added `useReportData`
- Split report view logic into the report-view domain folder and kept the old entrypoint as a compatibility barrel export
