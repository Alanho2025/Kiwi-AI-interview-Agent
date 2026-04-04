# Database Architecture Plan

## Goal

This document defines the recommended database architecture for the current MVP of the Kiwi AI Interview Agent.

It combines:

- current implemented features in the codebase
- planned data boundaries from `docs/data_related.md`
- product flow from `docs/website_feature.md`

The goal is to design a database structure that is practical for the current MVP, while still leaving room for future interview history, dashboards, reporting, and AI workflow evolution.

---

## Architecture Summary

The recommended architecture is:

- PostgreSQL as the primary business database
- MongoDB with Mongoose as the AI workflow and flexible document database
- File storage as a separate layer for uploaded files and generated exports

### Why this split

PostgreSQL should store:

- user identity and account records
- interview session lifecycle records
- uploaded file metadata
- parsed structured fields used for filtering and reporting
- question and response records
- feedback summary data

MongoDB should store:

- raw extracted document text
- structured JD rubric JSON
- detailed CV/JD matching results
- generated interview plans
- transcript turns
- full feedback details
- AI logs and debug payloads

File storage should store:

- original CV files
- original JD files
- generated report files
- exported transcript files

The file binary should not be stored in PostgreSQL or MongoDB.

---

## Current Implemented Features That Must Be Reflected In The Data Model

The current codebase already creates or uses the following data:

- Google login user identity
- CV upload metadata
- extracted CV text
- recent CV list
- selected CV
- pasted job description text
- structured job description summary
- structured job description rubric JSON
- CV to JD matching result
- interview settings
- generated interview session
- session status changes
- transcript messages
- elapsed interview time
- question progress
- transcript export

Right now, much of this data is only stored:

- in memory
- in frontend local storage
- in request/response payloads

That is the main architecture gap. The system already has meaningful domain data, but it is not persisted properly.

---

## Recommended Data Ownership

### PostgreSQL

Use PostgreSQL for stable, relational, queryable business data.

Recommended responsibilities:

- users
- interview sessions
- uploaded file metadata
- job description input source records
- parsed profile summary
- parsed skills
- interview questions
- interview responses
- report summaries

### MongoDB with Mongoose

Use MongoDB for AI process data, flexible nested JSON, and evolving structures.

Recommended responsibilities:

- raw document contents
- detailed session analysis
- detailed interview plan
- transcript turns
- detailed feedback
- AI logs

### File Storage

Use local disk or object storage for binaries.

Recommended responsibilities:

- CV PDF/DOCX
- JD PDF/DOCX/TXT
- transcript export files
- report PDF files

---

## Core Design Principle

The primary system key should be `session_id`.

Why:

- one interview flow starts from one user session
- CV, JD, matching, plan, transcript, and report all belong to that flow
- cross-database linking becomes simpler if everything points to the interview session

Recommended linkage:

- PostgreSQL `interview_sessions.id` is the canonical session key
- MongoDB documents also store the same `sessionId`
- file metadata can reference the same session

This gives one consistent cross-store reference model.

---

## PostgreSQL Schema Plan

## 1. `users`

Purpose:

- store authenticated user accounts

Fields:

- `id uuid primary key`
- `email varchar unique not null`
- `full_name varchar not null`
- `auth_provider varchar not null`
- `google_sub varchar unique null`
- `last_login_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Notes:

- `google_sub` should be stored because it is more stable than email
- current in-memory auth user storage should eventually move here

---

## 2. `interview_sessions`

Purpose:

- store the main interview session lifecycle

Fields:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `status varchar not null`
- `mode varchar not null default 'voice'`
- `target_role varchar null`
- `candidate_name varchar null`
- `seniority_level varchar null`
- `focus_area varchar null`
- `enable_nz_culture_fit boolean not null default false`
- `current_question_index integer not null default 0`
- `total_questions integer not null default 0`
- `elapsed_seconds integer not null default 0`
- `started_at timestamptz null`
- `ended_at timestamptz null`
- `duration_seconds integer null`
- `overall_score numeric(5,2) null`
- `summary_text text null`
- `cv_file_id uuid null`
- `jd_file_id uuid null`
- `report_file_id uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Why these fields are needed now:

- `target_role` already exists in the current session object
- `candidate_name` already exists in the current session object
- `current_question_index` already exists in the current session object
- `total_questions` already exists in the current session object
- `elapsed_seconds` already exists in the current session object
- `status` is already central to the current interview flow
- the user-selected settings are already part of current analysis flow and should not remain transient

