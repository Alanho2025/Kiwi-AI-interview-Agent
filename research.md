# Impact-first Past Example Framework Research

## Research status

- Status: **READY FOR PLAN — owner alignment round 3 resolved every material product decision**
- Research goal: determine whether the current answer-framework scoring matches the real mock-interview guidance `Outcome (quantitative or comparison) -> problem solving -> role -> 2-3 relevant approaches/actions/decisions -> learning`, with a voice-answer target of `90-120 seconds`, and identify which question types could validly use it.
- Allowed output in this slice: this research document only. No scoring, question, UI, test, database, or product-document code was changed.
- Blocking condition: **None.** No further Grill Me question remains. Live catalog activation is still unverified, but both inspected catalog versions produced the same relevant routing outcomes, so that evidence gap does not change the plan boundary.
- Evidence boundary: repository source, focused tests, documentation, and deterministic function-level probes were inspected. No live Mongo catalog, real provider, browser interview, production report, or human calibration set was executed.

## Interpretation of the mock-interview guidance

The guidance is understandable as a project-impact answer structure:

1. **Outcome**: lead with what changed, using either quantitative evidence or an explicit comparison; a bare positive claim is insufficient.
2. **Problem solving**: explain the actual problem, constraints, reasoning, and decision process.
3. **Role**: separate the candidate's own ownership from the team's work.
4. **Approaches / actions / decisions**: give two or three substantive moves appropriate to the question; technical depth is required only for a technical example.
5. **Learning**: close with a lesson or what would be changed next time.
6. **Delivery**: in the current scope, keep the substantive voice answer within 90-120 seconds.

This resembles a reverse-ordered variant of STAR/STARR, but it is not equivalent to the current STARR or role-specific rubric. Owner alignment established that Outcome-first order is score-bearing, Outcome may be quantitative or comparative, and the new framework applies by semantic past-example intent rather than literal wording or selected technical topics. The fourth element may use any question-relevant approaches, actions, or decisions. Round 2 also made voice timing the first future change, deferred text-interview timing, and rejected a three-state `missing / partial / clear` score as too general to distinguish answer quality.

## Evidence inspected

### Current scoring and report flow

- Framework definitions and resolver: `backend/src/services/report/answerFrameworkService.js:3-121`.
- Rubric routing and per-turn structure analysis: `backend/src/services/report/turnRubricService.js:12-181`, `273-387`.
- Role-specific signal matching and normalization: `backend/src/services/report/roleAnswerAnalysisService.js:3-77`.
- STARR signal scoring: `backend/src/services/aiControl/starRubricService.js:8-73`.
- Deterministic report turn construction: `backend/src/services/agents/reportGeneratorAgent.js:68-128`, `235-334`.
- Overall interview score formula: `backend/src/services/report/reportScoreService.js:3-35`.
- Candidate score explanation: `backend/src/services/report/reportScoringExplanationService.js:1-49`.
- Report schema normalization and persistence: `backend/src/utils/schemaHelpers.js:152-214`; `backend/src/db/models/sessionReportModel.js:14-36`.
- Candidate framework UI: `frontend/src/components/report/TurnBreakdownSection.jsx:212-248`.

### Question selection and metadata flow

- Catalog definitions: `backend/src/data/questionCatalogSeed2026_2.js:93-144`, `214-347`; 2026.1 was compared and produced the same relevant routing outcomes.
- Catalog approval preference and persistence: `backend/src/services/questions/questionCatalogRepository.js:21-43`, `49-104`.
- Catalog snapshot construction: `backend/src/services/questions/questionCatalogSelectionService.js:204-268`.
- Non-catalog evidence-mode inference: `backend/src/services/questions/questionPoolComposerService.js:149-168`, `190-277`.
- Pool composition: `backend/src/services/questions/questionPoolComposerService.js:646-676`.
- Transcript metadata persistence: `backend/src/services/masterAiService.js:303-352`, `930-998`.

### Timing and coaching flow

- Voice delivery extraction and persistence: `backend/src/services/voice/voiceDeliveryAnalyzerService.js:25-125`; `backend/src/services/voice/realtimeVoiceTurnService.js:203-289`, `475-501`.
- Text answer endpoint: `backend/src/controllers/interviewTurnController.js:19-74`.
- Report interview metrics: `backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js:133-152`.
- Backend and frontend concision coaching: `backend/src/services/agents/reportGenerator/reportCoachingBuilder.js:28-68`; `frontend/src/utils/reportView/coaching.js:18-21`, `72-77`.
- Current owning report RFC and change log: `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md:210-235`; `repo-docs/change-log.md:436-444`.

### External structured-scoring guidance

