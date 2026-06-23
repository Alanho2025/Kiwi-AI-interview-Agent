# Kiwi Interview Agent Evaluation

This folder contains deterministic regression tests and agent-evaluation runners for the Kiwi Interview Agent.

The evaluation design follows an agent benchmark style:

- Module evals check individual components such as CV parsing, JD parsing, CV-JD matching, interview control, and report QA.
- End-to-end scenario evals check fixed interview scenarios for setting adherence, multi-turn structure, grounded questions, and evidence-based reports. They do not execute production routes, databases, voice runtime, or live product UI.
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
- `npm run eval:voice-robustness` → deterministic voice robustness evaluation
- `npm run eval:retrieval` → deterministic retrieval evaluation
- `npm run eval:agent-trajectory` → deterministic agent trajectory evaluation
- `npm run eval:company-research` → deterministic company research evaluation
- `npm run eval:voice-quality` → deterministic voice quality evaluation
- `npm run eval:stability` → deterministic stability evaluation
- `npm run eval:prep-stability` → deterministic preparation stability evaluation
- `npm run eval:agent-framework` → retrieval, trajectory, company research, voice quality, and stability evals
- `npm run eval:local` → E2E, Green Agent, voice robustness, and agent-framework evals without real-provider requirements
- `npm run eval:real` → CV, JD, SEEK, match, interview, report, and baseline real-provider evals
- `npm run eval:all` / `npm run eval:plan` → runs 15 suites sequentially through `runPlanEvalSuite.js`, including the real-provider CV, JD, SEEK, match, interview, report, and baseline evals plus local E2E/Green/voice/retrieval/trajectory/company/stability suites; requires explicit cost/credential approval
- `npm run quality:local` → runs lint, robustness tests, and mock/static evals
- `npm run quality:real` → runs real AI evals that require configured credentials and cost/rate-limit awareness
- `npm run quality:all` → runs local quality first, then real AI evals

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

Google Agents CLI trace builders and advice summarizers are documented separately in `eval/googleAgentsCli/README.md` and are not part of every default eval command.

## Benchmark design

### Module evals

Module datasets live in `eval/datasets/*-eval.json`. They use flexible expectations so the system can improve wording without breaking the benchmark.

### End-to-end scenarios

`eval/datasets/end-to-end-interview-scenarios.json` contains realistic interview flows. Each case includes interview settings, CV profile, JD profile, transcript, report, expected flow, and grounding rules.

The runner checks first question, planned question count, required or blocked categories, required topics, duplicate questions, question quality, report grounding, and hallucination risk against the fixed scenario artifacts.

### Kiwi Green Agent

`eval/greenAgent/kiwiGreenAgent.js` is the orchestration layer. It is deterministic and local. It does not call production routes, databases, or paid LLM APIs, so the benchmark stays repeatable and CI-friendly.

### Baseline comparison

`eval:baseline` is a feedback-level benchmark. It compares same-input generic ChatGPT-style baseline feedback against Kiwi Agent feedback using DeepSeek semantic judge as the primary score, keyword matching as diagnostics, and forbidden claims as a safety penalty. It does not evaluate the full product flow.
