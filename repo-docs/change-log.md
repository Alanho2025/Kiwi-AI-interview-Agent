# Change Log

## [2026-07-30] Deep Accuracy & Architectural Corrections across Feature RFC Suite (F-01 through F-71)

### Changed / Added
- **Fixed Master Index & README**:
  - Updated `docs/architecture-decision-records/features/README.md` to reflect **71 Feature RFCs** (including F-69, F-70, F-71).
  - Replaced hardcoded local environment file links (`file:///Users/heminghan/...`) with clean relative links (`./F-01-landing-page-hero.md`).
- **Fixed F-10 (CV Upload Pipeline)**:
  - Corrected upload file size limit from 10MB to **5MB** (`5 * 1024 * 1024`).
  - Corrected allowed file types to **PDF & DOCX** (matching `uploadMiddleware.js`).
  - Added metadata header: `Implementation Status: Verified` (`backend/tests/services/cvParse.test.js`).
- **Fixed F-17 (Question Pool Composer)**:
  - Eliminated false 40/40/20 4:4:2 fixed bucket claim; documented actual source priority chain (`match_gap` -> `match_validation` -> `jd_filter` -> `cv_seed`).
  - Corrected `resolveRoleDomain` signature to accept `analysisResult` object.
  - Adjusted latency claims to realistic ~15-50ms DB/composition time.
- **Fixed F-34 (Report Generation Pipeline)**:
  - Eliminated fictional `POST /api/reports/generate` -> 202 Accepted -> polling workflow.
  - Documented actual task execution via `runTask({ taskType: 'generate_report', sessionId })` in `masterAiService.js` and `reportCoachingService.js`.
- **Fixed F-49 (Cross-DB Transaction Coordinator)**:
  - Eliminated fictional 2PC / cross-DB Postgres+Mongo transaction & 100% atomicity claims.
  - Documented actual `withTransaction()` implementation in `postgres.js`: **Single-DB PostgreSQL Client Transaction Isolation** (`BEGIN`, `COMMIT`, `ROLLBACK`).
  - Updated status to `Partial` (Postgres Single-DB Verified; Mongo uses application-level eventual consistency).
- **Added Standard Verification Metadata Headers**:
  - Added `Implementation Status: [Verified / Partial / Planned]` across all RFC documents.

### Verification
- Verified against source files in `backend/src/`, `frontend/src/`, `deploy/ec2/`, and automated Jest/Vitest test suites.
