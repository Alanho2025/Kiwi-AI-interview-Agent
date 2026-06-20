# Google Agents CLI Eval Adapter

This folder adapts Kiwi backend eval pipelines into Google Agents CLI
`EvaluationDataset` trace JSON.

The preparation trace builder runs real backend eval services in
mock/safeguarded mode:

- `buildCvProfile`
- `buildGuardedStructuredJobDescriptionRubric`
- `compareCvToJobDescriptionWithSafeguard`
- Kiwi deterministic CV/JD/match scorers

The generated trace is a complete grading input for `agents-cli eval grade`.

Voice and question-agent traces are non-ADK hand-built grading traces. They run
the existing deterministic Kiwi services and fixture scenarios, then expose each
meaningful stage as `function_call` / `function_response` events.

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

## Build Voice Interview Traces

From `backend`:

```bash
npm run eval:google-voice-trace
```

Default output:

```text
eval/googleAgentsCli/traces/voice-interview-trace.json
```

Grade:

```bash
agents-cli eval grade \
  --traces eval/googleAgentsCli/traces/voice-interview-trace.json \
  --output eval/googleAgentsCli/results/voice-interview \
  --config eval/googleAgentsCli/voice_interview_eval_config.yaml
```

Summarize advice:

```bash
npm run eval:google-voice-advice
```

Default output:

```text
eval/googleAgentsCli/reports/voice-interview-advice.latest.md
```

## Build Question Agent Traces

From `backend`:

```bash
npm run eval:google-question-trace
```

Default output:

```text
eval/googleAgentsCli/traces/question-agent-trace.json
```

Grade:

```bash
agents-cli eval grade \
  --traces eval/googleAgentsCli/traces/question-agent-trace.json \
  --output eval/googleAgentsCli/results/question-agent \
  --config eval/googleAgentsCli/question_agent_eval_config.yaml
```

Summarize advice:

```bash
npm run eval:google-question-advice
```

Default output:

```text
eval/googleAgentsCli/reports/question-agent-advice.latest.md
```

## Trace Validation

Before grading a hand-built trace, run the local trace validator:

```bash
python3 /Users/heminghan/.codex/skills/google-agents-cli-trace-eval/scripts/validate_trace_dataset.py eval/googleAgentsCli/traces/voice-interview-trace.json
python3 /Users/heminghan/.codex/skills/google-agents-cli-trace-eval/scripts/validate_trace_dataset.py eval/googleAgentsCli/traces/question-agent-trace.json
```

Keep deterministic scores, expected labels, and private rubrics outside
`agent_data`; judges can inspect every `agent_data` event.
