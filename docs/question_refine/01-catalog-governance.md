# QI-CP1 — Question Catalog Governance and Curated Seed

> **Status: CP1 content review is approved and the `2026.1` staging catalog is activated.**
> **Execution mode: only the 21 digest-bound `approved` entries can enter a new Voice session; later content changes require a new review and activation.**

Master authority: [Voice Question Intelligence Master Plan](../voice-question-intelligence-master-plan.md). This checkpoint is the only authority for CP1-specific scope; it does not override the Master Plan, root `AGENTS.md`, or `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`.

## 1. Overview — use this checkpoint when

Use CP1 to establish a reusable, reviewable question-content authority before changing question selection, voice behavior, or reports. An implementation agent needs only this document, Master Plan §§5–6.3, the current `InterviewQuestionPoolItem` model, the current question composer/preparation services, and the relevant tests.

Do not load future checkpoint documents unless a dependency explicitly requires them.

## 2. Goal and current baseline

### Goal

Create a versioned, no-PII question catalog and curated seed process that can safely supply approved question families to future Voice session pools. The catalog must prevent runtime LLM invention of AI / ML interview themes while preserving the current session-scoped prepared pool as the source of truth for an actual interview.

### Confirmed baseline

- `InterviewQuestionPoolItem` is private and session-scoped: it carries `userId`, `sessionId`, evidence links, status, rank trace and retention. It is not a global catalog.
- Existing question sources include CV seeds, JD requirements / filters, match gaps, common templates and fallback. `backend/src/data/nzCultureQuestions.js` remains separate curated source data.
- `QuestionCatalogItem`, the versioned `2026.1` seed, deterministic AI/ML taxonomy, lifecycle validation and explicit-approval script are implemented. Product Owner approval is recorded by `heminghan`; staging Mongo database `test` contains 21 unique approved entries.

### Target outcome

New Voice sessions can select only `approved` reusable content after a runtime containing this implementation is deployed. Each selected item is copied into that session's prepared pool with the catalog version and selection provenance, so later catalog edits never rewrite historical questions or reports.

## 3. Scope and non-goals

### In scope

- A global `QuestionCatalogItem` contract and versioned seed manifest.
- Curated family definitions for motivation, behavioral, career-transition, AI and ML questions.
- AI-delivery signal taxonomy, research provenance and human approval workflow.
- A private Voice session-pool snapshot mapping from catalog item to selected prompt provenance.
- Fixtures and review artifacts needed to prove catalog eligibility and no-PII boundaries.

### Non-goals

- Activating draft content or running the approval command without CP1 reviewer sign-off.
- Text interview behavior, report dimensions, external crawling, or automatic content publishing.
- Loading an external question bank into the product verbatim.
- Building an admin UI, a web crawler, automated catalog publishing, or a new LLM orchestrator.
- Migrating or deleting the existing NZ question data in this checkpoint.

## 4. Approved design defaults to preserve

| Decision | CP1 rule |
| --- | --- |
| Content authority | Global catalog owns reusable content; session pool owns per-session snapshot and history. |
| Lifecycle | Only `approved` catalog entries may be selected by a future runtime. `draft`, `deprecated` and `disabled` are excluded. |
| Versioning | Meaningful changes to wording, eligibility, expected signals or scoring relevance create a new version; history is immutable. |
| Privacy | Catalog holds no CV/JD/transcript text, user ID, private report text or raw model reasoning. |
| Source use | Store minimal research metadata and URLs; do not copy third-party answer keys or question banks. |
| Failure | Catalog unavailability must retain the existing bounded pool/fallback behavior and be recorded as degraded, not fabricated as coverage. |

## 5. Implemented local contracts

### 5.1 `QuestionCatalogItem`

```js
{
  catalogQuestionId: "ai_assisted_delivery",
  catalogVersion: "2026.1",
  lifecycle: "draft | approved | deprecated | disabled",
  questionFamily: "ai_assisted_delivery",
  questionType: "ai_workflow",
  competency: "reliable_ai_delivery",
  targetLevels: ["junior", "intermediate", "senior"],
  roleEligibility: {
    roleFamilies: ["software", "data", "ai_solution"],
    requiredJdSignals: [],
    optionalCandidateSignals: ["ai_project", "coding_project"]
  },
  promptVariants: [],
  expectedSignals: ["ownership", "verification", "result"],
  followUpPolicy: [],
  ambiguityPolicy: { mode: "none" },
  researchBasis: {
    frequencyBand: "high | role_specific | curated",
    sources: [],
    reviewedAt: "YYYY-MM-DD"
  },
  humanReview: { reviewer: null, approvedAt: null }
}
```

`promptVariants` may contain reusable wording and placeholders, but not copied CV/JD/private evidence. Contextualization happens only when a future session creates its private snapshot.

### 5.2 Catalog-to-session snapshot contract

CP1/CP2 now write these optional fields to a Voice session pool item:

```js
{
  catalogQuestionId,
  catalogVersion,
  targetLevel,
  questionType,
  testedSignals,
  eligibilityReason,
  selectionPolicy,
  ambiguityMode,
  reportDimensions
}
```

The composer receives only `approved` items, only for Voice sessions, and copies the selected wording plus provenance into the private pool. Text sessions do not load catalog content. If Mongo/catalog loading is unavailable, the existing pool remains usable and the preparation result records `catalog_unavailable`.

### 5.3 AI-delivery signal taxonomy