---

## 3. `uploaded_files`

Purpose:

- store file metadata only

Fields:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `session_id uuid null references interview_sessions(id)`
- `file_role varchar not null`
- `original_filename varchar not null`
- `mime_type varchar not null`
- `storage_provider varchar not null`
- `storage_key varchar not null`
- `file_url text null`
- `file_size_bytes bigint not null`
- `checksum varchar null`
- `uploaded_at timestamptz not null`

Use cases:

- uploaded CV
- uploaded JD file
- generated transcript file
- generated report file

Important:

- recent CVs should be queried from this table instead of stored in an in-memory array

---

## 4. `job_description_inputs`

Purpose:

- store the source of the JD input, especially pasted text

Fields:

- `id uuid primary key`
- `session_id uuid not null references interview_sessions(id)`
- `source_type varchar not null`
- `raw_text text null`
- `uploaded_file_id uuid null references uploaded_files(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Why this table is needed:

- current product flow allows pasted JD text
- pasted JD should not be forced into the file table
- the original JD input is a real business input and should be recoverable

---

## 5. `parsed_profiles`

Purpose:

- store query-friendly normalized summary fields

Fields:

- `id uuid primary key`
- `session_id uuid not null unique references interview_sessions(id)`
- `candidate_name varchar null`
- `current_title varchar null`
- `experience_years numeric(4,1) null`
- `highest_education varchar null`
- `location varchar null`
- `job_title varchar null`
- `cv_summary text null`
- `jd_summary text null`
- `match_score numeric(5,2) null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Purpose in MVP:

- support later dashboard and report views
- keep useful searchable summary data in SQL

---

## 6. `parsed_skills`

Purpose:

- store normalized detected skills from CV and JD

Fields:

- `id uuid primary key`
- `session_id uuid not null references interview_sessions(id)`
- `source_type varchar not null`
- `skill_name varchar not null`
- `skill_category varchar null`
- `importance_level varchar null`
- `evidence_text text null`
- `created_at timestamptz not null`

Why it matters:

- enables future skill comparison, overlap, and gap reporting
- keeps queryable skill data separate from large JSON analysis

---

## 7. `interview_questions`

Purpose:

- store the main question records for the interview

Fields:

- `id uuid primary key`
- `session_id uuid not null references interview_sessions(id)`
- `question_order integer not null`
- `question_type varchar not null`
- `source_type varchar not null`
- `question_text text not null`
- `based_on_cv boolean not null default false`
- `based_on_jd boolean not null default false`
- `asked_at timestamptz null`
- `created_at timestamptz not null`

Purpose in MVP:

- preserves the questions that were actually used
- separates main business records from the more flexible question planning document

---

## 8. `interview_responses`

Purpose:

- store each response record associated with a question

Fields:

- `id uuid primary key`
- `session_id uuid not null references interview_sessions(id)`
- `question_id uuid not null references interview_questions(id)`
- `response_mode varchar not null default 'voice'`
- `transcript_text text null`
- `audio_duration_seconds integer null`
- `response_started_at timestamptz null`
- `response_ended_at timestamptz null`
- `word_count integer null`
- `created_at timestamptz not null`

Notes:

- text mode fallback is already implied in the current product direction
- transcript text should be available here for per-question reporting

---

## 9. `report_summaries`

Purpose:

- store the report summary that is useful for UI and future analytics

Fields:

