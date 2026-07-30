# QI-CP3 — Voice Scope Clarification and Ambiguity Handling

> **Status: Local implementation complete; ready for CP3 human review.**
> **Depends on: CP2 approved pool metadata and recommendation contract.**
> **Execution mode: Local CP3 and CP4 implementations are complete. Candidate-visible activation, human Voice/browser review and rollout remain gated.**

Master authority: [Voice Question Intelligence Master Plan](../voice-question-intelligence-master-plan.md). This checkpoint must be read with `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`; the voice product contract wins on conflict.

## 1. Overview — goal and baseline

### Goal

Allow a Voice candidate to ask a meaningful question about an interview question's scope, or to state a reasonable assumption, without confusing it with ASR repair, advancing the question count, losing the active question, or creating an ungrounded report score.

### Confirmed baseline

- Current Voice behavior is a state machine. Repair, transcript confirmation, clarification, repeat and system turns are not formal interview questions.
- The current evaluator detects explicit misunderstanding and candidate-question signals, but normal interview-stage candidate questions mainly result in generic rephrasing; dynamic answer routing is stronger at wrap-up.
- The voice latency target and bounded controller path prohibit an unbounded new model/retrieval loop.

## 2. Scope and non-goals

### In scope

- `none`, `bounded_scenario`, and `open_scope_probe` ambiguity modes from prepared question metadata.
- A distinct semantic question-scope clarification action, context response and transcript metadata.
- Assumption-framed answers and a bounded clarification coaching event.
- State/counting/latency/fallback contracts and human transcript review.

### Non-goals

- Changing ASR confidence thresholds or transcript-repair strategy.
- Letting a model invent scenario facts or company facts in real time.
- Turning every interview question into a clarification challenge.
- Text interview behavior, score mutation from a clarification event, or automatic candidate judgement.

## 3. Ambiguity policy

| Mode | When allowed | Candidate strong signal | Interviewer behavior |
| --- | --- | --- | --- |
| `none` | Standard clear technical/behavioral question | Grounded direct answer | Normal answer/follow-up flow. |
| `bounded_scenario` | Context is necessary for a fair answer | Decision, trade-off and validation within supplied limits | Return only pre-authorized bounded context when asked. |
| `open_scope_probe` | Requirements clarification is core to an eligible Solution/Product/Senior technical role | Ask for a constraint that changes the answer, or state an assumption and invite confirmation | Provide one prepared scope option; preserve original root question. |

For an 8-question session, `open_scope_probe` has `maxAsked=1`; Junior defaults to zero. It must never be used merely because the system lacks an appropriate question.

## 4. Target state and contracts

### 4.1 Required action and turn metadata

Planned action: `ANSWER_QUESTION_SCOPE`.

```js
{
  actionType: "ANSWER_QUESTION_SCOPE",
  rootQuestionId: "...",
  catalogQuestionId: "...",
  clarificationContextVersion: "...",
  turnType: "question_scope_clarification",
  countsAsQuestion: false,
  countsAsAnswer: false,
  scopeResponseReason: "candidate_requested_focus"
}
```

The implementation must make `question_scope_clarification` non-countable in every relevant question-count and report-dataset contract. Existing generic `clarification` remains compatible; the new subtype prevents semantic scope handling from disappearing inside ASR repair telemetry.

### 4.2 Transition

```text
active root question
  -> candidate scope question
  -> ANSWER_QUESTION_SCOPE
  -> same root remains active
  -> candidate answer
  -> normal accepted-answer evaluation or bounded follow-up
```

No state transition may increment `currentQuestionIndex`, mark the root asked twice, add a second coverage event, or overwrite the parent question.

### 4.3 Assumption-framed answer

If the candidate says, for example, "I'll assume this is an internal workflow and explain my approach," the answer can enter normal evaluation. Store an observation such as `scopeFraming=explicit_assumption`; do not require a separate clarification turn and do not penalize the answer for not asking a question.

### 4.4 ASR versus semantic scope clarification

| Signal | Owner | Correct action |
| --- | --- | --- |
| low-confidence or ambiguous transcript | Voice/STT confidence gate | Existing transcript confirmation; no semantic coaching claim. |
| "Do you mean personal use or a product I built?" | Evaluator + controller | `ANSWER_QUESTION_SCOPE`; same root stays active. |
| "I will assume X" followed by substantive answer | Answer evaluator | Accepted answer plus scope-framing observation. |
| repeated misunderstanding after scope response | Controller | Existing rephrase/scaffold/switch safety path; do not loop indefinitely. |

