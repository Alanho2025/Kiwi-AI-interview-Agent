# Semantic Bugs Audit Report: Batch 1 — Infra, Models, Repositories & Configs

This document contains an exhaustive file-by-file audit of all **64 files** in Batch 1 (`backend/src/config/`, `backend/src/db/`, `backend/src/repositories/`).

---

## Batch 1 Complete File Checklist (64 / 64 Files Audited)

### Configuration & Constants (20 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [aiUsagePricing.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/aiUsagePricing.js) | None | **None** | Pricing constants per LLM model cleanly configured. |
| ✅ **PASSED** | [aiUsageTrackingConstants.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/aiUsageTrackingConstants.js) | None | **None** | AI usage stage & operation constants clean. |
| ✅ **PASSED** | [env.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/env.js) | None | **None** | Environment variable defaults & origin parsers clean. |
| ✅ **PASSED** | [harnessConfig.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/harnessConfig.js) | None | **None** | Harness shadow execution mode settings clean. |
| ✅ **PASSED** | [interviewBlueprints.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/interviewBlueprints.js) | None | **None** | Seniority blueprint ratios & question limits clean. |
| ✅ **PASSED** | [nzWorkplaceDimensions.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/nzWorkplaceDimensions.js) | None | **None** | NZ workplace culture fit dimension constants clean. |
| ✅ **PASSED** | [opsLiteConfig.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/opsLiteConfig.js) | None | **None** | OpsLite telemetry thresholds clean. |
| ✅ **PASSED** | [postgresSchemaStatements.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/postgresSchemaStatements.js) | None | **None** | PostgreSQL table definitions and indices clean. |
| ✅ **PASSED** | [realWorldInterviewPatterns.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/realWorldInterviewPatterns.js) | None | **None** | Interview pattern taxonomy clean. |
| ✅ **PASSED** | [recordingConfig.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/recordingConfig.js) | None | **None** | Audio recording upload constants clean. |
| ✅ **PASSED** | [retentionConfig.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/retentionConfig.js) | None | **None** | Retention job policy configuration clean. |
| ✅ **PASSED** | [retentionPostgresSchemaStatements.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/retentionPostgresSchemaStatements.js) | None | **None** | Retention audit schema SQL statements clean. |
| ✅ **PASSED** | [roleCanonicalRules.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/roleCanonicalRules.js) | None | **None** | Canonical job title regex rules clean. |
| ✅ **PASSED** | [schemaValidationConstants.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/schemaValidationConstants.js) | None | **None** | Request schema validation rules clean. |
| ✅ **PASSED** | [sessionConstants.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/sessionConstants.js) | None | **None** | Session mode constants clean. |
| ⚠️ **ISSUES FOUND** | [speechConfidenceConfig.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/speechConfidenceConfig.js#L27) | 🤖 **Track A: AI Semantics** | 🟠 **High** | `FILLER_TRANSCRIPTS` includes valid single-word responses (`'yes'`, `'no'`, `'okay'`), causing valid single-word confirmation turns to be falsely rejected as filler speech. |
| ✅ **PASSED** | [speechPhraseList.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/speechPhraseList.js) | None | **None** | Dynamic ASR phrase list hints clean. |
| ✅ **PASSED** | [taxonomyAliases.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/taxonomyAliases.js) | None | **None** | Technology skill aliases clean. |
| ✅ **PASSED** | [transcriptReplacements.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/transcriptReplacements.js) | None | **None** | Static transcript phonetic replacements clean. |
| ✅ **PASSED** | [voiceOptimizationConfig.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/voiceOptimizationConfig.js) | None | **None** | Voice latency thresholds clean. |

---

### Database Infrastructure & Models (32 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [bootstrap.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/bootstrap.js) | None | **None** | DB bootstrap initialization clean. |
| ✅ **PASSED** | [initPostgresSchema.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/initPostgresSchema.js) | None | **None** | Postgres schema migration clean. |
| ✅ **PASSED** | [initializeRetentionSchema.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/initializeRetentionSchema.js) | None | **None** | Retention schema initialization clean. |
| ✅ **PASSED** | [mongo.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/mongo.js) | None | **None** | Mongoose connection lifecycle clean. |
| ✅ **PASSED** | [postgres.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/postgres.js) | None | **None** | PG Pool query & transaction helper clean. |
| ✅ **PASSED** | [runtimeRetentionIndex.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/runtimeRetentionIndex.js) | None | **None** | Runtime index registration clean. |
| ✅ **PASSED** | [aiLogModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/aiLogModel.js) | None | **None** | Mongoose schema clean. |
| ✅ **PASSED** | [aiUsageEventModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/aiUsageEventModel.js) | None | **None** | Usage event tracking schema clean. |
| ✅ **PASSED** | [companyValuesProfileModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/companyValuesProfileModel.js) | None | **None** | Company values schema clean. |
| ✅ **PASSED** | [cvArtifactCacheModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/cvArtifactCacheModel.js) | None | **None** | CV artifact cache schema clean. |
| ✅ **PASSED** | [cvQuestionSeedModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/cvQuestionSeedModel.js) | None | **None** | CV question seed schema clean. |
| ✅ **PASSED** | [documentChunkModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/documentChunkModel.js) | None | **None** | Document chunk embedding schema clean. |
| ✅ **PASSED** | [documentContentModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/documentContentModel.js) | None | **None** | Document content schema clean. |
| ✅ **PASSED** | [evaluationGroundTruthModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/evaluationGroundTruthModel.js) | None | **None** | Evaluation benchmark ground truth schema clean. |
| ✅ **PASSED** | [harnessWorkflowRunModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/harnessWorkflowRunModel.js) | None | **None** | Harness workflow run schema clean. |
| ✅ **PASSED** | [interviewPlanModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/interviewPlanModel.js) | None | **None** | Interview plan schema clean. |
| ✅ **PASSED** | [interviewQuestionPoolItemModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/interviewQuestionPoolItemModel.js) | None | **None** | Question pool item schema clean. |
| ✅ **PASSED** | [jdArtifactCacheModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/jdArtifactCacheModel.js) | None | **None** | JD artifact cache schema clean. |
| ✅ **PASSED** | [jdQuestionFilterModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/jdQuestionFilterModel.js) | None | **None** | JD question filter schema clean. |
| ✅ **PASSED** | [matchAnalysisRecordModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/matchAnalysisRecordModel.js) | None | **None** | Match analysis record schema clean. |
| ✅ **PASSED** | [matchArtifactCacheModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/matchArtifactCacheModel.js) | None | **None** | Match artifact cache schema clean. |
| ✅ **PASSED** | [normalizedCvProfileModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/normalizedCvProfileModel.js) | None | **None** | Normalized CV profile schema clean. |
| ✅ **PASSED** | [normalizedJdRubricModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/normalizedJdRubricModel.js) | None | **None** | Normalized JD rubric schema clean. |
| ✅ **PASSED** | [questionCatalogItemModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/questionCatalogItemModel.js) | None | **None** | Question catalog schema clean. |
| ✅ **PASSED** | [ragBenchmarkCaseModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/ragBenchmarkCaseModel.js) | None | **None** | RAG benchmark case schema clean. |
| ✅ **PASSED** | [sessionAnalysisModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/sessionAnalysisModel.js) | None | **None** | Session analysis schema clean. |
| ✅ **PASSED** | [sessionFeedbackDetailModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/sessionFeedbackDetailModel.js) | None | **None** | Session feedback detail schema clean. |
| ✅ **PASSED** | [sessionReportModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/sessionReportModel.js) | None | **None** | Session report schema clean. |
| ✅ **PASSED** | [sessionTranscriptModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/sessionTranscriptModel.js) | None | **None** | Session transcript schema clean. |
| ✅ **PASSED** | [tokenUsageModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/tokenUsageModel.js) | None | **None** | Token usage schema clean. |
| ✅ **PASSED** | [usageDailyRollupModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/usageDailyRollupModel.js) | None | **None** | Daily usage rollup schema clean. |
| ✅ **PASSED** | [userCoachingMemoryModel.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/db/models/userCoachingMemoryModel.js) | None | **None** | User coaching memory schema clean. |

---

### Repositories (12 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [auditRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/auditRepository.js) | None | **None** | Audit log repository clean. |
| ✅ **PASSED** | [documentRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/documentRepository.js) | None | **None** | RAG document repository clean. |
| ✅ **PASSED** | [fileRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/fileRepository.js) | None | **None** | File upload repository clean. |
| ✅ **PASSED** | [harnessWorkflowRunRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/harnessWorkflowRunRepository.js) | None | **None** | Harness workflow repository clean. |
| ✅ **PASSED** | [mongoRetentionModelRegistry.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/mongoRetentionModelRegistry.js) | None | **None** | Mongo model registry clean. |
| ✅ **PASSED** | [mongoRetentionRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/mongoRetentionRepository.js) | None | **None** | Mongo retention repository clean. |
| ✅ **PASSED** | [postgresRetentionRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/postgresRetentionRepository.js) | None | **None** | Postgres retention repository clean. |
| ✅ **PASSED** | [recordingUploadRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/recordingUploadRepository.js) | None | **None** | Recording upload repository clean. |
| ✅ **PASSED** | [retentionJobRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/retentionJobRepository.js) | None | **None** | Retention job repository clean. |
| ✅ **PASSED** | [sessionDocumentRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/sessionDocumentRepository.js) | None | **None** | Session document repository clean. |
| ⚠️ **ISSUES FOUND** | [sessionRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/sessionRepository.js#L311) | ⚙️ **Track B: Code Logic** | 🟡 **Medium** | `createInterviewResponseRecord` hardcodes `contains_sensitive_data = true` for every response record without checking if PII was present, corrupting compliance tagging. |
| ✅ **PASSED** | [userRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/userRepository.js) | None | **None** | User data repository clean. |
