# JD Prompt Migration Baseline — 2026-08-15

## Scope

This is the pre-migration record for the JD prompt experiment. No production prompt or runtime logic was changed before this record.

The JD LLM surface currently contains four source-level flows:

1. `jobDescriptionAiService.js:18-49` — optional AI skill and requirement enhancement.
2. `jdUniversalParserService.js:329-398` — conditional universal role-profile parsing for semantic matching.
3. `jdParseCriticAgent.js:17-75` — conditional post-parse critic.
4. `jdParseReparseAgent.js:59-112` — conditional reparse override generation when the critic requests repair.

The existing deterministic/heuristic parser and all existing fallback and safeguard routing remain the authority outside these LLM calls.

## Current prompt shape

- JD skill enhancement: plain-text instruction plus raw JD interpolation; JSON-only output instruction is passed as the system instruction.
- Universal JD parser: plain-text rules, fallback profile JSON, and raw JD interpolation; JSON-only output instruction is passed as the system instruction.
- JD critic: plain-text critic rules, raw JD, and parsed JD interpolation; JSON-only output instruction is passed as the system instruction.
- JD reparse: plain-text repair rules, critic feedback, previous parsed JD, and raw JD interpolation; JSON-only output instruction is passed as the system instruction.

Current evidence does not show a shared XML prompt contract or a dedicated LLM prompt escaping serializer for these flows.

## Runtime conditions

- AI skill enhancement returns the empty AI bundle when disabled, when `DISABLE_AI_JD_ENHANCEMENT=true`, or when `DEEPSEEK_API_KEY` is unavailable.
- Universal JD parsing returns the fallback profile when `AI_TEST_MODE=mock` or `MATCH_ENGINE` is not `semantic`.
- JD critic/reparse calls are controlled by the agentic safeguard flag and their existing timeout/fallback policy.
- `callDeepSeekJson` provides JSON extraction/repair and caller fallback; it is not a complete domain schema validator.

## Baseline evidence collected

| Check | Command | Result | What it proves |
|---|---|---:|---|
| JD robustness suite | `npm run test:jd` | 11 files, 64 tests passed | Existing JD fallback, budget, parser, safeguard, corpus, and routing behavior passed in the current test environment. |
| Deterministic JD parse eval | `npm run eval:jd` | 6 cases, average `0.96` | Current deterministic JD parser scored against `eval/datasets/jd-parse-eval.json`. |
| Live prompt efficacy | Not run | `NOT RUN` | No before/after LLM prompt comparison has been established. |
| Prompt XML shape | Not run | `NOT RUN` | Existing tests do not capture and assert all JD prompt payloads. |
| Dynamic-data escaping | Not run | `NOT RUN` | Raw JD, parsed JD, and critic feedback boundaries are not yet tested as XML data nodes. |

Important limitation: `eval/runners/runJdParseEval.js` sets `DISABLE_AI_JD_ENHANCEMENT=true`, so the `0.96` score is not evidence of the JD LLM prompt quality. It is a deterministic parser baseline only.

## Proposed six-element contract for the pilot

The repository does not currently define a canonical meaning for “six elements”. The following is therefore an explicit pilot decision, not an existing project fact:

1. `role_and_authority` — who the model is and what the controller still owns.
2. `objective` — the single task for this call.
3. `input_context` — the raw JD or prior structured data, marked as data.
4. `evidence_boundary` — what source/evidence may support the result and what must remain unknown.
5. `constraints` — forbidden inference, classification, and output behavior.
6. `output_and_failure` — JSON shape, allowed fields, and existing fallback semantics.

The six elements will be represented with XML tags while keeping model output as the existing JSON contract.

## Comparison requirements after migration

The post-migration run must use the same fixtures and, where a live provider is approved, the same model/configuration and input set. It must report separately:

- deterministic JD parser score;
- field-level false positives, especially benefits/application/company-context leakage;
- invalid JSON or fallback rate;
- unsupported requirement or evidence rate;
- prompt contract/escaping adversarial failures;
- token and latency change where provider usage is available.

No hallucination improvement percentage is claimed until a live or replayable LLM comparison produces both pre- and post-migration outputs.

## Change boundary

The planned pilot may change only JD prompt templates and the minimum prompt-boundary serialization needed to make the XML data nodes safe. It must not change parser orchestration, controller decisions, fallback ownership, match gating, persistence, or public API behavior.
