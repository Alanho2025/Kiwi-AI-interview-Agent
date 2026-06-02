# Modified Plan: Preparation Stability Evaluation Suite

Branch: `Alan-workplace`

## Goal

Build an 80-case deterministic Preparation Stability Suite for Kiwi AI Interview Agent.

The goal is to verify that the required preparation artifacts are generated consistently before the system enters the interview, adaptive questioning, or report stage.

A fallback response must not count as a pass for preparation stability. If CV seeds, JD filters, prepared question pools, retrieval/indexing artifacts, or report evidence bundles are missing, the case should fail even if the product can continue with fallback behaviour.

## Evaluation Principle

This suite should answer one question:

> Can the system reliably produce the artifacts required for personalised, evidence-grounded interview coaching?

The suite should test why preparation steps fail, where they fail, and whether the failure is caused by input edge cases, parser behaviour, LLM output shape, persistence, retrieval/indexing, or artifact composition.

## Scope

Add or extend deterministic tests under the existing backend test/eval structure. Prefer existing folders and scripts instead of creating a separate isolated framework.

Use mock mode for deterministic cases unless a case specifically belongs to the existing real eval runners.

Primary target folders:

- `backend/tests/robustness/cv`
- `backend/tests/robustness/jd`
- `backend/tests/robustness/match`
- `backend/tests/robustness/questions`
- `backend/tests/robustness/retrieval`
- `backend/tests/robustness/report`
- `backend/tests/robustness/contracts`

Optional supporting eval output:

- `backend/eval/reports/preparation-stability.latest.json`
- `backend/eval/reports/preparation-stability.latest.md`

## Non-goals

Do not treat fallback success as a preparation pass.

Do not rewrite the whole production architecture.

Do not require every case to call paid LLM APIs.

Do not claim that this suite proves full production robustness.

Do not turn adaptive question selection into a fixed script. The test should check artifact generation, evidence grounding, coverage, and metadata, not exact wording.

## Case Distribution

Total: 80 deterministic cases.

| Group | Cases | Purpose |
| --- | ---: | --- |
| CV parsing stability | 10 | Verify stable CV profile generation |
| CV seed generation stability | 10 | Verify stable CV-based question seed generation |
| JD parsing stability | 12 | Verify stable structured JD rubric generation |
| JD question filter stability | 10 | Verify stable JD/match-based question filter generation |
| CV-JD match stability | 10 | Verify evidence-backed match result generation |
| Prepared question pool stability | 12 | Verify stable pool composition from CV, JD, and match signals |
| Artifact indexing / retrieval stability | 8 | Verify required artifacts can be indexed and retrieved |
| Report evidence + QA stability | 8 | Verify report evidence grounding and QA detection of unsupported claims |

## Pass / Fail Rule

A case passes only if the required preparation artifact is produced correctly and contains enough evidence metadata for downstream use.

A case fails if:

- the artifact is missing;
- the artifact exists but is empty;
- the artifact exists but is generic;
- the artifact contains unsupported claims;
- the artifact is not linked to its source evidence;
- the artifact is not retrievable when downstream steps need it;
- fallback is triggered because the preparation artifact failed.

Fallback may be recorded as diagnostic information, but it must not convert a failed preparation step into a passing stability case.

## Group 1: CV Parsing Stability - 10 Cases

Test whether CV parsing produces a usable `cvProfile`.

Required checks:

- `cvProfile` exists for valid CV input.
- skills, projects, experience, and education are extracted when present.
- missing sections are handled as missing, not hallucinated.
- repeated skills are deduplicated.
- unsupported skills are not invented.
- parse warnings are raised only when appropriate.
- low-information CVs produce low confidence or warnings.
- malformed layout does not crash the parser.

Suggested cases:

1. normal structured CV
2. CV without projects section
3. CV with dense bullet points
4. CV with mixed education and work history
5. CV with AI project names
6. short low-information CV
7. CV with repeated skills
8. CV with missing dates
9. CV with unrelated personal statement
10. malformed layout CV

## Group 2: CV Seed Generation Stability - 10 Cases

Test whether CV evidence reliably becomes candidate-specific question seeds.

Required checks:

