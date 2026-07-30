# QI-CP2 — Senior-Level Voice Pool Recommendation

> **Status: Core implementation and deterministic CP2 policy tests are complete.**
> **Depends on: CP1 catalog contract — satisfied in source; actual database activation remains an external verification.**
> **Execution mode: Voice-only code path is implemented. The loader always tries approved `2026.2`, then safely falls back to approved `2026.1`; request settings cannot pin a new session to an older catalog. A missing or unavailable catalog keeps the existing pool path.**

Master authority: [Voice Question Intelligence Master Plan](../voice-question-intelligence-master-plan.md). Read Master Plan §§6.4–6.6 and this file; do not reload unrelated future checkpoints to decide a pool recommendation.

## 1. Overview — goal and current baseline

### Goal

Make Voice question selection transparent, level-aware and coverage-driven. The system must distinguish whether a question is eligible, prepared, reserved, asked, covered or degraded, then make an explainable choice between the best root question and a worthwhile follow-up.

### Confirmed baseline

- The seniority blueprint and newly persisted session settings use canonical `junior`, `intermediate`, `senior`; legacy `advanced` input is read as `senior`, while UI display remains `Senior`.
- The ranker rejects non-approved catalog snapshots before scoring, creates an explicit reservation plan before numeric ranking, hard-rejects candidates once `maxAsked` is reached, and records catalog provenance in rank trace and transcript metadata.
- Follow-up planning now records a follow-up-versus-next-root comparison and yields to an urgent pending coverage reservation. The comparison remains deliberately bounded and calibration is a human-checkpoint decision.
- The current controller / prepared pool is authoritative. CP2 extends it; it does not introduce a second selection engine.

## 2. Scope and non-goals

### In scope

- Canonical `Junior | Intermediate | Senior` migration and legacy `advanced -> senior` reader compatibility.
- Deterministic eligibility, coverage reservation, root ranking and follow-up-vs-next-root recommendation contracts.
- AI/ML asked-coverage policy, level-specific variants and recommendation traces.
- Session-pool snapshot fields needed to reproduce selection.

### Non-goals

- Catalog authoring or external research ingestion (CP1).
- Candidate question-scope clarification state/action (CP3).
- Report dimensions or cross-session progress claims (CP4).
- Text interview behavior, a generic LLM judge, automatic hiring scoring or arbitrary weight learning.

## 3. Required terminology and invariants

| State | Meaning | Invariant |
| --- | --- | --- |
| eligible | Passed lifecycle, role, level, privacy and mode gates | Non-eligible item never enters a score comparison. |
| prepared | Catalog item is contextualized and snapshot to this session | Does not mean it will be asked. |
| reserved | A countable root slot is protected for required coverage | Generic high-score items cannot displace it. |
| asked | A countable root question was actually spoken | Only this can satisfy `minAsked`. |
| covered | `minAsked` reached for a family/competency | Follow-up does not fake a second root family. |
| degraded | Requirement cannot be satisfied safely | Trace records reason; no silent fallback claim. |

Repair, repeat, transcript confirmation, system, scope clarification and other non-countable turns are never `asked` coverage.

## 4. Target recommendation contract

### 4.1 Stage A — root recommendation

The root recommender must run in this order:

1. **Hard eligibility filter**: approved lifecycle; Voice mode; role/JD/CV/user-setting conditions; target-level variant; unasked; below `maxAsked`; privacy/sensitive-topic policy; and source integrity.
2. **Coverage reservation**: protect must-cover role intent, unresolved required validation, applicable AI/ML minimum, and required behavioral coverage.
3. **Within-slot ranking**: compare only candidates in an eligible slot using coverage urgency, JD/employer criticality, evidence opportunity, transparent gap risk, level fit, policy priority, time/mode fit, freshness/project diversity and penalties.
4. **Deterministic tie-break**: reservation priority, freshness, stable catalog ID.

Weights are implementation constants only after calibration; the contract is the ordering and traceability above. A weighted total must not override a hard gate or a protected reservation.

### 4.2 Stage B — follow-up versus next root

Follow-up is allowed only if:

- an accepted parent root and answer exist;
- no scope clarification / repair remains unresolved;
- the follow-up depth and intent are still allowed;
- it tests an uncovered expected signal that matters to role fit or coaching;
- remaining budget does not sacrifice a pending reservation.

Its value is:

```text
uncovered expected signal
+ marginal evidence / decision / risk insight
+ level-specific relevance
+ answer-specific trigger
- repetition and same-project overuse
- follow-up-depth and time cost
- next-root coverage opportunity cost
```

Choose follow-up only when it exceeds the best next root's coverage-adjusted value, or when the parent has an unverified critical signal. Otherwise ask the next root question.

| Level | Preferred follow-up sequence |
| --- | --- |
| Junior | ownership/action -> result -> learning/reflection |
| Intermediate | decision/trade-off -> validation -> measurable result |
| Senior | scope/assumption -> alternative/risk -> stakeholder effect -> evaluation/monitoring/recovery |

`maxFollowUps` is a ceiling, not a target to fill.

### 4.3 AI/ML coverage contract

| Role policy | Required root coverage for completed Voice session with limit >= 8 |
| --- | --- |
| Non-tech with supported AI/digital signal | `minAsked=0`, `maxAsked=1` for AI judgement; optional, never random. |
| Software/Data | `minAsked=1`, `maxAsked=1` for AI-assisted delivery or equivalent workflow root, even if CV/JD lacks AI. |
| AI Solution / explicit AI-delivery role or strong taxonomy signal | `minAsked=2` distinct AI root families: delivery/workflow plus the best matching prompt-context, evaluation-guardrail, RAG, or agent-reliability family. |
| ML/Data Science | `minAsked=1` ML foundation/evaluation root; second MLOps root only for Senior or explicit production-ML JD. |

