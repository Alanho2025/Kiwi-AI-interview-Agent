# CV Data Lifecycle

## Purpose
This document explains how CV-related data is handled in the product.

## Layers

### Raw file layer
Used for file storage and controlled reprocessing.
Not returned to the frontend.

### Raw extraction layer
Used for parser recovery and profile rebuilding.
Not stored in localStorage.
Not returned in ordinary API responses.

### Normalized profile layer
Used for CV and JD matching, interview planning, and report evidence links.

### Redacted display layer
Used for recent CV lists, preview cards, and safe UI rendering.

## Allowed usage contract
- raw file: storage, controlled reparse, controlled export pipeline only
- raw extraction: parser debug and profile rebuild only
- normalized profile: matching, retrieval, interview planning, report evidence
- redacted display: frontend display and safe exports

## Current self-service controls
- delete one CV
- rebuild one CV profile
- export one CV safe data package

## Current known limits
- retention worker is implemented but disabled by default and only processes queued ready jobs
- production operation still requires an audited manifest, approved execution, database availability, persistent storage, and deployment policy
- no account-wide delete workflow yet
- no encrypted-at-rest local storage yet

## Current code references

- CV upload controller: `backend/src/controllers/uploadController.js`
- CV file extraction: `backend/src/services/fileService.js`
- CV profile builder: `backend/src/services/cv/cvProfileBuilderService.js`
- CV display redaction/view model: `backend/src/services/cv/cvDisplayViewService.js`
- CV ownership checks: `backend/src/services/cv/cvOwnershipService.js`
- CV lifecycle controls: `backend/src/services/cv/cvLifecycleService.js`
- Human-reviewed CV profile save path: `backend/src/services/cv/cvReviewedProfileService.js`
- File metadata and document content persistence: `backend/src/services/fileRepositoryService.js`
- Retention audit and approved cleanup: `backend/src/scripts/runRetentionAudit.js`, `backend/src/scripts/runRetentionCleanup.js`
- Retention worker and quarantine/backup path: `backend/src/services/retention/retentionWorker.js`, `backend/src/services/retention/`
- Frontend CV review view model: `frontend/src/utils/cvReviewViewModel.js`

## Current implementation status

Implemented:

- PDF/DOCX CV text extraction
- local file storage for uploaded CV files
- uploaded file metadata records
- document content attachment with raw, normalized, redacted, profile, and display-profile data
- recent CV list
- selected CV lookup by owner
- human-reviewed match-field profile save path
- soft delete for one CV
- rebuild one CV profile
- safe export package for one CV
- audit logs for upload, review, delete, and export actions
- retention dry-run manifests, explicit approval-gated cleanup, backup/quarantine services, and a disabled-by-default queued-job worker

Partial or missing:

- enabled and deployment-verified scheduled retention operation
- account-wide delete workflow
- encrypted-at-rest local storage guarantee
- full route-level ownership test coverage across every CV-adjacent path