- valid CV produces non-empty seeds.
- seed topics map to CV skills, projects, or experience.
- every seed has source evidence.
- seeds do not invent skills or projects.
- reviewed CV profile refreshes seeds.
- old seeds do not remain after reviewed CV changes.
- duplicate seeds are controlled.
- seed generation failure is surfaced as a preparation failure.

Suggested cases:

1. React project produces project ownership seed
2. backend API experience produces implementation seed
3. data project produces evaluation/metrics seed
4. CV with only education still produces entry-level seeds
5. CV with weak experience does not invent professional history
6. reviewed CV adds project and refreshes seeds
7. reviewed CV removes skill and seed is removed or downgraded
8. repeated project bullets do not create duplicate seeds
9. CV with unclear project ownership produces clarification seed
10. CV with no usable evidence fails seed readiness

## Group 3: JD Parsing Stability - 12 Cases

Test whether raw JD text reliably becomes a structured JD rubric.

Required checks:

- role title is detected.
- responsibilities are extracted.
- required and preferred skills are separated.
- seniority, location, and work type are not hallucinated.
- company intro noise does not dominate the rubric.
- non-JD input is flagged as low quality.
- prompt injection is ignored.
- raw JD changes invalidate stale summary state.

Suggested cases:

1. normal software engineer JD
2. junior role JD
3. senior role JD
4. JD with no salary
5. JD with long company intro
6. JD with repeated requirements
7. JD with mixed benefits and responsibilities
8. JD with vague responsibilities
9. non-JD marketing text
10. prompt injection inside JD
11. NZ-style SEEK JD with noisy formatting
12. updated JD invalidates previous structured summary

## Group 4: JD Question Filter Stability - 10 Cases

Test whether JD and match results reliably produce a JD question filter.

Required checks:

- `jdFilterReady` is true when JD and match are valid.
- priority skills are generated from JD evidence.
- gap validation targets are generated when gaps exist.
- low-priority noise is not ranked as a core topic.
- filter is linked to JD fingerprint or match analysis.
- filter does not include unsupported JD requirements.
- filter generation failure is treated as preparation failure.

Suggested cases:

1. frontend-heavy JD produces frontend priority filter
2. backend-heavy JD produces backend priority filter
3. full-stack JD produces balanced filter
4. JD requires SQL and CV lacks SQL, creating gap target
5. JD requires testing and CV has weak testing evidence
6. JD with benefits noise excludes benefits as question priorities
7. JD with required/preferred skills ranks required higher
8. JD with vague skills still produces role-level targets
9. JD prompt injection does not alter filter rules
10. missing match analysis causes explicit filter failure

## Group 5: CV-JD Match Stability - 10 Cases

Test whether match results are stable, evidence-backed, and consistent.

Required checks:

- strengths have CV evidence.
- gaps have JD evidence.
- explanations do not contradict scores.
- missing skill is framed as a gap, not invented experience.
- same input repeated should produce stable critical result.
- match result is persisted or shaped for later interview plan use.

Suggested cases:

1. strong match
2. weak match
3. partial match with transferable skills
4. JD skill missing from CV
5. CV skill not required by JD
6. overclaimed candidate evidence
7. junior CV against senior JD
8. senior CV against junior JD
9. ambiguous role title
10. power-of-3 repeated match stability case

## Group 6: Prepared Question Pool Stability - 12 Cases

Test whether interview planning reliably composes a prepared question pool from CV seeds, JD filter, match analysis, JD rubric, and settings.

Required checks:

- pool count meets minimum threshold for valid inputs.
- pool contains CV-based questions.
- pool contains JD-based questions.
- pool contains match gap validation questions when gaps exist.
- each question has source metadata.
- each question has a rationale or `whyThisQuestion`.
- duplicate base questions are controlled.
- behavioural mode produces STAR-style questions.
- technical mode produces technical/trade-off questions.
- combined mode produces a balanced pool.
- missing seeds/filter should fail preparation stability.
- fallback-generated generic questions do not count as pool success.

Suggested cases:

1. rich CV + rich JD creates full pool
2. CV has React and JD asks backend integration
3. JD asks SQL and CV lacks SQL
4. JD asks cloud and CV lacks cloud
5. behavioural mode pool
6. technical mode pool
7. combined mode pool
8. junior role avoids overly senior questions
9. senior role avoids too-basic questions
10. duplicate seeds do not duplicate pool questions
11. empty CV seeds causes pool stability failure
12. missing JD filter causes pool stability failure

