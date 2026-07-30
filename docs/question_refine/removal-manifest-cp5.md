# QI-CP5 Legacy Removal Manifest & Retirement Audit

> **Status: Owner Approved Audit Manifest**
> **Master Plan:** [Voice Question Intelligence Master Plan](../voice-question-intelligence-master-plan.md)
> **Checkpoints:** CP1–CP5

## 1. Goal

Identify deprecated aliases, legacy question pool preparation fallbacks, feature flags, and historical data adapters in the Question Intelligence path. Establish explicit retirement boundaries and removal conditions so legacy code is retired safely without breaking active session snapshots or reports.

---

## 2. Audited Legacy Items and Retirement Boundaries

| Legacy Item / Identifier | Current Role / Location | Removal Condition / Gate | Action on Retirement |
| :--- | :--- | :--- | :--- |
| **`advanced` Seniority Alias** | Read-mapped to `senior` in `questionCatalogSelectionService.js` and `cvQuestionSeedService.js`. | Keep compatibility mapper for historical database sessions created before 2026. | Do not remove reader mapper; reject new session writes requesting `advanced`. |
| **Legacy Direct Unversioned Pool Preparation** | Pre-CP1 pool composer in `questionPoolComposerService.js`. | CP5 Promotion to `enforce` mode with CP5 Owner Approval. | Retain as fallback handler for `executeRollbackFallback()`. |
| **Unrestricted AI/ML Prompt Invention** | Ad-hoc LLM question generation without global catalog checks. | CP5 Evaluation Benchmark Pass rate = 100%. | Retain global catalog check as mandatory guard layer. |
| **`shadow` Diagnostic Traces** | `rolloutTraces` attached to active session diagnostics. | Retain for diagnostic auditing across `shadow`, `observe`, and `warn` modes. | Redact PII and prune traces older than session retention window (30 days). |

---

## 3. Mandatory Safety Rules for Removal

1. **Immutable Historical Snapshots**: Old session snapshots (`InterviewQuestionPoolItemModel`) and generated candidate reports must NEVER be mutated or deleted during legacy cleanup.
2. **Rollback Availability**: The legacy pool ranker and fallback handlers MUST remain callable as targets for `executeRollbackFallback()`.
3. **No Unapproved Enforce**: Code removal MUST NOT automatically promote rollout mode from `shadow` / `observe` / `warn` to `enforce`.
