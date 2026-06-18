# Google Agents CLI Eval Adapter

This folder adapts Kiwi's CV parse -> JD parse -> CV-JD match preparation
pipeline into Google Agents CLI `EvaluationDataset` trace JSON.

The trace builder runs real backend eval services in mock/safeguarded mode:

- `buildCvProfile`
- `buildGuardedStructuredJobDescriptionRubric`
- `compareCvToJobDescriptionWithSafeguard`
- Kiwi deterministic CV/JD/match scorers

The generated trace is a complete grading input for `agents-cli eval grade`.

## Build Prep Pipeline Traces

From `backend`:

```bash
npm run eval:google-prep-trace
```

Default output:

```text
eval/googleAgentsCli/traces/prep-pipeline-trace.json
```

## Grade With Google Agents CLI

From `backend`:

```bash
agents-cli eval grade \
  --traces eval/googleAgentsCli/traces/prep-pipeline-trace.json \
  --output eval/googleAgentsCli/results \
  --config eval/googleAgentsCli/prep_pipeline_eval_config.yaml
```

This config runs:

- `kiwi_prep_pipeline_score`: local deterministic score from Kiwi eval checks.
- `kiwi_prep_constructive_review`: Gemini judge with constructive engineering advice.
- `multi_turn_trajectory_quality`: Google built-in multi-turn trajectory metric.

## Summarize Advice

From `backend`:

```bash
npm run eval:google-prep-advice
```

Default output:

```text
eval/googleAgentsCli/reports/prep-pipeline-advice.latest.md
```

## Cloud or LLM judge grading

Do not run built-in metrics such as `multi_turn_trajectory_quality`,
`final_response_quality`, `grounding`, or `hallucination` without confirming
the Google Cloud project and cost expectations first.