## Group 7: Artifact Indexing / Retrieval Stability - 8 Cases

Test whether required artifacts are indexed and retrievable for downstream adaptive reasoning and report generation.

Required checks:

- CV profile artifact is indexed.
- JD rubric artifact is indexed.
- interview plan artifact is indexed.
- prepared question pool artifact is indexed.
- transcript artifact is indexed after answer.
- retrieval can find the expected source by query.
- source type is preserved.
- missing artifact produces explicit failure, not silent empty evidence.

Suggested cases:

1. retrieve CV profile by candidate skill query
2. retrieve JD rubric by required skill query
3. retrieve prepared pool by topic query
4. retrieve match gap evidence
5. retrieve interview plan objective
6. retrieve transcript answer evidence
7. preserve source type labels
8. missing artifact produces explicit indexing/retrieval failure

## Group 8: Report Evidence + QA Stability - 8 Cases

Test whether report generation and QA use evidence consistently.

Required checks:

- report uses CV, JD, and transcript evidence.
- unsupported claims are detected.
- invented skills are detected.
- wrong JD requirement claims are detected.
- contradiction with transcript is detected.
- QA result is stable across repeated same input.
- `needs_review` is triggered for unsupported evidence.
- ready status is used only when evidence is sufficient.

Suggested cases:

1. report with supported strength passes
2. report invents Kubernetes skill and fails
3. report claims answered topic that transcript skipped and fails
4. report gives high score without evidence and fails
5. report misstates JD requirement and fails
6. report contradicts transcript and fails
7. report with weak evidence becomes `needs_review`
8. power-of-3 report QA stability case

## Reporting Output

Add a preparation stability summary report with this shape:

```json
{
  "suite": "preparation_stability",
  "totalCases": 80,
  "passed": 80,
  "failed": 0,
  "artifactFailures": {
    "cvProfileMissing": 0,
    "cvSeedsMissing": 0,
    "jdRubricMissing": 0,
    "jdFilterMissing": 0,
    "matchAnalysisMissing": 0,
    "questionPoolMissing": 0,
    "indexingMissing": 0,
    "reportEvidenceMissing": 0
  },
  "fallbackDiagnostics": {
    "fallbackTriggered": 0,
    "fallbackConvertedToPass": 0
  },
  "stabilityChecks": {
    "powerOf3Cases": 3,
    "criticalInconsistency": 0
  }
}
```

The Markdown report should include:

- total cases
- pass/fail count
- failed artifact type
- failed preparation stage
- whether fallback was triggered
- why fallback did not count as a pass
- recommended fix area

## Suggested Commands

Add one command if needed:

```json
"test:prep-stability": "NODE_ENV=test AI_TEST_MODE=mock node tests/helpers/runVitestGroups.js tests/robustness/cv tests/robustness/jd tests/robustness/match tests/robustness/questions tests/robustness/retrieval tests/robustness/report tests/robustness/contracts"
```

If a dedicated runner is added:

```json
"eval:prep-stability": "NODE_ENV=test AI_TEST_MODE=mock node eval/runners/runPreparationStabilityEval.js"
```

This runner should aggregate the 80 cases and write:

- `eval/reports/preparation-stability.latest.json`
- `eval/reports/preparation-stability.latest.md`

## Definition of Done

The task is complete when:

1. 80 deterministic preparation stability cases exist.
2. Cases are grouped by preparation artifact type.
3. A fallback response cannot make a failed preparation artifact pass.
4. Reports identify the failed artifact and failed stage.
5. The suite runs in mock mode.
6. The suite integrates with existing local quality checks or can be run as a separate command.
7. The result can be cited in the final paper as a preparation stability evaluation, not as full production robustness proof.

## Report Claim Supported by This Work

After this suite is implemented, the final report can safely claim:

> We evaluated the stability of the preparation pipeline using 80 deterministic cases covering CV profile extraction, CV seed generation, JD rubric parsing, JD question filtering, CV-JD match analysis, prepared question pool construction, artifact retrieval, and report evidence grounding. A fallback response was recorded as diagnostic information but did not count as a pass when a required preparation artifact was missing.

Do not claim:

> The system is fully production robust.

Do not claim:

> Fallback proves the system is stable.

Do not claim:

> Report QA automatically regenerates corrected reports unless that loop is implemented and tested.
