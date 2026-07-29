---
name: auto-docs-sync
description: Automatically synchronize and update project documentation (docs/, repo-docs/, Feature RFCs, Architecture Decision Records, README.md, change-log.md) whenever product code (backend/, frontend/, services, controllers, DB schemas) is created, modified, refactored, or deleted.
---

# Auto Docs Sync Skill

This skill mandates automatic documentation updates whenever any product code (`backend/`, `frontend/`, `scripts/`, database schemas, or configurations) is modified.

## Trigger Conditions
This skill MUST be executed whenever:
1. Product code in `backend/` or `frontend/` is created, modified, refactored, or deleted.
2. Function signatures, routes, API payloads, or state machines are changed.
3. Database schemas (Postgres, Mongo) or environment configurations are updated.
4. Bug fixes or feature additions alter existing runtime behaviors.

## Mandatory Step-by-Step Sync Workflow

### Step 1: Identify Changed Code & Owning Feature
- Inspect modified files in `git status` or `git diff`.
- Map the code changes to the owning Feature RFC (`F-01` through `F-68`) under `docs/architecture-decision-records/features/`.

### Step 2: Update Affected Feature RFC Documents
- **Section 1.2 (Git & Evolution Trace)**: Document what was changed and why.
- **Section 4.1 (Real Code Snippet & Line-by-Line Breakdown)**: Update code snippets and line ranges if function signatures, parameters, or logic changed.
- **Section 5 & 6 (Failure Modes & Debugging)**: Update error handling, logs, or fallback mechanisms if affected.
- **Section 7 (Candidate Defense Script)**: Update interview Q&A scripts if architectural trade-offs changed.

### Step 3: Update System Guides & Harness Docs
- If harness contracts, run timelines, or gate policies changed, update `docs/harness/` and `docs/further_plan/`.
- If reader-facing Chinese documentation changed, update `repo-docs/`.

### Step 4: Record Change Log Entry
- Append a entry to `repo-docs/change-log.md` detailing:
  - Affected product code files.
  - Synchronized documentation files.
  - Verification method used.

### Step 5: Verification & Safety Guardrail
- Run QA Guardrail check to verify that all documentation links, code line ranges, and markdown formats remain 100% valid.
