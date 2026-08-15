# Phase 2 Review Brief — Semantic Assessment Intent and Framework Routing

> This is the human-review surface for Phase 2. The full operational plan is in [impact-first-past-example-phase-2-plan.xml](./impact-first-past-example-phase-2-plan.xml). Review this brief for scope and contract decisions; use the XML only when implementation or audit needs exact pseudocode.

## Review method

1. Review this brief for the goal, routing contract, files, tests, risks, and stop conditions.
2. Open only the linked XML section when a function-level detail needs checking.
3. During implementation, review the task-scoped diff and evidence matrix rather than rereading the full plan.

Phase 1 baseline is already pushed on `codex/impact-first-past-example` at commit `e83d2ce`. Phase 2 is an internal slice on the same branch and is not separately released.

## 1. One-sentence goal

Make semantic question intent—not literal wording, technical keywords, or seniority prompt decoration—select the framework route consistently from catalog/pool metadata through transcript persistence and report routing.

## 2. Scope decision

In scope:

- Give catalog snapshots from both 2026.1 and 2026.2 an explicit canonical `evidenceMode`.
- Make generated/legacy pool inference use the same resolver and stop silently defaulting every unknown question to `past_example`.
- Treat `past_example` as the semantic route `impact_first_past_example`, including non-literal prompts such as “What project are you most proud of?” and non-technical teamwork, conflict, failure, or learning examples.
- Preserve scenario, knowledge, credential, self-introduction, motivation, conversation, and generic role/process routes.
- Persist `assessmentIntent` and `parentAssessmentIntent` in the bounded transcript metadata already consumed by reports.
- Make report routing prefer explicit metadata and use wording only as a missing-metadata fallback.
- Keep the current follow-up targeted-dimension contract and preserve the root/parent route for later aggregation; do not create a second scored follow-up.
- Add focused backend tests, one owning RFC update, and one scoped change-log entry when implementation is authorized.

Explicitly deferred:

- Phase 3 Impact-first content extraction, five-level anchors, evidence reasons, and score arithmetic.
- Phase 4 overall-score composition, denominator rules, duration weighting, and scoring version cutover.
- Question wording, catalog seed content, catalog activation, ranking, eligibility, and live Mongo changes.
- Voice runtime, STT/TTS/VAD, text timing, frontend, exports, coaching copy, and public report schema.
- Old-report regeneration, migration, backfill, and compatibility redesign.

## 3. Canonical routing contract

### Source fields

| Field | Owner | Meaning in Phase 2 |
|---|---|---|
| `questionFamily` | pool/catalog metadata | Family/category identity; normalize behavioural spelling and opening/motivation/closing aliases. |
| `questionType` / `questionIntent` | catalog or generated source | Source taxonomy/provenance; not the final report framework by itself. |
| `evidenceMode` | prepared-question contract | Canonical evidence mode: `past_example`, `scenario_reasoning`, `knowledge_explanation`, `credential_verification`, or `process_reasoning`. |
| `assessmentIntent` | transcript/report routing | Derived route: `impact_first_past_example`, `scenario_reasoning`, `knowledge_explanation`, `credential_verification`, `self_intro`, `company_motivation`, `conversation`, `role_specific_reasoning`, or `direct_answer`. |
| `parentAssessmentIntent` | follow-up transcript metadata | The root/parent route that a follow-up supplements; it is not a second scored root. |

`assessmentIntent` is a bounded internal routing field. It is persisted in existing `Mixed` transcript metadata; no catalog or Mongo migration is introduced in Phase 2. `questionType` remains source taxonomy and is never treated as a seniority-specific framework.

### Precedence

1. Existing explicit `assessmentIntent`, when present and valid.
2. Root/parent intent already persisted on a follow-up.
3. Explicit family/category boundary for self-introduction, motivation, and conversation.
4. Explicit `evidenceMode`.
5. Catalog `questionType` plus ambiguity metadata.
6. Wording fallback only when the preceding fields are absent.
7. Unknown generic questions route to `direct_answer` or the explicit technical `process_reasoning` route; they never silently become `past_example`.

Technical words such as `implementation`, `validation`, `trade-offs`, or `risk` cannot override an explicit semantic route. Senior prompt variants therefore do not change framework identity when their source metadata is the same.

### Catalog mapping policy

| Source evidence | Canonical mode/route |
|---|---|
| Behavioural failure, learning, initiative, teamwork, conflict, or project reflection | `past_example` → `impact_first_past_example` |
| `bounded_scenario`, `How would`, `If`, or scenario catalog type | `scenario_reasoning` → existing scenario route |
| Principle/framework/explanation catalog type | `knowledge_explanation` → existing knowledge route |
| Credential or registration evidence | `credential_verification` → existing credential route |
| Generic present-tense workflow such as AI-assisted delivery or feature verification | `process_reasoning` → existing role-specific route |
| Opening, motivation, or closing family | Dedicated self-introduction, motivation, or conversation route |

The exact catalog version is not assumed to be live. The source-level mapping is tested against both 2026.1 and 2026.2 fixtures.

## 4. Important staged-release decision

Phase 2 establishes and persists `assessmentIntent`; Phase 3 will make the Impact-first evaluator consume that route. Until Phase 3 exists, the old analyzer-compatible rubric shape may remain as an internal carrier so the branch does not produce a false Impact-first score with no evaluator. This is not a second user-facing implementation or release: the branch is released once after the complete score-bearing framework is finished.

