# QI-CP5 — Evaluation, Governed Rollout and Removal

> **Status: Draft for human review.**
> **Depends on: CP1–CP4 approved contracts and their local implementation evidence.**
> **Execution mode: evaluation and rollout planning only; promotion requires CP5 owner approval.**

Master authority: [Voice Question Intelligence Master Plan](../voice-question-intelligence-master-plan.md). CP5 is the release/evidence authority for Question Intelligence; it must not reopen earlier product decisions without returning them to the relevant checkpoint.

## 1. Overview — goal and baseline

### Goal

Establish reproducible evaluation, human validation, rollout, rollback and legacy-removal gates for the Question Intelligence path. A local test pass must never be presented as live microphone, provider, human/browser or production proof.

### Baseline

- Existing pool/ranker, voice contract, report QA and robustness tests provide a foundation but do not validate the proposed catalog, two-stage recommender, scope clarification or report dimensions.
- Existing product rollout direction is `shadow -> observe -> warn -> domain-owned enforce`.
- Voice has strict state/counting and first-audio latency constraints; real provider testing has cost, credentials and privacy boundaries.

## 2. Scope and non-goals

### In scope

- Frozen fixtures, golden datasets, adversarial cases, replay/eval outputs and human review materials.
- Per-phase parity, coverage, false-positive/false-negative, latency, privacy and rollback measurements.
- Controlled rollout mode, promotion criteria, compatibility/read-path retirement and removal manifest.
- CP5 owner decision record.

### Non-goals

- Inventing numerical quality thresholds before calibration.
- Automatically promoting any feature because a test suite passes.
- Running paid real-AI/provider tests without explicit approval.
- Deleting legacy artifacts, snapshots, reports or data merely because a new path exists.
- Shipping text-interview behavior under this Voice-only plan.

## 3. Evaluation corpus and evidence taxonomy

### 3.1 Frozen scenario families

The corpus must cover at minimum:

- Junior, Intermediate and Senior across non-tech, Software, Data, AI Solution and ML roles;
- strong/medium/weak AI-delivery signals and no-signal controls;
- catalog lifecycle/version changes, missing catalog and legacy `advanced` sessions;
- coverage reservations, root alternatives, follow-up versus next-root decisions, early end and degraded coverage;
- direct answer, explicit scope assumption, valid scope clarification, ASR low confidence, repeated clarification and unavailable context;
- AI-tool-name-only, grounded AI workflow, ML evaluation, privacy/NDA boundary and tool-failure answers;
- report grounding/leakage, duplicate questions, evidence overuse, replay/resume and rollback cases.

### 3.2 Evidence categories

Every verdict must separately state:

| Category | What it proves | What it does not prove |
| --- | --- | --- |
| Implemented | Code/document artifact exists at an identified SHA | Correct runtime behavior |
| Locally verified | Focused deterministic tests/replay pass | Browser, microphone, provider or production behavior |
| Live/provider verified | Approved real external service path passed | Human usefulness or production readiness |
| Human/browser validated | Reviewer exercised the relevant UI/voice behavior | Full production telemetry/rollback readiness |
| Production verified | Approved production metrics and operator evidence pass | Future release safety |
| Blocked/deferred | Known gap has honest evidence and owner | Resolution or acceptable risk |

## 4. Rollout contract

### 4.1 Modes

```text
shadow -> observe -> warn -> domain-owned enforce
```

| Mode | Behavior | Required evidence to enter |
| --- | --- | --- |
| shadow | Compute new catalog/recommendation/clarification/report decisions; preserve legacy candidate output; store redacted trace. | Deterministic parity, privacy and replay evidence. |
| observe | Reviewer/operator compares new decision against current output; existing controller remains authority. | Shadow stability, false-case sample and owner approval. |
| warn | Surface a bounded operator/developer warning for an approved violation; no candidate penalty. | Calibrated false-positive/false-negative review and rollback proof. |
| enforce | Domain controller changes behavior for a validated contract. | CP5 approval, human/browser evidence, applicable live/provider proof and rollback plan. |