## 5. Functional requirements

1. Only a prepared item with `bounded_scenario` or `open_scope_probe` may supply a semantic scope response.
2. Scope context comes from versioned catalog/session metadata, never from a live free-form model invention.
3. The controller selects scope response before rephrase when candidate intent is a valid scope question.
4. Scope clarification is non-countable and excluded from accepted-answer scoring, but is traceable for CP4 coaching.
5. A direct, reasonable scope assumption is accepted as an answer; report language must not call it wrong.
6. Repeated clarification, duplicate questions, invalid action, timeout and unavailable catalog context all follow deterministic fallback without advancing counts.
7. Additional latency work is bounded and measured; no website fetch, unbounded retrieval or extra heavy model call is allowed on the hot path.

## 6. BDD acceptance scenarios

### Valid scope question resumes the same root

```gherkin
Given an active open_scope_probe root question with approved scope contexts
When the candidate asks which of two relevant scopes to address
Then the controller answers with the prepared bounded context
And the next turn keeps the same rootQuestionId
And question count, coverage and answer alignment do not advance
```

### Explicit assumption remains a valid answer

```gherkin
Given a candidate gives a substantive answer after stating a reasonable scope assumption
When the answer is evaluated
Then it is eligible for accepted-answer assessment
And the report input records explicit_assumption
And no clarification turn is manufactured
```

### Low-confidence transcript remains an STT issue

```gherkin
Given a contentful but low-confidence speech transcript
When the system cannot safely know what the candidate said
Then existing transcript confirmation occurs
And the system does not infer a scope question or coaching signal
```

### Scope context unavailable fails safely

```gherkin
Given a root question claims open_scope_probe but its context version is unavailable
When the candidate requests clarification
Then the controller uses a safe generic bounded rephrase or marks the question degraded
And does not invent facts, advance count, or enter an infinite loop
```

## 7. Verification and CP3 human gate

Before human review, provide:

- state-machine, action-completeness and non-countable turn tests;
- transcript fixtures for valid scope question, explicit assumption, ASR low confidence, repeated clarification and unavailable context;
- question-count, coverage and report-dataset regression tests;
- duplicate/root-resume and session-reconnect tests;
- first-audio latency trace before/after with bounded fallback evidence;
- redacted developer trace showing action, reason, context version and no raw private payload.

CP3 reviewer listens to or browser-validates the cases above, confirms that the response sounds natural, and verifies no candidate sees internal policy or answer hints. Possible decision: `approved`, `revise`, `blocked`, `deferred`. Approval permits CP5 evaluation planning; it does not promote candidate-visible enforcement.

The candidate session projection keeps only question text/basic presentation and transcript topic/latency. It strips catalog provenance, selection/coverage policy, ambiguity mode, root/prepared IDs and clarification context/response text, so the runtime may use scope context without leaking an answer hint.

### Local implementation evidence — 2026-07-29

- `ANSWER_QUESTION_SCOPE` now has a deterministic Voice controller lane before the generic evaluator/rephrase path.
- The request and response keep the same `rootQuestionId`; both are non-countable, excluded from report answer-pair datasets, and the request does not create a PostgreSQL `interview_responses` answer row.
- Only `bounded_scenario` or `open_scope_probe` items with a prepared `clarificationContextVersion` and candidate-safe `responseText` can produce a semantic scope response.
- Missing context fails closed to a deterministic rephrase; a repeated request uses a bounded scaffold; a substantive `I'll assume ...` answer remains countable and receives `scopeFraming=explicit_assumption`.
- The redacted trace contains only action, reason, context version, root reference and count flags. It does not contain candidate text or the prepared response.
- Focused and broader local mock-safe suites cover resolver, controller persistence, question counting, catalog snapshot propagation, report exclusion, harness mapping and Voice confidence precedence.

The `2026.1` source catalog intentionally remains unchanged and all its items use `ambiguityPolicy.mode = none`. The `2026.2` source catalog supplies versioned clarification context, but runtime uses it only when the target database contains matching `approved` entries. Therefore a real valid-scope Voice/browser replay still requires an external lifecycle post-check and CP3 human review; it is not permission to mutate an existing digest.

## 8. Stop conditions and rollback

Stop on any state-machine, counting, report-grounding, privacy or latency regression; these are first-failure hard stops. A normal deterministic defect follows the three evidence-backed remediation-attempt rule in Master Plan §13. Rollback restores the previous rephrase behavior for new Voice turns while keeping trace/evidence for diagnosis.
