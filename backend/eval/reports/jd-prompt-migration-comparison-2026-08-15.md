# JD Six-Element XML Prompt Migration Comparison — 2026-08-15

## Scope

This comparison covers the first JD pilot only:

- AI skill enhancement
- universal JD parser
- JD parse critic
- JD reparse agent

The broader parser/public orchestration and output contracts were preserved; the bounded safeguard gate and reparse metadata path were intentionally changed and tested. Persistence, API, match gate, and unrelated fallback paths were not changed.

## Before and after

| Measure | Before migration | After migration | Delta / interpretation |
|---|---:|---:|---|
| Deterministic JD parse eval | 6 cases, average `0.96` | 6 cases, average `0.96` | `0.00`; no measurable deterministic parser change, as expected because the runner disables JD AI skill enhancement. |
| Existing JD robustness tests | 11 files, 64 tests passed | Historical initial pilot: 4 files, 10 tests passed | This is a historical pilot count, not the current local verification result. |
| Focused XML prompt and safeguard telemetry tests | Not present | Historical initial pilot: 4 files, 10 tests passed | The initial pilot count covered prompt-capture/escaping and safeguard telemetry assertions; it is retained as historical evidence. |
| Backend lint | Not recorded before migration | Passed | Post-change syntax/style gate passed. |
| Current local verification after bounded gate correction | Not applicable | 8 focused files, 46 tests; full JD robustness 16 files, 105 tests; backend lint passed | Local post-fix evidence. The post-fix live serial A/B is recorded below. |
| Live LLM quality comparison | Initial pair: `0.977`, critical `1.000`; instrumented repeat: `0.977`, critical `1.000` | Initial pair: `0.982`, critical `1.000`; instrumented repeat: `0.973`, critical `0.992` | The initial pair was `+0.5` percentage points, but the corrected repeat was `-0.4` points. There is no stable direction yet. |
| Universal profile fallback | 0/6 cases | 0/6 cases | No fallback difference observed. |
| Safeguard reparse cases | Initial/repeat: `2/6` and `2/6` | Initial/repeat: `5/6` and `6/6` | XML triggered 3–4 more reparses in these runs. Reparse is a gate action, not a direct hallucination metric. |
| Instrumented critic response shape | Repeat: 7 valid critic responses, 0 invalid issue schemas | Repeat: 0 valid critic responses, 10 invalid issue schemas; 8 low-level timeout attempts | XML critic responses were JSON objects with `revise`, but issue objects omitted `problem` and `action`; normalization converted them to unspecified issues. |

## Post-fix live serial A/B

| Dimension | Result |
|---|---|
| Protocol | `repeatCount=3`; every round ran `legacy → xml` sequentially, with the legacy process fully exiting before the XML process started. |
| Sample | 6 fixtures per variant per round; 36 fixture cases / 6 variant-runs（3 legacy + 3 XML）; all `failedCaseCount=0`. |
| Aggregate score | Legacy `0.977`, XML `0.975`; delta `-0.002` = `-0.2 percentage points`. |
| Critical score | Legacy `1.000`, XML `1.000`; delta `0`. |
| Round deltas | Round 1 `+0.5pp`, Round 2 `-1.5pp`, Round 3 `+0.5pp`; direction was unstable across rounds. |
| Safeguard/provider telemetry | Reparses: legacy `2,2,2`, XML `3,2,3`. Timeout attempts: legacy `4,4,6`, XML `19,14,16`. Fallback reviews: legacy `1` per round, XML `6,4,5`; timeout reviews matched those values. Higher XML timeout/fallback telemetry is an observed risk in this run, not a causal conclusion. |
| Interpretation | This bounded run did not prove a quality or hallucination improvement. The sanitized aggregate is recorded at `backend/eval/reports/jd-prompt-ab-serial-2026-08-15.json` with `rawSensitiveKeyPaths=[]`; raw prompts/responses are not stored. |

## Structural result

Each JD system prompt now contains the six elements:

1. `role_and_authority`
2. `objective`
3. `input_context`
4. `evidence_boundary`
5. `constraints`
6. `output_and_failure`

Each dynamic JD input is sent through a shared XML text escaper and appears in an input data node marked `trust="untrusted"`. The existing JSON output and fallback behavior remain in place.

## Interpretation

The real-provider runs show that the XML boundary is implemented, but do not yet prove a quality improvement:

- Before: prompt XML shape and dynamic-data boundaries were not test-verified.
- After: the four JD flows are source-verified and covered by prompt-capture tests.
- Deterministic parser quality: unchanged at `0.96`.
- Initial real-provider score: `0.977` → `0.982` (`+0.5 percentage points`); only `benefit_heavy_precision_guard` improved (`0.91` → `0.94`).
- Corrected instrumented repeat: `0.977` → `0.973` (`-0.4 percentage points`); critical score changed from `1.000` to `0.992`.
- The repeat also changed reparse routing from `2/6` to `6/6`. The new telemetry shows that the XML critic responses were structurally incomplete even when their outer JSON and `revise` verdict were valid.
- The pre-fix safeguard definition used for the historical repeat contributed to the behavior: at that time, `decideJdParseGate` reparsed any first-attempt `revise`, while `normalizeIssue` replaced missing issue detail with `Unspecified safeguard issue.`. The bounded gate correction is now implemented and locally verified; this historical behavior is not the current contract.
- Hallucination reduction remains unmeasured directly because this scorer does not score unsupported claims as a separate metric.

The existing `eval:jd` runner is still not a prompt-efficacy experiment because `runJdParseEval.js` sets `DISABLE_AI_JD_ENHANCEMENT=true`. The real A/B used the same six JD cases, the same DeepSeek model/configuration, legacy `HEAD` versus the XML working tree, and the same `scoreJdParseCase` scorer. It is a valid directional comparison, but the six-case sample and scorer are not sufficient to estimate hallucination reduction or production-wide quality.

## Evidence boundaries

- Local tests and lint are verified in this checkout.
- The focused contract tests use mocked providers.
- Current local evidence is 8 focused files / 46 tests and 16 full JD robustness files / 105 tests. The post-fix live serial A/B is recorded at `backend/eval/reports/jd-prompt-ab-serial-2026-08-15.json`.
- The historical initial/pre-fix A/B runs used the six repository fixtures and the `.env` DeepSeek provider. The original compact result is recorded in `backend/eval/reports/jd-prompt-ab-2026-08-15.json`; the pre-fix corrected repeat with response-shape telemetry is recorded in `backend/eval/reports/jd-prompt-ab-telemetry-2026-08-15.json`. Raw prompts and provider responses are not committed.
- Eval telemetry now stores bounded, redacted error summaries; raw prompts and raw provider responses remain outside the output contract.
- The A/B execution contract is serial: one variant per process, one case at a time, legacy process exit before XML process start. The runner does not support concurrent cross-variant provider calls because DeepSeek concurrency limits would confound the comparison.
- The pre-fix corrected repeat recorded low-level timeout attempts in both variants (`5` legacy, `8` XML) and provider fallback reviews (`1` legacy, `2` XML). The difference was large enough that the historical live pair could not isolate prompt effect from provider variability.
- Therefore the current verdict is: **XML prompt boundary and bounded gate correction implemented/local verified; post-fix live serial A/B completed with aggregate XML `-0.2pp` and no critical-score delta; round-to-round direction is unstable, so XML efficacy and hallucination reduction remain NOT PROVEN.**
