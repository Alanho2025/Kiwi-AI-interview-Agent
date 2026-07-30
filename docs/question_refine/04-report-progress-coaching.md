# QI-CP4 — Report Alignment and Progress Coaching

> **Status: Local implementation and deterministic regression coverage are complete; human tone/privacy review remains required.**
> **Depends on: CP1 catalog provenance, CP2 recommendation trace and CP3 clarification event contract.**
> **Execution mode: candidate-safe report projection is implemented for API, UI, TXT and PDF; it does not imply human/browser/provider validation.**

Master authority: [Voice Question Intelligence Master Plan](../voice-question-intelligence-master-plan.md). Read this file with the current accepted-answer/report QA services; do not infer candidate-visible behavior from internal trace fields.

## 1. Overview — goal and baseline

### Goal

Extend report coaching from generic STAR/alignment feedback to explain whether a candidate demonstrated the intended role signal, evidence quality, scope control, ownership and AI/ML judgement—without leaking question-pool internals, turning coaching into a hiring decision, or treating repair turns as answers.

### Confirmed baseline

- Report alignment is built from accepted answers; repair, repeat, clarification, system and similar turns are excluded.
- Existing dimensions include question alignment, evidence fit/clarity, role-intent fit, naturalness and concision.
- Current output includes clarification and AI-judgement coaching with allowlisted grounding sources, per-session progress hypotheses and optional candidate-provided private reflection. Coaching does not alter the answer score.

## 2. Scope and non-goals

### In scope

- Per-answer candidate-safe coaching dimensions and aggregate per-session progress map.
- Controlled consumption of catalog expectations, root recommendation and scope-framing observations.
- AI/ML coaching that tests workflow, ownership and verification rather than tool-name recall.
- Candidate-provided real-interview reflection schema and conservative stuck-moment hypotheses.

### Non-goals

- Employer-side score, hire/no-hire recommendation, personality diagnosis or verified real-world performance claim.
- Revealing complete question catalog, rank score, alternatives, private CV/JD IDs, raw prompt, chain-of-thought or reviewer controls.
- Changing scoring because a candidate had an ASR repair or asked a clarification question.
- Claiming that mock performance transferred to a real interview without candidate-provided evidence.

## 3. Target report contract

### 3.1 Candidate-safe dimensions

```text
Role fit · Evidence · Structure · Clarification · Ownership
Technical depth · AI judgement · Communication · Adaptability
```

For each accepted answer, report may state:

1. the human-readable capability being practised;
2. whether the example, personal action, decision, validation and result were sufficiently clear;
3. whether scope was clarified or reasonably framed;
4. for AI/ML questions, whether the candidate explained workflow, verification, risk and responsibility instead of listing tools;
5. one bounded next-step improvement.

### 3.2 Internal-to-safe projection

| Internal input | Candidate-safe projection | Must not expose |
| --- | --- | --- |
| catalog competency / expected signals | "This answer practised ownership and verification." | catalog ID/version and full expected-signal array |
| root selection trace | "This was relevant to the role's delivery work." | rank score, alternatives, coverage slot, private JD evidence |
| `question_scope_clarification` event | "You clarified the scope before answering." | ambiguity mode, hidden scope options, controller action |
| explicit scope assumption | "Naming your assumption made your answer easier to follow." | assumption classifier confidence / raw trace |
| AI-delivery taxonomy | "You explained how you verified AI-assisted work." | tool aliases or hidden qualification policy unless candidate raised them |

### 3.3 Progress and stuck-moment boundary

The first release creates a per-session roll-up and optional candidate-provided reflection record. It may suggest a coaching hypothesis such as `missing_validation`, `abstract_example`, `missing_result`, `scope_not_stated`, or `answer_interrupted`.

It must not label a person as incapable, claim a real interview outcome, infer psychological state, or use a historical coaching signal to alter scoring without an approved future policy.

## 4. Functional requirements

1. Main report scoring continues to consume accepted answers only.
2. Scope clarification is a non-score observation; it can influence clarification coaching but must not create an answer-alignment row by itself.
3. Explicit assumption framing is treated as a positive/adequate coaching signal, not a penalty.
4. AI/ML feedback distinguishes tool use from evidence of problem framing, workflow, verification, evaluation, risk and ownership.
5. Feedback remains English, concise, natural and non-accusatory.
6. Each feedback claim has a grounded source: accepted answer, approved catalog expectation, reviewed role intent or candidate-provided reflection.
7. Unsupported claim, missing source, internal metadata leakage or candidate-visible score inconsistency remains a blocking report QA failure.

Candidate API, QA-rewrite response, JSON/TXT/PDF projection remove catalog/version, proof/evidence, role-intent/coverage, turn/question, claim/source/chunk IDs, grounding sources, traces and rewrite internals. QA treats those identifier forms in coaching text as a blocking metadata leak and rejects any nonempty proof/coverage reference that is not present in the report's declared contract.

## 5. BDD acceptance scenarios

### Scope clarification is coaching, not a second answer

```gherkin
Given a candidate asks a valid scope question and then gives an accepted answer
When the report dataset is built
Then there is one alignment record for the accepted answer
And there is a separate non-score scope observation
And the report may coach clarification without inflating question count or score
```

### Explicit assumption is not framed as wrong

```gherkin
Given a candidate states a reasonable assumption and gives a relevant answer
When the report is generated
Then feedback recognises the scope framing as useful
And it may suggest asking for confirmation next time
And it does not state that the candidate answered the wrong question
```

### AI answer needs verification, not tool-name praise

```gherkin
Given an AI-assisted-delivery question
And the candidate only lists Codex and Claude without describing validation
When coaching is generated
Then feedback identifies the missing verification/ownership signal
And does not reward the answer merely for naming tools
```

### Report never leaks selection internals

```gherkin
Given an answer with a root recommendation trace and private evidence references
When the candidate-facing report is rendered
Then no catalog ID, rank score, alternative question, private evidence ID or raw controller reason is present
```

## 6. Verification and CP4 human gate

Required evidence:

- accepted-answer isolation and turn-type regression tests;
- fixtures for direct answer, scope question, explicit assumption, AI-tool-only answer, grounded AI workflow answer, and missing-result answer;
- report QA tests for source grounding, unsupported claims, score consistency and internal leakage;
- human tone review across Junior/Intermediate/Senior and technical/non-technical examples;
- legacy report reader tests and candidate-safe UI/API projection checks if a new field is exposed;
- privacy review of reflection and progress records.

CP4 reviewer accepts/revises/blocks report wording, dimensions, source boundaries and progress-map semantics. Local QA blocks missing coaching, invalid source/status, internal metadata leakage, score mutation and invalid progress hypotheses. Reviewer approval allows CP5 evaluation/rollout planning; it does not prove browser, live provider or production behavior.

## 7. Stop conditions and rollback

Any ungrounded coaching claim, candidate-visible leakage, score mutation by a non-answer turn, retention ambiguity or false hiring implication is a first-failure hard stop. Other deterministic issues use Master Plan §13's three-attempt policy. Rollback returns to current report dimensions for new reports, preserving raw accepted-answer and QA evidence for investigation.