The Phase 2 acceptance assertion is therefore the canonical `assessmentIntent`, not a claim that Phase 2 alone can score Impact-first content.

## 5. Planned change surface

Production files likely to change:

- `backend/src/services/questions/questionArtifactHelpers.js` — pure canonical evidence-mode and assessment-intent resolver.
- `backend/src/services/questions/questionCatalogSelectionService.js` — attach explicit evidence mode to catalog snapshots without hardcoding the active version.
- `backend/src/services/questions/questionPoolComposerService.js` — reuse the resolver for generated/legacy/reserve paths and preserve explicit source metadata.
- `backend/src/services/masterAiService.js` — persist current and parent assessment intent in the existing bounded transcript metadata.
- `backend/src/services/report/turnRubricService.js` — use persisted/derived intent before wording fallback and expose route provenance without changing Phase 3 scoring dimensions.

Read-only dependency: `backend/src/services/agents/interviewerAgent.js` already carries `questionFamily`, `evidenceMode`, parent fields, and catalog provenance. Phase 2 does not edit it unless a focused test proves a field is lost there.

Tests likely to change:

- `backend/tests/robustness/questions/questionCatalogSelectionService.test.js`
- `backend/tests/robustness/questions/questionMetadataPersistence.test.js`
- `backend/tests/robustness/report/roleSpecificFrameworkRobustness.test.js`

The existing `questionPoolComposerService.test.js` suite is a required verification input, but is not forecast for modification unless the implementation exposes a concrete regression.

Documentation planned for an implementation turn:

- `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md`
- `repo-docs/change-log.md`

## 6. Function-level implementation contract

- `resolveCanonicalEvidenceMode(input)` receives category, family, question type/intent, text, and ambiguity mode; returns one stable mode plus a source reason. Explicit mode wins; missing metadata uses catalog/type or tightly bounded wording fallback.
- `resolveQuestionAssessmentIntent(input)` receives the normalized mode/family and optional parent route; returns one route key and provenance. It does not inspect seniority or award score.
- `buildCatalogQuestionSnapshots()` calls the resolver once per selected catalog item and stores the resulting `evidenceMode`; it keeps catalog version and prompt provenance unchanged.
- `buildBaseItem()` uses the same resolver for non-catalog items; an explicit `evidenceMode` survives unchanged, while generic technical process questions become `process_reasoning` rather than accidental `past_example`.
- `buildQuestionTranscriptMetadata()` derives `assessmentIntent` from the bounded interviewer output and derives `parentAssessmentIntent` from parent family/mode; it does not spread private candidate or job-description fields.
- `inferTurnRubric()` reads persisted intent first, then derives it from canonical metadata; it uses wording regexes only for degraded/missing metadata and keeps existing scenario/knowledge/motivation/self-introduction routing separate.

## 7. Tests and verification

The routing matrix must cover:

- every semantic past-example family, including `proud_project`, teamwork, conflict, learning, failure, and non-literal prompts;
- scenario, knowledge, credential, motivation, self-introduction, conversation, and generic process cases;
- behavioural family plus technical keywords;
- senior/junior wording variants with identical source metadata;
- both catalog seed versions;
- root plus follow-up parent metadata;
- missing metadata and deterministic wording fallback.

Verification commands after implementation:

```text
cd backend && ./node_modules/.bin/vitest run \
  tests/robustness/questions/questionCatalogSelectionService.test.js \
  tests/robustness/questions/questionMetadataPersistence.test.js \
  tests/robustness/report/roleSpecificFrameworkRobustness.test.js \
  tests/robustness/questions/questionPoolComposerService.test.js
cd backend && npm run lint
git diff --check
git diff --name-only -- backend/src frontend/src | rg 'frontend|voice|score|coaching|export'  # must be empty for forbidden surfaces
```

No live Mongo, real provider, browser, frontend, or real AI evaluation is required for this phase.

## 8. Stop conditions

Stop and report before implementation continues if:

- a catalog snapshot still reaches the report path without a deterministic evidence mode;
- an explicit metadata route can be changed by a seniority wording variant or technical keyword;
- a follow-up loses its parent/root intent or becomes an additional root score candidate;
- the change needs `reportScoreService.js`, `answerFrameworkService.js`, frontend/public schema, catalog seed content, live catalog activation, or voice runtime edits;
- the forecast exceeds 10 task-owned files or 500 incremental lines;
- a missing source field is silently converted to `past_example` or a score-bearing zero;
- existing dirty edits overlap a planned file.

## 9. Review request

Review the route contract, the staged-release boundary, the catalog mapping table, and the five-file production boundary. If accepted, the XML contains the implementation-level pseudocode, tests, verification commands, and three complete ten-item audits; implementation still requires a separate explicit request.

## 10. Research status

`research.md` is the source of truth and remains `ready for plan`. The Phase 2 read-only research confirmed:

- catalog snapshots currently bypass evidence-mode inference;
- router keyword precedence can override semantic families;
- concrete catalog families such as scenario and AI/ML families are not directly routed;
- transcript persistence already carries family/evidence metadata but does not persist a canonical derived route;
- 2026.1 and 2026.2 share the relevant semantic families; 2026.2 adds ambiguity/clarification metadata;
- no material human question remains. Live catalog activation is explicitly non-material to this plan.