An early-ended session records `coverage_degraded`; it does not claim its unasked reservation was covered.

### 4.4 Required trace

```js
{
  catalogQuestionId,
  catalogVersion,
  eligibility: { passed: true, reasons: [] },
  coverageSlot: "software_ai_workflow",
  rootScore: { components: {}, penalties: [] },
  alternativesConsidered: [],
  rejectedCandidates: [],
  followUpComparison: {
    followUpIntent: "validation",
    followUpValue: 0,
    nextRootValue: 0,
    decision: "follow_up | next_root"
  },
  selectionReason: "unmet_ai_workflow_coverage_and_level_fit"
}
```

Full trace is developer/reviewer-only. Candidate-facing output may explain the capability being practised but not rank values, private evidence IDs, alternatives or internal policy labels.

## 5. Functional requirements

1. New Voice sessions persist `senior`; old session input and artifacts with `advanced` remain readable through a compatibility adapter.
2. User-selected Voice level overrides JD inferred level; mismatch is diagnostic only.
3. Each prepared root has a stable family, level, expected signals, catalog provenance and policy limits.
4. AI/ML reservations happen before numeric ranking and are visible in developer trace.
5. Root selection never repeats equivalent asked topics or overuses the same evidence/project unless a documented follow-up contract requires it.
6. Follow-up must have a named evidence deficit and comparison trace; a generic continuity boost alone is insufficient.
7. Pool shortage, incompatible category, early end or legacy data mismatch is explicit `degraded`, with a safe existing fallback.

## 6. BDD acceptance scenarios

### Software session keeps its AI workflow reservation

```gherkin
Given an 8-question Software Voice session with no CV/JD AI mention
And an approved ai_assisted_delivery root is eligible
When generic behavioral questions have higher unconstrained priority scores
Then the AI workflow root remains reserved
And one countable AI workflow root is asked before the session completes
And the trace records the reservation and selection reason
```

### Provider name alone does not over-trigger

```gherkin
Given a Software JD that names one model provider but has no AI-delivery responsibility
When eligibility is evaluated
Then AI workflow may be prioritized under the Software baseline
But a second AI root is not reserved solely from that provider name
```

### Senior follow-up beats next root only for a real deficit

```gherkin
Given a Senior candidate described an implementation but omitted risk and recovery
And there is enough remaining budget
When follow-up and next-root values are compared
Then a risk/recovery follow-up may win
And the trace records the missing expected signal and next-root opportunity cost
```

### Follow-up yields to missing coverage

```gherkin
Given an Intermediate answer has only a minor wording gap
And an unasked must-cover role-intent root remains reserved
When follow-up and next-root values are compared
Then the controller asks the reserved root next
And does not consume the final slot on a low-value follow-up
```

### Legacy level is readable

```gherkin
Given a resumable legacy session with seniorityLevel advanced
When its pool is read
Then the display and new metadata resolve to Senior
And no historical question is re-ranked or rewritten solely by the compatibility read
```

## 7. Verification and human checkpoint

Automated evidence before CP2 review:

- unit fixtures for every eligibility state, reservation, tie-break and degraded reason;
- 8- and 15-question fixtures across Junior/Intermediate/Senior;
- AI/ML boundary fixtures, including strong/medium/weak taxonomy cases;
- root alternatives and follow-up-versus-next-root trace assertions;
- dedupe, evidence-overuse, legacy session and resume compatibility tests;
- Voice no-hint and question-count regression tests;
- focused performance measurement showing selection does not add unbounded hot-path work.

The source-controlled CP2 review manifest records the reservation, level, coverage and follow-up policy as reviewed by `heminghan`. The AI workflow prompt has Junior/Intermediate/Senior variants; legacy `Advanced` keeps the Senior behavior. The manifest is bound to policy digest `36311aefcc6c503017bcaba7dd5e5bd960c0f07d395d0b5bf4ebea63a81d8116`; it does not replace the separate CP1 content-approval gate or prove a human replay, database action or candidate-visible rollout.

The review surfaces are the generated [executable policy matrix](reviews/cp2-voice-selection-policy-full-review.md) and compact [CP2 decision sheet](reviews/cp2-voice-selection-review.md). The policy matrix is generated through the real selector and follow-up comparator, and a byte-for-byte drift test keeps it aligned with executable output. The source-controlled policy review manifest binds the complete scenario set and SHA-256 policy digest; activation requires both CP1 and CP2 review records to be approved for a matching catalog version by the same reviewer. A source manifest does not prove any target Mongo entry is active; perform a read-only post-check before claiming activation. Current implementation also gives every catalog family stored level variants, gates non-tech AI judgement on AI/digital evidence, distinguishes Intermediate from Senior ML coverage, applies the comparator's general `next_root` decision, hard-enforces `maxAsked`, and records completion-time degraded coverage in a developer trace while returning only candidate-safe counts/status.

## 8. Stop conditions and rollback

Do not activate content if a proposed weight changes candidate-visible behavior without CP2 approval, if a legacy adapter would mutate historical sessions, or if selection cannot explain a missing reservation. First-failure hard stops and the three-attempt remediation rule are defined in Master Plan §13. Rollback is a bounded switch to the prior pool/ranker behavior for new sessions while preserving snapshots and traces.