No model, feature flag or UI component may bypass these modes. Flag-off must preserve the prior behavior exactly enough for the defined parity contract.

### 4.2 Rollback

Rollback is a bounded switch for new sessions to the last approved controller/pool/report behavior. It preserves immutable session snapshots, reports, catalog versions, redacted evidence and blocked-case records. Rollback must not erase data in order to hide a regression.

## 5. Functional requirements

1. Every new selection and follow-up decision has a replayable redacted trace and a fixture path.
2. Every new voice turn type proves non-countability, parent/root continuity, latency behavior and safe fallback.
3. Every report dimension has grounding and no-leakage tests.
4. Every compatibility path has an owner, retention window, removal condition and cleanup test.
5. Metrics are sliced by role family, level, AI/ML signal strength, ambiguity mode and degraded state; one aggregate score is insufficient.
6. Human calibration uses representative holdout cases and records disagreement; thresholds are proposed only after that evidence exists.
7. Provider cost/credentials, browser microphone permission, recordings and production actions require explicit owner authority.

## 6. BDD acceptance scenarios

### Shadow preserves candidate output

```gherkin
Given Question Intelligence shadow mode is enabled
When a Voice session runs a catalog and recommendation decision
Then the existing candidate-visible question behavior remains authoritative
And the new decision is stored only as a redacted shadow trace
And no score, count or report claim changes because of shadow output
```

### Warn cannot become enforce by itself

```gherkin
Given a warning threshold has been configured
When the warning fires repeatedly
Then the system remains in warn mode
And no candidate-visible behavior changes without CP5 approval
```

### Rollback preserves history

```gherkin
Given a new recommendation path causes an approved rollback trigger
When rollback is executed for new sessions
Then new sessions use the previous safe path
And completed snapshots/reports/traces remain readable
And no catalog version or candidate data is deleted
```

### Real provider proof is labeled honestly

```gherkin
Given only mock Voice tests have passed
When release evidence is reported
Then it is labeled locally verified
And it is not labeled live-provider, human microphone or production verified
```

## 7. Verification gates

Before CP5 review, collect:

- focused unit/integration tests for CP1–CP4 acceptance criteria;
- frozen replay dataset and before/after parity report;
- selection, follow-up, count, report-grounding, privacy and rollback adversarial cases;
- latency percentile trace for relevant Voice transitions;
- human review sample with disagreements and unresolved edge cases;
- browser/microphone validation; approved provider validation only when authorized;
- removal manifest for deprecated aliases, adapters, flags, fixtures and code paths;
- an evidence scorecard that separately labels each category in §3.2.

## 8. CP5 human promotion gate

Owner/reviewer must review:

- phase acceptance evidence and unresolved blocked/degraded cases;
- shadow/observe parity, false-positive/negative analysis and rollback trigger;
- human browser/microphone evidence and, if approved, live-provider results;
- candidate-safe behavior, privacy/retention, costs and operator readiness;
- removal manifest and whether legacy readers must remain for an active retention window.

Only `approved` can promote one explicitly named contract to the next rollout mode. `revise`, `blocked` or `deferred` leaves the lower mode in place. CP5 approval is not blanket authority for unrelated production deploys.

## 9. Bounded remediation and final handoff

Apply Master Plan §13 across every CP1–CP5 verification failure. A safety/privacy/counting/source-of-truth/provider-cost issue stops after the first failure. For another deterministic root cause, record up to three distinct evidence-backed attempts; then mark the slice blocked/deferred, prepare a GitHub issue draft with SHA/traces/failed criteria, and continue only independent work.

## 10. Completion record

The final record names the enabled rollout mode, exact artifacts/SHAs, passing and non-passing gates, rollback state, legacy removal state, human decisions and all remaining live/production unknowns. It must never summarize the project as simply "done".