The detailed seed taxonomy remains in Master Plan §6.2.1. CP1 must represent its categories as versioned aliases, not scattered runtime regexes:

- direct AI-delivery roles and responsibilities;
- foundation model/provider/API signals;
- coding assistants and coding agents;
- agent and orchestration frameworks;
- MCP, tool-calling and interoperability patterns;
- RAG and knowledge-grounding patterns;
- prompt/context patterns;
- evaluation, observability and safety patterns;
- model serving / AI infrastructure patterns;
- generic / weak AI wording.

Each alias needs `canonicalKey`, signal family, `strong | medium | weak`, lifecycle, last-reviewed date and source. The resolution rule is deterministic:

1. direct AI-delivery role or one strong signal => `explicit_ai_delivery`;
2. two distinct medium signals => `explicit_ai_delivery`;
3. one medium signal => higher AI-workflow priority, not a mandatory second AI family;
4. weak signal => optional AI judgement only;
5. ML signals remain separate and never follow merely from an AI tool name.

## 6. Functional requirements

1. A catalog seed is reviewable before it becomes active.
2. Every AI/ML entry records research basis, role eligibility, level variants, expected signals and at least one `not eligible` counterexample.
3. All user-requested families are represented: company/role/internship motivation, failure, self-learning, initiative, teammate support, career transition, AI Solution motivation, proud/underperforming project, conflict, NZ-context, coding ownership and AI/ML groups.
4. Sensitive families such as NZ study/work and career transition require explicit candidate-provided signals; they must never be inferred from name, nationality, accent or model speculation.
5. Catalog wording must not ask for confidential source code, customer data, system prompts, credentials or NDA-protected material.
6. A catalog item can be disabled without mutating existing session snapshots.
7. Existing question sources continue to work when the catalog is not yet present or is unavailable.

## 7. BDD acceptance scenarios

### Approved catalog item can become eligible later

```gherkin
Given an approved ai_assisted_delivery catalog item for Software roles
And a new Software Voice session with no CV mention of AI
When CP2 evaluates eligibility
Then the item is eligible under the Software/Data baseline rule
And its catalog ID and version can be copied into the private session pool
And no candidate data is written into the global catalog
```

### Draft or disabled item cannot be selected

```gherkin
Given a catalog item with lifecycle draft or disabled
When a future session pool is prepared
Then the item is excluded before ranking
And the trace states lifecycle_not_approved
```

### Weak generic AI wording does not manufacture an agent interview

```gherkin
Given a non-technical JD that only says "interest in AI"
When the taxonomy is resolved
Then it is weak evidence for optional AI judgement
And it does not satisfy explicit_ai_delivery
And no RAG, agent, ML or infrastructure family is reserved
```

### Catalog changes preserve history

```gherkin
Given a completed session snapshot using catalog version 2026.1
When the source catalog item is deprecated in version 2026.2
Then the old session and report remain reproducible from 2026.1
And new sessions do not select the deprecated item
```

## 8. Verification and evidence

Required before CP1 human review:

- schema / seed validation for lifecycle, version, required fields and no-PII fields;
- fixtures for every signal strength and every AI / ML role boundary;
- fixtures for all requested behavioral/motivation/career families;
- a provenance review table containing source date, category, reviewer decision and reason;
- compatibility test showing current pool preparation works without catalog selection;
- `git diff --check` and applicable Markdown/spec validation.

Not proof of completion: a valid seed file, a passing fixture or a catalog database record alone. Browser, voice, live provider and production behavior are out of CP1.

## 9. CP1 human checkpoint

The owner reviews:

- the initial catalog family list and English wording tone;
- AI-delivery taxonomy aliases, strength rules and tool-name lifecycle policy;
- research sources and the distinction between market input and product truth;
- sensitive-topic enablement rules;
- catalog/version/no-PII boundary and legacy fallback.

Possible decision: `approved`, `revise`, `blocked`, or `deferred`. CP1 approval permits activation of this reviewed catalog version only; it does not authorize CP3 work, report changes, or automatic future catalog publishing.

For the implemented seed, activation was a deliberate database action: the CP1 draft content and CP2 executable policy were approved first, then `npm run question-catalog:seed` stored 21 drafts and `QUESTION_CATALOG_REVIEWER=heminghan npm run question-catalog:approve` activated all 21. A read-only post-check confirmed database `test`, 21 unique IDs, lifecycle `approved` for all entries, and matching CP1/CP2 source digests.

The active review surfaces are the generated [full catalog, variants and taxonomy artifact](reviews/cp1-2026.1-catalog-full-review.md) and the compact [CP1 decision sheet](reviews/cp1-2026.1-catalog-review.md). A byte-for-byte drift test keeps the generated artifact aligned with source. Activation requires an approved source-controlled CP1 review manifest whose reviewed ID set and SHA-256 governance digest both match the question items, AI-delivery taxonomy and ML aliases, plus a separately approved CP2 executable-policy manifest. An environment reviewer name alone cannot activate content.

## 10. Stop conditions and bounded remediation

Apply Master Plan §13. A schema/retention/privacy concern, an external source licensing issue, or a proposed global catalog containing candidate data is a first-failure hard stop. For an ordinary deterministic CP1 root cause, make at most three distinct evidence-backed remediation attempts, then prepare an issue draft and continue only independent work.

## 11. Exit record

Record: catalog version, approved families, reviewer decision, unresolved aliases, fixture results, compatibility evidence, privacy conclusion, rollback (disable new catalog selection), and the explicit next authority boundary.
