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
- no automated retention cleanup worker yet
- no account-wide delete workflow yet
- no encrypted-at-rest local storage yet
