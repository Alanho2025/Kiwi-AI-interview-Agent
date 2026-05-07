# Kiwi Interview Agent Evaluation

This folder contains deterministic regression tests and agent-evaluation runners for the Kiwi Interview Agent.

The evaluation design follows an agent benchmark style:

- Module evals check individual components such as CV parsing, JD parsing, CV-JD matching, interview control, and report QA.
- End-to-end scenario evals check whether the product flow obeys interview settings, keeps multi-turn structure, asks grounded questions, and writes evidence-based reports.
- The Kiwi Green Agent runner acts as an evaluator layer. It loads benchmark tasks, prepares the environment, runs checks, aggregates metrics, and writes reports.

## Available commands

- `npm run eval:cv` → CV parse evaluation
- `npm run eval:jd` → JD parse evaluation
- `npm run eval:seek` → SEEK JD benchmark
- `npm run eval:match` → CV ↔ JD match evaluation
- `npm run eval:cv-jd-match` → alias for CV ↔ JD match evaluation
- `npm run eval:interview` → interview controller action evaluation
- `npm run eval:report` → report QA evaluation
- `npm run eval:e2e` → end-to-end interview scenario benchmark
- `npm run eval:green` → Kiwi Green Agent benchmark runner
- `npm run eval:all` → runs all evaluation scripts with quality gates
- `npm run quality:all` → runs robustness tests, then all evals

## Quality gates

Default pass gates live in `eval/config/qualityGates.js`. Runners now use non-zero thresholds by default. You can override them locally:

```bash
npm run eval:e2e -- --min-average 0.9 --fail-below 0.75
```

## Output

Each runner writes:

- `eval/reports/*.latest.json`
- `eval/reports/*.latest.md`

The reports answer three questions quickly:

1. Which cases are strong now
2. Which cases are weak now
3. Which checks failed, so fixes are evidence-based instead of guess-based

## Benchmark design

### Module evals

Module datasets live in `eval/datasets/*-eval.json`. They use flexible expectations so the system can improve wording without breaking the benchmark.

### End-to-end scenarios

`eval/datasets/end-to-end-interview-scenarios.json` contains realistic interview flows. Each case includes interview settings, CV profile, JD profile, transcript, report, expected flow, and grounding rules.

The runner checks first question, planned question count, required or blocked categories, required topics, duplicate questions, question quality, report grounding, and hallucination risk.

### Kiwi Green Agent

`eval/greenAgent/kiwiGreenAgent.js` is the orchestration layer. It is deterministic and local. It does not call production routes, databases, or paid LLM APIs, so the benchmark stays repeatable and CI-friendly.