- `id uuid primary key`
- `session_id uuid not null unique references interview_sessions(id)`
- `overall_score numeric(5,2) null`
- `communication_score numeric(5,2) null`
- `technical_score numeric(5,2) null`
- `confidence_score numeric(5,2) null`
- `job_fit_score numeric(5,2) null`
- `overall_impression text null`
- `strengths_summary text null`
- `gaps_summary text null`
- `suggestions_summary text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

This is intentionally the summary layer, not the full feedback detail layer.

---

## MongoDB Collections Plan

MongoDB should use Mongoose.

Important design rule:

- do not treat MongoDB as completely unstructured
- define schema where structure is stable
- use `Schema.Types.Mixed` only for the parts that truly change often

All MongoDB collections should include:

- `sessionId`
- `userId`
- `createdAt`
- `updatedAt`

---

## 1. `DocumentContent`

Purpose:

- store extracted raw and normalized document text

Suggested fields:

- `fileId`
- `sessionId`
- `userId`
- `documentType`
- `rawText`
- `normalizedText`
- `parseStatus`
- `parserVersion`
- timestamps

Why this collection is needed:

- current CV upload already extracts text
- the extracted text is valuable and should not be lost
- storing raw content in MongoDB is more appropriate than PostgreSQL text columns for evolving parse output

---

## 2. `SessionAnalysis`

Purpose:

- store detailed JD rubric and CV/JD matching analysis

Suggested fields:

- `sessionId`
- `userId`
- `cvDocumentId`
- `jdInputId`
- `jdStructuredText`
- `jdRubric`
- `matchSummary`
- `matchingDetails`
- `analysisStatus`
- timestamps

What belongs here:

- raw JD paraphrase output
- structured JD rubric JSON
- detailed matching breakdown
- future analysis reasoning or enrichment metadata

---

## 3. `InterviewPlan`

Purpose:

- store the generated interview planning document

Suggested fields:

- `sessionId`
- `userId`
- `settingsSnapshot`
- `candidateName`
- `jobTitle`
- `matchScore`
- `strengths`
- `gaps`
- `interviewFocus`
- `planPreview`
- `strategy`
- `questionPool`
- `fallbackRules`
- timestamps

Why this belongs in MongoDB:

- the plan is generated by AI
- question planning shape will likely evolve
- nested planning documents fit MongoDB better than SQL

---

## 4. `SessionTranscript`

Purpose:

- store transcript turns and the assembled transcript

Suggested fields:

- `sessionId`
- `userId`
- `turns`
- `fullTranscript`
- `lastTurnOrder`
- timestamps

Suggested turn structure:

- `speaker`
- `questionId`
- `text`
- `timestamp`
- `source`
- `durationSeconds`
- `metadata`

Why this collection matters:

- the current system already keeps transcript turns
- transcript is one of the most important user-visible assets in the interview flow
- transcript export should eventually read from here

---

## 5. `SessionFeedbackDetail`

Purpose:

- store the full feedback report detail

Suggested fields:

- `sessionId`
- `userId`
- `scores`
- `strengths`
- `gaps`
- `jobFitObservations`
- `improvementSuggestions`
- `modelMetadata`
- timestamps

Why it should stay out of PostgreSQL:

- report detail is nested and likely to evolve
- summary and analytics data should be kept separate from full narrative detail

---

## 6. `AiLog`

Purpose:

- store AI stage logs, request payloads, and debug records

Suggested fields:

- `sessionId`
- `userId`
- `stage`
- `status`
- `inputPayload`
- `outputPayload`
- `errorMessage`
- `traceId`
- `createdAt`

Recommended use:

- store logs for JD paraphrase
- store logs for CV/JD match
- store logs for interview follow-up generation

This is especially useful in development and debugging phases.

---

## Recommended Indexes

### PostgreSQL

- `users(email)` unique
- `users(google_sub)` unique where not null
- `interview_sessions(user_id, created_at desc)`
- `interview_sessions(status, created_at desc)`
- `uploaded_files(user_id, file_role, uploaded_at desc)`
- `job_description_inputs(session_id)` unique
- `parsed_profiles(session_id)` unique
- `parsed_skills(session_id, source_type)`
- `parsed_skills(skill_name)`
- `interview_questions(session_id, question_order)` unique
- `interview_responses(session_id, question_id)`
- `report_summaries(session_id)` unique

### MongoDB

- `DocumentContent.fileId` unique
- `SessionAnalysis.sessionId` unique
- `InterviewPlan.sessionId` unique
- `SessionTranscript.sessionId` unique
- `SessionFeedbackDetail.sessionId` unique
- `AiLog(sessionId, stage, createdAt)`

Optional:

- TTL index on `AiLog.createdAt` if logs should expire automatically

---

## How Current Features Map To Storage

## Authentication

Current behavior:

- Google login
- in-memory user service

Recommended storage:

- PostgreSQL `users`

---

## CV Upload

Current behavior:

- accepts CV upload
- extracts text
- stores recent CVs in memory

Recommended storage:

- file metadata -> PostgreSQL `uploaded_files`
- extracted text -> MongoDB `DocumentContent`
- recent CV list -> query PostgreSQL instead of in-memory array

---

## Job Description Input

Current behavior:

- user pastes raw JD text
- system paraphrases JD
- system builds structured rubric

Recommended storage:

- pasted input -> PostgreSQL `job_description_inputs`
- structured JD and rubric -> MongoDB `SessionAnalysis`

---

## Match Analysis

Current behavior:

- compares CV against JD
- produces match score and structured result

Recommended storage:

- summary fields -> PostgreSQL `parsed_profiles`
- normalized skills -> PostgreSQL `parsed_skills`
- detailed matching breakdown -> MongoDB `SessionAnalysis`

---

## Interview Plan

Current behavior:

- generates candidate and role context
- creates a session object

Recommended storage:

- session lifecycle -> PostgreSQL `interview_sessions`
- detailed plan -> MongoDB `InterviewPlan`

---

## Interview Flow

Current behavior:

- start
- reply
- pause
- resume
- end
- transcript stored in session memory

Recommended storage:

- status and timer state -> PostgreSQL `interview_sessions`
- actual questions used -> PostgreSQL `interview_questions`
- main answer records -> PostgreSQL `interview_responses`
- transcript turns -> MongoDB `SessionTranscript`

---

## Transcript Export

Current behavior:

- exports transcript from in-memory session data

Recommended storage:

- read transcript from MongoDB `SessionTranscript`
- if generating downloadable file, store file metadata in PostgreSQL `uploaded_files`

---

## Feedback Report

Current direction:

- summary shown in product requirements
- full detail expected later

Recommended storage:

- report summary -> PostgreSQL `report_summaries`
- full feedback detail -> MongoDB `SessionFeedbackDetail`

---

## Practical Architecture Judgement

From an engineering perspective, the right first priority is not to build every possible feature table.

The right first priority is to persist the data that the current app already creates but currently loses.

That means the most important first persistence targets are:

1. `users`
2. `uploaded_files`
3. `DocumentContent`
4. `job_description_inputs`
5. `interview_sessions`
6. `SessionAnalysis`
7. `InterviewPlan`
8. `SessionTranscript`

The next layer after that is:

1. `parsed_profiles`
2. `parsed_skills`
3. `interview_questions`
4. `interview_responses`
5. `report_summaries`
6. `SessionFeedbackDetail`
7. `AiLog`

This order is better because it stabilizes the current MVP data flow first.

---

## Recommended Implementation Phases

## Phase 1. Database Connection Layer

- connect MongoDB through Mongoose
- connect PostgreSQL through `pg`
- create centralized database bootstrap
- fail startup if required database connection cannot be established

---

## Phase 2. Foundational Schema Setup

- create PostgreSQL core tables
- create Mongoose models
- add indexes and uniqueness constraints
- standardize timestamp fields

---

## Phase 3. Replace In-Memory User And CV State

- move auth users from memory to PostgreSQL
- move recent CV records from memory to PostgreSQL
- store extracted CV text in MongoDB

---

## Phase 4. Persist JD And Analysis Flow

- store raw JD inputs
- store structured JD summary and rubric
- store detailed match results
- store normalized profile and skills

---

## Phase 5. Persist Interview Session Lifecycle

- replace session in-memory store with database-backed session records
- store transcript turns in MongoDB
- store question and response records in PostgreSQL
- persist pause, resume, end, and elapsed time data

---

## Phase 6. Reporting And Debugging

- store report summary and feedback detail
- support transcript export from stored transcript data
- add AI logs where needed for debugging

---

## Final Recommendation

For this MVP, the correct architecture is:

- PostgreSQL for business truth
- MongoDB with Mongoose for AI-generated and flexible document data
- file storage for binaries

The most important architectural decision is to stop relying on in-memory state for core user and interview data.

The second most important decision is to keep stable summary data in PostgreSQL and keep flexible AI workflow data in MongoDB.

That will give the project:

- a cleaner persistence model now
- less rewrite pressure later
- a better path to history, dashboard, analytics, and reporting features

---

## Privacy, Security, And Product-Readiness Schema Adjustments

If this project is intended to become a real product used by real users, the schema plan should not only optimize for feature delivery.

It also needs to support:

- privacy protection
- access control
- data retention control
- deletion workflows
- auditability
- safer handling of sensitive user-generated content

The current architecture should therefore be extended with product-grade privacy and security design.

---

## Privacy And Security Design Principles

### 1. Data minimization

Only store the data that is necessary for the product experience, debugging, analytics, and compliance.

Implication:

- do not duplicate raw CV text across many tables
- do not store file binaries inside databases
- do not keep raw prompts and transcript payloads forever

### 2. Separation of summary and raw sensitive content

Keep low-sensitivity summary data separate from high-sensitivity raw content.

Implication:

- PostgreSQL should mostly keep summary, ownership, and lifecycle state
- MongoDB should keep raw and flexible AI data with explicit retention and deletion controls

### 3. Every user-owned record must be traceable

Every sensitive record should be attributable to:

- a `user_id`
- a `session_id` where applicable

Implication:

- ownership checks become possible in backend authorization logic
- deletions and exports become safer and more auditable

### 4. Sensitive content must have a lifecycle

Sensitive data should not be assumed to live forever.

Implication:

- add retention timestamps
- add soft-delete markers
- support later anonymization

### 5. High-risk operations should be auditable

When users or admins access, export, or delete sensitive content, the system should be able to record that event.

---

## PostgreSQL Schema Adjustments For Privacy And Security

## 1. `users` adjustments

Add these fields:

- `privacy_policy_version varchar null`
- `terms_accepted_at timestamptz null`
- `marketing_consent boolean not null default false`
- `analytics_consent boolean not null default false`
- `consent_updated_at timestamptz null`
- `account_status varchar not null default 'active'`
- `deleted_at timestamptz null`
- `anonymized_at timestamptz null`

Why:

- real products need to track user consent state
- account deletion should not require immediate hard deletion
- soft delete and anonymization provide a safer operational path

---

## 2. `interview_sessions` adjustments

Add these fields:

- `data_retention_days integer null`
- `expires_at timestamptz null`
- `contains_sensitive_data boolean not null default true`
- `deletion_requested_at timestamptz null`
- `deleted_at timestamptz null`
- `anonymized_at timestamptz null`

Why:

- a session is the main container for sensitive interview data
- session-level retention makes cleanup and policy enforcement easier
- deletion requests should be trackable at the session level

---

## 3. `uploaded_files` adjustments

Add these fields:

- `is_encrypted boolean not null default true`
- `encryption_key_ref varchar null`
- `virus_scan_status varchar not null default 'pending'`
- `virus_scanned_at timestamptz null`
- `access_scope varchar not null default 'private'`
- `deleted_at timestamptz null`

Why:

- uploaded files are one of the highest-risk data categories
- file metadata should indicate whether scanning and encryption expectations were met
- `encryption_key_ref` should only point to a key identifier or managed key reference, not store secrets directly

---

## 4. `job_description_inputs` adjustments

Add these fields:

- `contains_pii boolean not null default false`
- `redacted_text text null`
- `deleted_at timestamptz null`

Why:

- job descriptions can include internal company or hiring information
- a redacted representation can support safer downstream processing and debugging

---

## 5. `parsed_profiles` adjustments

Recommended additions:

- `profile_source_version varchar null`
- `is_redacted boolean not null default false`

Important boundary:

- do not turn this table into another raw document store
- keep it as a low-sensitivity summary layer

---

## 6. `interview_responses` adjustments

Add these fields:

- `contains_sensitive_data boolean not null default true`
- `redacted_transcript_text text null`
- `deleted_at timestamptz null`

Why:

- user responses may contain company names, customer details, personal history, or private work context
- storing a redacted version provides a safer option for reporting and analytics

---

## 7. `report_summaries` adjustments

Recommended additions:

- `is_shareable boolean not null default false`

Why:

- a user-facing report might eventually support controlled sharing or export
- this should be explicit rather than implied

---

## Recommended New PostgreSQL Tables

## 1. `user_consents`

Purpose:

- preserve consent history rather than only the latest consent state

Fields:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `consent_type varchar not null`
- `status boolean not null`
- `policy_version varchar null`
- `captured_at timestamptz not null`
- `source varchar null`

Why:

- storing only the latest consent flags on `users` is not enough for history, audit, or product policy evolution

---

## 2. `audit_logs`

Purpose:

- record high-risk actions and sensitive data access events

Fields:

- `id uuid primary key`
- `actor_user_id uuid null references users(id)`
- `target_user_id uuid null references users(id)`
- `session_id uuid null references interview_sessions(id)`
- `action_type varchar not null`
- `resource_type varchar not null`
- `resource_id varchar not null`
- `status varchar not null`
- `ip_address inet null`
- `user_agent text null`
- `metadata jsonb null`
- `created_at timestamptz not null`

Recommended events:

- login
- file upload
- transcript export
- report export
- delete request
- privileged support or admin access to sensitive resources

---

## 3. `deletion_requests`

Purpose:

- support product-grade deletion workflows

Fields:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `resource_type varchar not null`
- `resource_id varchar not null`
- `status varchar not null`
- `requested_at timestamptz not null`
- `processed_at timestamptz null`
- `reason varchar null`

Why:

- deletion is usually a workflow, not just a single delete statement
- this creates a safe way to coordinate DB cleanup, file cleanup, and audit trails

---

## 4. `data_access_grants` for future admin or support access

This table is optional for the MVP, but should be reserved in the architecture if internal support or admin access may exist later.

Suggested fields:

- `id uuid primary key`
- `actor_user_id uuid not null references users(id)`
- `target_user_id uuid not null references users(id)`
- `resource_scope varchar not null`
- `granted_reason text not null`
- `expires_at timestamptz not null`
- `created_at timestamptz not null`

Why:

- support access to user data should never be informal or invisible
- explicit access grants reduce operational and privacy risk

---

## MongoDB Privacy And Security Adjustments

MongoDB is where much of the highest-risk content will live:

- raw CV text
- raw JD text
- transcript turns
- AI payloads
- debug logs

Each sensitive MongoDB collection should therefore support lifecycle and redaction fields.

Recommended common fields:

- `retentionUntil`
- `deletedAt`
- `redactionStatus`
- `containsSensitiveData`
- `accessScope`
- `schemaVersion`

---

## 1. `DocumentContent` adjustments

Add:

- `redactedText`
- `containsSensitiveData`
- `retentionUntil`
- `deletedAt`

Recommendation:

- raw extracted CV text should not necessarily be kept forever
- if product needs can be met with normalized or redacted content, raw content should be reduced over time

---

## 2. `SessionAnalysis` adjustments

Add:

- `promptVersion`
- `redactionStatus`
- `retentionUntil`
- `deletedAt`

Recommendation:

- keep detailed analysis while useful
- avoid indefinite storage of raw inputs where a redacted or summarized form is enough

---

## 3. `SessionTranscript` adjustments

Add:

- `redactedTranscript`
- `containsSensitiveData`
- `retentionUntil`
- `deletedAt`
- `encryptionMetadata`

Why:

- transcript is one of the most sensitive artifacts in the system
- it can contain personal history, employer information, and confidential work examples

---

## 4. `SessionFeedbackDetail` adjustments

Add:

- `redactedFeedback`
- `retentionUntil`
- `deletedAt`

Why:

- detailed feedback may include evidence excerpts derived from sensitive transcript content

---

## 5. `AiLog` adjustments

Add:

- `containsPromptData`
- `containsUserData`
- `retentionUntil`
- `deletedAt`

Strong recommendation:

- AI logs should have the shortest retention window in the system
- production systems should not keep full prompt and response payloads indefinitely

---

## Recommended Data Retention Direction

The exact retention policy should be a product and legal decision, but the schema should support it now.

Recommended direction:

- `users`: long-lived, with soft delete and eventual anonymization
- `uploaded_files`: retained only as long as the related product experience requires
- `DocumentContent`: short to medium retention
- `SessionTranscript`: medium retention
- `AiLog`: short retention
- `report_summaries`: longer retention because they are lower-sensitivity summaries

Key point:

- retention must be configurable and enforceable
- schema should not assume permanent storage of raw user content

---

## Access Control Implications For Schema

To support product-grade backend authorization:

- all user-owned resources should carry `user_id`
- all session-related resources should carry `session_id`
- exports and privileged data access should be auditable

This means schema is not just about storage shape.

It also defines what backend access control can safely enforce.

---

## Product-Grade Schema Change Summary

To make the architecture product-ready, add three extra layers on top of the original database plan.

### 1. Data governance fields

Across relevant tables and collections, add fields such as:

- `deleted_at`
- `anonymized_at`
- `retentionUntil` or `expires_at`
- `contains_sensitive_data`
- `redactionStatus`

### 2. Consent tracking

Add:

- `user_consents`

### 3. Audit and deletion workflow support

Add:

- `audit_logs`
- `deletion_requests`
- optional future `data_access_grants`

---

## Final Privacy And Security Recommendation

If this system is intended to become a real user-facing product, privacy and security should be part of the schema design from the beginning, not added as an afterthought.

The most important product-grade database changes are:

1. make sensitive data lifecycle explicit
2. separate raw sensitive content from summary content
3. support deletion and anonymization
4. track consent history
5. audit high-risk operations

This gives the architecture a better path toward:

- safer production use
- clearer internal governance
- easier user data deletion workflows
- lower long-term privacy risk