- The [Public Service Commission of Canada structured-interview guide](https://www.canada.ca/en/public-service-commission/services/public-service-hiring-guides/appointment-processes-how-conduct-interviews.html) says a five-point scale is typically suitable when meaningful distinctions are needed, but each point should be distinguished with qualification-specific behavioural evidence. It also recommends recording a brief evidence-based rationale for each rating and warns that precision comes from defining expected answers at proficiency levels, not merely reusing generic indicator labels.
- The [U.S. Office of Personnel Management guidance on customized rating scales](https://www.opm.gov/frequently-asked-questions/assessment-policy-faq/structured-interviews/how-do-i-develop-a-customized-rating-scale-for-structured-interviews/) requires choosing proficiency levels, creating behavioural or situational examples for each level, and deciding how each question is scored. Its [official five-level example](https://piv.opm.gov/policy-data-oversight/assessment-and-selection/examples/structured-interview-example.pdf) pairs level definitions with progressively stronger behavioural examples.
- Research implication for this product: the owner's objection to three broad states is supported. A five-level scale should not be one generic `poor -> excellent` ladder copied across all components. Outcome, problem solving, role, approaches, learning, placement, and duration each need their own observable anchors. The official sources support that design principle; they do not determine this product's weights, exact time bands, or score thresholds.

## Current runtime trace

```text
approved catalog item / generated pool item
  -> prepared question pool
  -> interviewer output
  -> AI transcript turn metadata
  -> accepted question-answer pair
  -> inferTurnRubric(question text + question metadata)
  -> analyzeTurnStructure(answer)
  -> frameworkBreakdown.normalizedScore (0-10)
  -> average all non-conversation turns with a finite framework score
  -> report overall/interviewPerformance (0-100)
  -> generic framework cards in candidate report UI
```

The report scorer gives equal turn-level weight to every non-conversation finite framework score. It does not verify that the framework has any applicable dimensions. Therefore, replacing a framework is not merely a wording or UI change: if its normalized score enters the current pipeline, it directly changes the overall interview score (`reportScoreService.js:3-12`).

## Confirmed current behaviour

### 1. Current role-specific dimensions only partially overlap

The default role-specific rubric scores six dimensions:

| Current dimension | Partial relationship to mock guidance | Material mismatch |
|---|---|---|
| Context / Goal | problem solving | Does not require a precise problem, constraint, or root cause. |
| Approach | technical approach | One keyword can satisfy it; no 2-3 count or technical substance check. |
| Judgement / Trade-offs | problem solving | Does not independently establish compared options or decision quality. |
| Risk / Quality / Ethics | no direct equivalent | Useful for some technical questions but absent from the proposed five-part structure. |
| Validation / Verification | may support technical approach | Validation is not an explicit target element in the proposed structure. |
| Outcome / Value | outcome | Does not require a number, baseline, comparison, or attributable impact. |

There is no independent current dimension for personal role/ownership, quantitative-or-comparative outcome evidence, two-or-three relevant approaches/actions/decisions, learning, answer order, or 90-120 second voice delivery.

### 2. Current role-specific scoring is binary keyword detection

`signalStatus` returns only `clear = 10` or `missing = 0`; the later `partial` feedback branch is unreachable (`roleAnswerAnalysisService.js:3-7`, `52-61`). A single matching word can receive full dimension credit without proving that the evidence is specific, correctly attributed, or connected to the question.

The generic answer evidence extractor already detects some personal action, validation, outcome, metric, and reflection signals (`answerEvidenceSignalService.js:5-27`), but those signals are not the input to the role-specific framework analyzer. Its metric pattern also covers only a limited set of units, so it is not yet a sufficient contract for number-plus-comparison scoring.

### 3. Deterministic probes confirm the mismatch

Function-level probes against the current analyzer produced these observations:

- A strong project answer containing personal backend ownership, three approaches, a `40%` result, a before/after latency comparison, and learning scored `8.33/10`; it lost only the current risk/quality dimension. The five requested elements were not individually visible or auditable.
- A weak answer equivalent to “We used RAG and an LLM API” scored `1.67/10` because one approach keyword was enough for full Approach credit.
- A `direct_answer` turn with zero dimensions produced `normalizedScore = 0`; combining it with one `10/10` role-specific turn produced an overall score of `50/100`. This confirms that an empty, non-applicable direct rubric can currently depress the reported score.
- These are deterministic unit-level observations, not calibrated evidence that either score corresponds to interviewer judgement.

### 4. Catalog question metadata does not reliably select the right rubric

The catalog snapshot copies `questionFamily`, `questionType`, expected signals, and report dimensions, but it does not set `evidenceMode` and does not pass catalog items through `buildBaseItem`, where `evidenceMode` is normally inferred (`questionCatalogSelectionService.js:223-266`; `questionPoolComposerService.js:663-675`). `inferTurnRubric` then defaults missing evidence mode to `past_example` (`turnRubricService.js:45-53`).

The catalog-to-interviewer-to-report metadata path sets runtime `stage` to `catalog`, keeps the concrete catalog ID as `questionFamily`, and leaves `evidenceMode` empty. Replaying that path for every seniority variant produced the same routes for 2026.1 and 2026.2:

| Catalog family | Junior / intermediate route | Senior route | Research judgement |
|---|---|---|---|
| `proud_project` | `direct_answer` / `knowledge_explanation` | `role_specific_reasoning` / `past_example` | The same family changes rubric by seniority and never gets an explicit project contract. |
| `underperforming_project_reflection` | `behavioural_starr` / `past_example` | `role_specific_reasoning` / `past_example` | Should remain STARR by default; senior wording accidentally changes the rubric. |
| `coding_ownership_and_verification` | `role_specific_reasoning` / `past_example` | same | Candidate for a project-impact framework, but current wording is generic-process rather than one completed outcome. |
| `ai_assisted_delivery` | `direct_answer` / `knowledge_explanation` | `role_specific_reasoning` / `past_example` | Needs explicit actual-work versus scenario routing; current seniority split is accidental. |
| `prompt_and_context_design` | `role_specific_reasoning` / `past_example` | same | Current prompt is process/knowledge-like; not automatically a completed-project answer. |
| `rag_retrieval_design` | junior `direct_answer`; intermediate `role_specific_reasoning`, defaulting to `past_example` | `role_specific_reasoning` / `past_example` | “How would” scenario never reaches the existing scenario framework. |
| `agent_reliability_and_safety` | junior `direct_answer`; intermediate `role_specific_reasoning`, defaulting to `past_example` | `role_specific_reasoning` / `past_example` | “If/how would” scenario never reaches the existing scenario framework. |
| `ml_problem_framing` | junior `direct_answer`; intermediate `role_specific_reasoning`, defaulting to `past_example` | `role_specific_reasoning` / `past_example` | “How would” scenario never reaches the existing scenario framework. |

The senior prompt helper adds words such as “trade-offs” to non-technical questions. Because the keyword-based role-specific branch runs before behavioural family routing, multiple senior behavioural and motivation questions change framework even though their assessment intent has not changed (`questionCatalogSeed2026_2.js:36-60`; `turnRubricService.js:103-112`). Additional behavioural and motivation families also fall through to `direct_answer` because routing recognizes only a few canonical family values or text patterns, while catalog `questionFamily` defaults to a concrete catalog ID.

This is wider than the requested new framework, but it is a prerequisite risk: adding a rubric without fixing explicit family/evidence routing would leave inconsistent coverage. It also affects selection: `proud_project` is catalogued as behavioural, so a technical-only prepared-pool query can exclude it before report routing (`interviewTurnOrchestratorService.js:301-324`; `questionPoolComposerService.js:792-812`).

### 5. Catalog source approval is not proof of the active live catalog

Repository code prefers approved 2026.2 records, then approved 2026.1 records, from Mongo. Source review records show that the product owner approved the 2026.2 source set, and a script can seed/activate it. This research did not connect to the live database, so the active persisted catalog version remains unverified (`questionCatalogRepository.js:28-43`; `questionCatalogReview2026_2.js:53-64`; `syncQuestionCatalogSeed.js:20-59`).

### 6. Voice duration evidence exists, but the scoring/coaching path is disconnected

- Voice turns calculate VAD-reported speaking duration and persist `voiceDelivery.speakingDurationSeconds` in transcript metadata and analysis storage. This proves that a source field exists; it does not prove live browser/provider duration accuracy.
- `buildInterviewMetrics` does not currently expose per-turn or average speaking duration, overlong-answer count, or duration eligibility.
- The report generator loads a voice-delivery summary but does not pass it into `buildReportDraft`, whose voice section therefore receives its default `null` on this path.
- Backend coaching still triggers “Practise more concise answers” from planned-versus-asked question-count mismatch and recommends 60-90 seconds. The frontend fallback uses an unpopulated duration field and recommends 60-90 seconds; a separate story-bank fallback also says to practise examples in under 90 seconds.
- A repository-wide literal scan found those three candidate-facing answer-length statements. Other `60-90s` matches are voice-cache TTL documentation and are not answer guidance.
- The text reply API has no trusted per-answer speaking duration, but text timing and scoring are now explicitly deferred by the owner. Shared report utilities will eventually need a mode-aware boundary so a voice-only change does not silently alter text-interview behaviour.

Therefore the first future change can be scoped to voice timing, but it is not a copy-only edit. The existing voice duration evidence must reach an eligible-answer metric and coaching/scoring consumer; question-count mismatch must not masquerade as answer-length evidence.

### 7. Persistence and UI are structurally flexible, but semantics are not versioned

Framework dimensions are normalized as dynamic key/label/status/score/reason objects, the report document is stored as `Mixed`, and the report UI renders dimensions generically. A new framework probably does not require a dedicated database migration or a bespoke UI grid.

That does not resolve score compatibility. Existing reports store framework keys and normalized scores without a demonstrated rubric-version/calibration contract. Regeneration or mixed old/new reports could therefore present numerically comparable-looking scores produced by different rules.

The candidate publication path already preserves the standard dimension fields (`key`, `label`, `status`, `score`, `reason`). Extra candidate-facing fields such as dimension evidence references or richer score rationale would require an explicit publication-contract decision even though they would not require a database migration.

### 8. “Tell me about a time” is an evidence intent, not a reliable literal routing phrase

The 2026.2 catalog contains several real-past-example families with materially different domains:

| Family | Evidence requested by the current question | Fourth-element fit |
|---|---|---|
| `group_failure_learning` | ownership, repair action, reflection | 2-3 recovery or collaboration actions can fit; “technical approaches” may not. |
| `learning_agility_self_teach` | learning plan, verification, reflection | 2-3 learning/verification actions can fit; technical implementation is not required. |
| `initiative_value_creation` | initiative, beneficiary, impact | 2-3 actions or decisions can fit across technical and non-technical examples. |
| `support_struggling_teammate` | empathy, practical support, boundary, outcome | The prompt does not literally say “Tell me about a time,” but it still asks for past evidence. |
| `proud_project` | ownership, decision, impact | Strong fit when approaches means concrete decisions/actions. |
| `underperforming_project_reflection` | ownership, repair action, reflection | Strong fit when outcome may be negative and comparison may be against the intended result. |
| `conflict_resolution` | other perspective, communication, resolution | 2-3 communication/resolution actions can fit; technical approaches usually cannot. |
| `coding_ownership_and_verification` | implementation judgement, ownership, verification | Strong fit for genuinely technical approaches. |

Therefore, literal text matching would miss semantically equivalent prompts such as “Have you been in a team…” and “What project are you most proud of?”. The evidence-backed routing boundary is an explicit `past_example` assessment intent, not the exact words `Tell me about a time`.

Applying one framework to all past-example answers is internally coherent only if the fourth element is generalized to **2-3 key actions, decisions, or approaches appropriate to the question**, with technical depth required only when the question itself is technical. Keeping the element strictly technical while applying it to conflict, teamwork, or learning questions would create a built-in scoring penalty unrelated to the question.

## Gaps

1. No explicit `impact_first_past_example` framework exists.
2. No deterministic routing contract maps semantic past-example intent to that framework.
3. No outcome contract distinguishes a number, baseline, comparison, attribution, and business/user value.
4. No personal-ownership dimension distinguishes `I` from `we` or team work.
5. No approach contract defines what counts as one substantive cross-domain approach, action, or decision.
6. No learning dimension exists in the current generic role-specific framework.
7. No ordering analysis establishes outcome-first delivery.
8. No voice-answer eligibility and duration-scoring contract exists.
9. No implemented evaluator applies the now-aligned five-level, dimension-specific behavioural anchors.
10. No labelled calibration dataset or human-rater agreement evidence exists for the new score.
11. Catalog `expectedSignals` and `reportDimensions` are persisted but do not own framework scoring.
12. No rubric version is surfaced with turn scores for historical comparability.
13. Live 2026.2 catalog activation was not verified.
14. Empty `direct_answer` frameworks are not excluded from the overall score denominator.
15. `proud_project` can be excluded from technical-only selection because its catalog category remains behavioural.
16. No canonical `past_example` metadata contract covers literal and non-literal past-example prompts consistently.
17. No implemented score model yet combines five content elements, Outcome-first placement, and 90-120 second voice delivery into a bounded 0-100 turn score; the research contract is now aligned.

## Weak reasoning in the current system or proposal

1. Treating keyword presence as full evidence assumes vocabulary is equivalent to demonstrated competence.
2. Averaging all applicable turns equally assumes every question has equal assessment value and rubric difficulty.
3. Routing the new sequence outside semantic past-example intent would conflate retrospective evidence with motivation, knowledge, and hypothetical scenario answers.
4. Treating “2-3 approaches” as a simple count could reward an unreasoned list instead of substantive actions or decisions linked to the problem.
5. Treating any positive statement as a comparison would weaken the owner-aligned quantitative-or-comparative outcome requirement.
6. Scoring voice delivery before the persisted duration reaches the report metric would score from missing or accidental evidence.
7. Changing framework dimensions without applying the now-aligned weights and anchors exactly would silently change the overall report score.
8. The comment above `buildReportDraft` still describes a legacy weighted score, while the current scorer first uses the average framework score. Documentation/comments are not sufficient evidence of the actual formula.
9. Calling all finite framework scores “applicable” is weak when the implementation can include a direct rubric with zero dimensions and a synthetic zero score.
10. Routing by the literal phrase “Tell me about a time” would make wording, rather than assessment intent, own scoring behaviour.
11. Applying a strictly technical-approach requirement to teamwork or conflict evidence would measure question mismatch rather than answer quality.
12. Replacing three generic labels with five generic labels would increase apparent precision without increasing evidence discrimination.
13. Editing shared fallback copy without a mode boundary could silently apply the voice target to the deferred text-interview surface.

## Unsupported assumptions

1. The mock interviewer intended every listed element to carry equal scoring weight. **Resolved false by owner:** the aligned weights are `20/15/15/20/10/10/10`.
2. The listed order is mandatory rather than a communication recommendation. **Resolved human-aligned:** Outcome-first placement is score-bearing.
3. A numeric outcome is mandatory. **Resolved false by owner:** explicit comparison is an accepted alternative.
4. “Two or three tech parts” means exactly two or three independently scored approaches. **Resolved false by owner:** they form one score component with five anchored levels and may be non-technical when relevant.
5. 90-120 seconds applies beyond project-impact answers. **Resolved human-aligned for the current voice scope:** substantive root voice answers use the aligned five-band duration rule; excluded turn types are defined in D13.
6. The current 60-90 second voice-answer guidance should be replaced. **Resolved human-aligned:** owner rejected 60-90 seconds; text-interview timing is deferred.
7. All technical catalog questions should use the new framework.
8. Current historical scores may be compared directly with scores from a new rubric. **Scope-neutralized:** old reports are a non-goal.
9. The approved source catalog version is the version currently active in the user's database.
10. Regex-only scoring can be calibrated well enough for outcome comparison, ownership, approach quality, and learning.
11. Every past-example answer contains two or three technical approaches. **Resolved false by owner:** approaches may instead be cross-domain actions or decisions appropriate to the question.
12. “All voice answers are 90-120 seconds” includes every short interaction. **Resolved false by owner:** only substantive root voice answers are eligible; short follow-ups, confirmation, clarification, repair, repeat requests, and candidate questions are excluded.
13. An exact 90-120 second band should use hard cut-offs rather than a partial-credit tolerance. **Resolved false by owner:** five tapered bands are aligned.
14. Five rating levels alone provide meaningful discrimination without component-specific behavioural anchors. **Evidence-validated false:** official structured-interview guidance requires behaviourally defined proficiency levels.

## Missing requirements

These requirements are now product-aligned but remain absent from the implementation:

1. A canonical semantic `past_example` routing owner independent of literal wording and seniority prompt decoration.
2. An `impact_first_past_example` contract with the seven aligned components and weights.
3. Five component-specific levels mapped to `0% / 25% / 50% / 75% / 100%`, including evidence rationale for every awarded level.
4. Outcome evidence that accepts quantitative evidence or explicit before/after, target/actual, or alternative comparison while rejecting bare positive claims.
5. Outcome-position analysis using the aligned five levels, with the strongest level requiring a clear outcome in the first one or two sentences.
6. Cross-domain approach anchors that reward two or three substantive, relevant approaches/actions/decisions rather than tool-name counts.
7. Conditional use of validation, trade-offs, risk, quality, safety, and ethics inside problem-solving/approach evidence when relevant.
8. A cross-framework voice-duration path from persisted per-turn evidence to eligible root-answer metrics, five tapered bands, 10% scoring, and coaching.
9. Exclusion of short follow-ups, transcript confirmation, clarification, repair, repeat requests, and candidate questions from duration scoring.
10. A mode guard that leaves text-interview timing and scoring deferred.
11. A denominator policy that excludes non-applicable/zero-dimension rubrics without hiding genuine zero-evidence answers.
12. Question wording and controlled follow-ups that elicit the new evidence structure.
13. Human-labelled calibration examples plus acceptance thresholds for routing, determinism, false positives, and rater disagreement.
14. One score-bearing release with no temporary/shadow scoring system; voice timing is implemented first inside that same change.
15. No old-report regeneration, backfill, or compatibility redesign.

## Ambiguities

No material product ambiguity remains after owner alignment round 3:

1. Outcome accepts quantitative evidence or explicit before/after, target/actual, and option/alternative comparison.
2. Problem solving uses the five aligned anchors, including constraints, cause, rationale, and relevant trade-off/risk/validation at stronger levels.
3. Role means personal ownership, actions, decision boundary, accountability, and attributable contribution—not job title alone.
4. Approaches may be technical or non-technical and are judged as one five-level component.
5. Learning ranges from absent/cliché through concrete transfer or an already-applied reusable principle.
6. Voice duration is a five-band, 10% cross-framework score for every substantive root voice answer; 90-120 seconds is the top band.
7. The scale is displayed as Level 1-5 and contributes `0% / 25% / 50% / 75% / 100%` of each component weight.
8. Voice timing is implemented first but released once with the complete score-bearing framework.
9. Catalog-family edge cases remain implementation routing cases, not unresolved owner decisions; semantic evidence intent owns the result.

## Contradictions

1. The new guidance says 90-120 seconds; existing candidate coaching says 60-90 seconds (`reportCoachingBuilder.js:63-68`; `coaching.js:72-77`).
2. F-34 and the change log say question-count mismatch no longer triggers concision advice, but current backend code still does exactly that (`F-34:224-226`; `change-log.md:441-444`; `reportCoachingBuilder.js:63-68`).
3. Schema and UI support `partial`, and feedback code describes it, but the current role-specific analyzer can never produce it.
4. Catalog metadata contains expected signals such as ownership, verification, result, and reflection, but deterministic framework scoring ignores those contracts.
5. Hypothetical catalog prompts are stored without `evidenceMode`, then default to `past_example`, despite a separate scenario framework existing.
6. `proud_project` explicitly asks for problem, ownership, decision, and outcome, yet junior/intermediate routing assigns `direct_answer` with no score-bearing dimensions while senior routing changes to generic role-specific scoring.
7. `coding_ownership_and_verification` is a strong candidate for the new framework, but its current wording does not require one completed project, 2-3 approaches, learning, or a measurable comparison.
8. The report generator obtains voice delivery evidence, but the draft call does not pass the summary into the report draft's voice-delivery section.
9. The `buildReportDraft` score comment describes legacy weighting, while the active score path uses mean framework scores when available.
10. Score explanations say applicable framework turns are averaged and only conversation/closing turns are excluded, but a zero-dimension `direct_answer` is currently included as `0`.
11. Senior prompt decoration changes rubric identity for otherwise identical behavioural/motivation families because keyword routing runs before semantic family routing.
12. 2026.2 `bounded_scenario` metadata is persisted as ambiguity metadata but never establishes `scenario_reasoning`; hypothetical technical prompts therefore default to `past_example` or direct.
13. 2026.2 gives `proud_project` bounded-scenario clarification metadata while leaving its category behavioural; the bounded technical-scenario selector requires both technical category and bounded-scenario mode.
14. Frontend concision fallback treats an average answer duration above 90 seconds as overlong, so a 100-second answer inside the owner-aligned 90-120 target would trigger the wrong coaching (`coaching.js:18-21`).
15. Frontend story-bank coaching says examples should be under 90 seconds while another fallback says 60-90 seconds; both conflict with the 90-120 voice target (`coaching.js:58-63`, `72-77`).

## Assumption alignment register

| ID | Assumption or decision boundary | Status | Evidence / blocking impact |
|---|---|---|---|
| A1 | Current scoring fully implements the mock framework. | **evidence-validated false** | Dimension, analyzer, probe, and timing evidence show only partial overlap. |
| A2 | A separate framework is needed if all five content elements must be independently visible and scored. | **evidence-validated** | Current STARR and role-specific contracts cannot expose those five elements without semantic changes. |
| A3 | The framework must not automatically apply to every technical question. | **evidence-validated** | Catalog contains completed-example, generic-process, knowledge, and hypothetical scenario prompts with different evidence needs. |
| A4 | Generic report schema and UI can display another dynamic framework. | **evidence-validated** | Mixed persistence, dynamic normalization, and generic dimension rendering already exist. |
| A5 | A score-bearing framework change alters overall interview scores. | **evidence-validated** | Overall score averages finite non-conversation turn framework scores. |
| A6 | Voice has a per-turn speaking-duration source field. | **evidence-validated** | VAD-reported duration is analyzed and persisted on realtime voice turns; live accuracy remains unverified. |
| A7 | Text has an equivalent trusted per-answer duration source. | **evidence-validated false** | The text reply contract carries no per-turn duration. |
| A8 | Source-approved 2026.2 is confirmed active in the live database. | **unresolved - non-material to plan** | No live database verification was run, but 2026.1 and 2026.2 produced the same relevant source-level routing outcomes. The implementation must support both rather than assume live activation. |
| A9 | A zero-dimension direct rubric is treated as non-applicable by the overall-score denominator. | **evidence-validated false** | Deterministic probe produced direct `0`, role-specific `10`, and combined overall `50`. This is a confirmed current scoring defect, not a reason to assign the new framework broadly. |
| D1 | Scope by assessment intent rather than selected technical topic. | **human-aligned** | Owner chose every question whose semantic assessment intent asks for a genuine past example. |
| D2 | Coaching-only/shadow versus immediate contribution to overall score. | **human-aligned** | Owner chose immediate score-bearing implementation and rejected doing a shadow pass first. |
| D3 | Whether Outcome-first sequence affects score. | **human-aligned** | Owner accepted the five placement levels; a closing-only outcome receives placement Level 1 while outcome quality is scored independently. |
| D4 | Outcome evidence policy. | **human-aligned** | Owner accepts quantitative evidence and every proposed explicit comparison form, while bare positive claims do not qualify. |
| D5 | Meaning of 2-3 approaches. | **human-aligned** | Owner accepted the cross-domain five-level anchors; approaches/actions/decisions form one component and technical depth is conditional. |
| D6 | Duration target. | **human-aligned** | Owner accepted 90-120 seconds as the top voice band and the complete tapered-band contract in D13. |
| D7 | Treatment of validation, trade-offs, risk, quality, and ethics. | **human-aligned** | Owner accepted conditional evidence anchors within problem-solving/approaches rather than fixed extra dimensions. |
| D8 | Weights, Outcome-position thresholds, and duration weight. | **human-aligned** | Owner accepted `20/15/15/20/10/10/10`, the five placement levels, and a 10-point duration component. |
| D9 | Question wording and follow-up changes. | **human-aligned** | Owner requires applicable question wording and follow-ups to elicit the framework. |
| D10 | Historical reports and rubric migration. | **human-aligned** | Owner made old reports a non-goal; no backfill or compatibility redesign is required for this feature. |
| D11 | Literal phrase versus semantic past-example routing. | **human-aligned** | Owner confirmed semantic intent. Literal matching is rejected; metadata/routing implementation remains future spec work. |
| D12 | Core evidence meaning for 2-3 approaches. | **human-aligned** | Count alone is insufficient; approaches may be cross-domain and must be substantive and relevant. Exact five-level anchors are tracked in D14. |
| D13 | Voice duration eligibility and tolerance; text timing boundary. | **human-aligned** | Owner accepted a 10% cross-framework duration score for every substantive root voice answer, all proposed exclusions, and bands `<60/>150`, `60-69/141-150`, `70-79/131-140`, `80-89/121-130`, `90-120`; text remains deferred. |
| D14 | Five-level component scoring. | **human-aligned** | Owner accepted the component-specific anchors and `Level 1-5 -> 0%/25%/50%/75%/100%` contribution mapping. |
| D15 | First future implementation priority. | **human-aligned** | Voice duration guidance/data flow comes before broader framework scoring. This records priority only; no plan or branch exists yet. |
| D16 | Voice-timing release boundary. | **human-aligned** | Owner requires doing it once: voice timing is the first internal slice and ships with the complete score-bearing framework, with no temporary scoring release. |

Implementation workflow preference: owner authorized creating a new branch when implementation begins. No branch is created during research.

## Owner-aligned score model

The current binary keyword score and the earlier three-state candidate are both unsuitable. Based on the official guidance and owner alignment, the score uses **five behaviourally anchored levels per component**, not five generic labels. `Level 1-5 -> 0%, 25%, 50%, 75%, 100%` of that component's weight. This creates five equally spaced score contributions while preserving a true no-evidence zero.

The owner-aligned weight distribution is:

| Component | Aligned weight |
|---|---:|
| Outcome evidence | 20 |
| Problem solving | 15 |
| Personal role | 15 |
| 2-3 approaches / actions / decisions | 20 |
| Learning | 10 |
| Outcome-first placement | 10 |
| 90-120 second voice delivery | 10 |

Owner-aligned dimension-specific five-level anchors:

| Component | Level 1 - 0% | Level 2 - 25% | Level 3 - 50% | Level 4 - 75% | Level 5 - 100% |
|---|---|---|---|---|---|
| Outcome evidence | No usable outcome. | Generic positive claim only. | Specific result, but quantitative/comparison evidence or attribution is incomplete. | Clear quantitative result **or** explicit comparison, linked to the candidate's contribution. | Level 4 plus a clear baseline, target, or alternative and why the impact mattered; attribution is explicit. |
| Problem solving | No identifiable problem or decision. | Context is given, but the actual challenge is vague. | Concrete challenge and action, with limited reasoning. | Problem plus a relevant constraint/cause and why the chosen response made sense. | Problem is decomposed; alternatives, trade-offs, risk, or validation are used when relevant; reasoning connects to the outcome. |
| Personal role | Only team activity or no role evidence. | Title/responsibility is named, but personal work is unclear. | Some personal action is stated, but ownership boundaries or decision authority remain unclear. | Personal ownership, actions, and decision boundary are explicit. | Level 4 plus clear accountability, coordination/influence, and causal contribution without overstating team work. |
| 2-3 approaches / actions / decisions | None, or tool names only. | One vague move or an unreasoned list. | One substantive move, or two thin moves, with partial connection to the problem. | Two distinct substantive moves; both are relevant and at least one has clear rationale. | Two or three distinct substantive moves form a coherent response; rationale and relevant trade-off/verification are explicit. |
| Learning | No learning. | Generic cliché with no example-specific insight. | Specific lesson, but no future transfer or behaviour change. | Specific lesson plus a concrete change for future work. | Level 4 plus evidence the lesson was already transferred, or a reusable principle with a clear boundary. |
| Outcome-first placement | No outcome, or it appears only in the closing sentence. | Outcome first appears in the final third. | Outcome first appears in the middle third. | Outcome appears in the opening segment, but only after setup or in vague form. | A clear outcome/comparison appears in the first one or two sentences. |
| Voice duration | Under 60 or over 150 seconds. | 60-69 or 141-150 seconds. | 70-79 or 131-140 seconds. | 80-89 or 121-130 seconds. | 90-120 seconds. |

For the Impact-first framework, voice duration contributes 10 of the 100 points shown above. The same 10% duration rule applies across other content frameworks for every substantive root voice answer; implementation must compose it without forcing past-example content dimensions onto scenario, knowledge, motivation, or self-introduction answers. Short follow-ups, transcript confirmation, clarification, repair, repeat requests, and candidate questions are excluded rather than penalized for being under 90 seconds. Text-interview timing remains outside this scope.

Implementation and calibration risks that remain, without requiring another owner decision:

- Outcome quality and Outcome-first placement intentionally reward outcome twice; the owner accepted that emphasis and its weights.
- Equal numerical spacing does not prove equal real-world quality distance. Human-labelled examples and disagreement review are still required before claiming calibration.
- The exact opening threshold and duration bands are now human-aligned product rules, not conclusions supplied by the external sources.
- Every awarded level needs a short evidence rationale; a model/regex label without traceable answer evidence would recreate the current opacity.

## Research conclusion

The current framework scoring is **not aligned enough** with the mock-interview structure to claim that it evaluates that structure. Owner alignment has broadened the product direction from a technical-project-only framework to an explicitly routed **Impact-first Past Example** framework for every genuine past-example assessment intent. This would replace STARR for those answers, while scenario, knowledge, motivation, self-introduction, and conversation questions retain frameworks suited to their evidence type.

The owner-aligned fourth element is now **2-3 key approaches, actions, or decisions appropriate to the question**. Technical depth is required only when the question is technical; teamwork, conflict, learning, or failure examples may use communication, recovery, verification, support, or other relevant approaches. Hypothetical RAG, agent, AI evaluation, and ML design questions remain scenario/knowledge reasoning unless they explicitly ask for completed past work.

The new framework will contribute to the score immediately; Outcome-first placement is score-bearing; Outcome may be quantitative or comparative; semantic past-example routing is required; relevant question wording/follow-ups must change; old reports are out of scope. All five-level anchors, weights, placement rules, and voice-duration bands are now human-aligned. Voice duration is a 10% cross-framework score for every eligible substantive root voice answer. It is the first internal implementation priority: current 60-90/under-90 guidance and the `>90` overlong trigger conflict with the 90-120 target, while existing voice duration evidence is not connected to report metrics. Text-interview timing remains deferred.

This is still a research conclusion, not an implementation plan. The research gate is **ready for plan** and no material human question remains. Voice timing must be implemented first inside one branch and released once with the complete score-bearing framework. The likely owning product document for the future behaviour change is F-34 plus one scoped change-log entry; no reader-guide or milestone-wide sync is justified in this research-only slice.

## Three-pass research audit record

### Pass 1 - completeness and source trace

- Checked: current runtime flow, rubric definitions, score propagation, catalog routing, timing, persistence, UI, tests/docs boundary.
- Result: all seven requested review categories except external human questions are represented as dedicated sections; exact Grill Me wording is intentionally absent.
- New issue found: catalog snapshots bypass evidence-mode inference.
- New issue found: zero-dimension direct answers can enter the overall denominator as zero.
- New issue found: senior prompt suffixes and concrete catalog-family IDs cause seniority-dependent rubric changes.

### Pass 2 - adversarial assumption review

- Checked: each conclusion against evidence-validated, unresolved, or false assumptions.
- Result: the initial scope was narrowed to actual project/delivery evidence; owner alignment later broadened it to all semantic past-example questions and generalized the fourth element across domains.
- Result: the first simplified routing probe was replaced with a full catalog-to-interviewer metadata replay by seniority; 2026.1 and 2026.2 have the same resulting rubric routes.
- New issues found: score-bearing rollout changes overall score; live catalog activation is unverified; text and voice timing are not equivalent; `proud_project` may be excluded from technical-only selection.

### Pass 3 - contradiction and planning-gate review

- Checked: source versus docs, backend versus frontend, proposed 90-120 seconds versus current 60-90 seconds, and whether any material assumption was silently treated as resolved.
- Result: the initial research gate remained blocked on D1-D10; no unresolved product decision was presented as confirmed.
- Result: no Grill Me decision question wording was embedded in this file; initial human decisions were kept external and mapped to D1-D10.
- New issues found: current backend still uses question-count mismatch as a concision trigger; voice summary is loaded but not passed into the report draft; current score comment is stale; direct zero-dimension turns require an explicit denominator guard.

### Owner alignment round 1 - three-pass re-audit

- Pass 1, completeness: recorded D2-D7, D9, and D10 as human-aligned where answered; preserved only dependent decisions as unresolved; confirmed all required research categories remain present.
- Pass 2, adversarial scope: replayed the current catalogue's past-example families against the broadened scope and found that literal phrase routing and a strictly technical fourth element would be invalid.
- Pass 2 correction: owner clarified that approaches may be non-technical, so the fourth element is now cross-domain and the working framework name was changed to `Impact-first Past Example`.
- Pass 3, contradiction/gate: removed stale technical-only conclusions, retained the evidence-mode and duration-data contradictions, and confirmed that planning at the end of round 1 remained blocked on D8 and D11-D13.
- Pass 3 file boundary: no second file, implementation plan, product code, branch, or product documentation was created or changed.

### Owner alignment round 2 - three-pass re-audit

- Pass 1, gaps/missing requirements: checked all required research categories and repository timing literals. Replaced stale technical-only and cross-mode wording, added the voice-only mode boundary, and recorded the `>90` overlong-trigger contradiction.
- Pass 2, reasoning/assumptions/ambiguities: checked every unresolved and human-aligned register row against the new five-level candidate. Corrected the Outcome-anchor decision reference, kept weights/placement/duration bands unresolved, and did not treat official five-level guidance as evidence for product-specific thresholds.
- Pass 3, contradictions/human frontier: checked for direct human-question wording, plan fields, branch creation, and product-code edits. Added D16 for the unresolved timing-release boundary. No Grill Me question is embedded here; only `research.md` is task-owned, the existing `Alan_work` branch was not changed, and planning remains blocked on D8, the unresolved part of D13, D14, and D16.

### Owner alignment round 3 - three-pass re-audit

- Pass 1, completeness/stale-state review: reconfirmed all required research categories and removed current-state wording that still described weights, anchors, bands, or release policy as candidate, blocked, or awaiting human alignment.
- Pass 2, decision consistency: verified D1-D16 are human-aligned, the seven weights total 100, the five level contributions and duration bands match the accepted tables, and the combined answers make duration a 10% cross-framework rule for substantive root voice answers.
- Pass 3, gate/boundary review: found no direct human question, plan phase, branch change, or product-code write. `research.md` is the only task-owned file, the checkout remains on `Alan_work`, A8 is explicitly non-material because both inspected catalogs share the relevant routing outcomes, and the research gate is ready for plan.

## Verification performed for this research file

- Official Canada and U.S. OPM structured-interview sources were opened and compared for five-level, behaviourally anchored rating guidance.
- Repository-wide answer-length literals and the voice-duration-to-report flow were rechecked for the voice-first scope.
- Deterministic rubric-routing matrix executed for all 2026.1 and 2026.2 source catalog questions.
- Deterministic role-specific scoring probes executed for a strong structured answer and a weak keyword-only answer.
- Source-to-document contradictions checked directly against current files.
- An independent read-only worker ran four focused backend files covering catalog selection, 2026.2 catalog governance, metadata persistence, and report framework pipeline: `4 files / 58 tests passed`. The report pipeline used its mock/deterministic fallback because no real provider key was available.
- Three owner-alignment round-3 audits checked the requested gap/reasoning/assumption/requirement/ambiguity/contradiction categories and confirmed that no material human question remains.
- No full product suite, live AI evaluation, Mongo-backed activation check, or browser flow was run because this slice changes no product behaviour and those checks would not add evidence to the completed research alignment.
