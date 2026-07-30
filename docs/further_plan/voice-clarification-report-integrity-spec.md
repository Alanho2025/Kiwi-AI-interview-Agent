# Voice Clarification and Candidate Report Integrity Spec

狀態：Implemented locally；remediation focused gates passed；follow-up audit 由 owner 明確免除  
日期：2026-07-30 Pacific/Auckland  
Execution mode：Implementation / verification  
Goal：[Voice Clarification and Candidate Report Integrity Goal](voice-clarification-report-integrity-goal.md)  
產品契約：[Voice Interview Product Behavior](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md)  
相關現行設計：[Voice Scope Clarification](../question_refine/03-voice-scope-clarification.md)、[Report Progress Coaching](../question_refine/04-report-progress-coaching.md)、[Harness Goal](../harness/goal.md)、[Harness Spec](../harness/spec.md)

> **實作狀態 (Implementation Status)**：Implemented / local automated gates passed
>
> **校驗測試路徑 (Verified by Tests)**：[Evidence Matrix](voice-clarification-report-integrity-evidence.md)；Section 14 保留完整驗證邊界。

## 1. Overview

### 1.1 Goal

建立一條 candidate-safe voice-to-report contract：

```text
internal question decision
  -> candidate-safe spoken question
  -> deterministic clarification classification
  -> same-root non-score control path
  -> accepted-answer-only report dataset
  -> candidate-safe report/export
```

本 Spec 同時修復：

- internal match-gap/rubric wording 被朗讀；
- clarification request 被當成正式答案；
- live interviewer 未解釋便跳到下一題；
- clarification 污染 interview score 和 turn breakdown；
- candidate report 混入 developer/operations data；
- candidate export 暴露不必要 PII；
- mock report 顯示無上下文且不可操作的 real-interview reflection form。

### 1.2 Users

- Primary：Voice interview candidate。
- Secondary：Local/development developer，且只能查看自己擁有的 session diagnostics。
- Explicitly excluded：production developer/admin workflow；本 repo 尚無核准的 production diagnostics RBAC。

### 1.3 Risk class

High。錯誤可能：

- 將使用者求助當成低品質答案；
- 改變題數、coverage、next-question selection 和 score；
- 把 internal hiring-risk wording或私人 CV 資料曝光給 candidate；
- 增加 voice hot-path latency；
- 讓 candidate 誤以為 report 已通過完整驗證。

### 1.4 Authority and conflict rules

1. `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` 的 turn counting、same-root、confidence 和 latency contract 優先。
2. Privacy、ownership、candidate-safe publication boundary 優先於 diagnostics convenience。
3. Current domain controller/state machine 保持 authority；不得建立第二套 orchestrator。
4. Deterministic classifier 決定 scoring eligibility；LLM 只可 naturalize spoken wording。
5. 若本 Spec 與 current source 不一致，source 是 current fact，本 Spec 是 approved target；implementation 必須顯式完成 target delta。
6. Text interview 不得因共用 service refactor 被順帶修改。

## 2. Current Baseline and Target Delta

| Area | Current verified baseline | Approved target |
| --- | --- | --- |
| Match-gap question | `questionPoolComposerService` 可生成 `I want to validate one possible gap around ${topic}`。 | Internal rationale 和 spoken question 分離；candidate 只聽自然短問題。 |
| Gap topic | `gap.summary` 可成為 `topic` fallback。 | Raw gap summary 永不直接插入 spoken question。 |
| Micro-planning guard | 已攔截部分 rubric wording，未攔截這次實際 preamble。 | 所有已知 internal rationale families 都有 deterministic validation/fallback。 |
| Scope detector | Pattern coverage 有限；實際 `Can you clarify ... what are you asking?` 未命中。 | Intent-family classifier 覆蓋自然/ASR 變體並有 measurable gates。 |
| Voice persistence | 未命中 scope request 時預設 `user_answer`，並可能保存正式 answer。 | Classification 在 answer persistence/evaluator 前；clarification 走獨立 non-answer path。 |
| Report dataset | 可排除正確 metadata，不能可靠辨識已錯標 legacy turn。 | New turns 以 contract 排除；legacy 高風險 case 顯示 warning/needs-review，不靜默信任。 |
| Report UI | Candidate、QA、cost/token、evidence diagnostics、reflection、print tree 混合。 | Candidate allowlist view 和 non-production diagnostics view 分離。 |
| Diagnostics auth | Non-production only、authenticated、owner-scoped。 | 保留 current boundary並加入 local UI toggle；不開 production RBAC。 |
| Exports | Candidate projection 已有部分 sanitizer，但實際 PDF 仍可出現重複/internal/PII content。 | HTML/JSON/TXT/PDF 共用 server-owned allowlist/redaction contract。 |

## 3. Scope

### 3.1 In scope

- Voice-only spoken-question composition、validation 和 fallback。
- Voice-only clarification intent classification。
- Same-root、non-countable、non-score voice control path。
- Answer persistence、question counting、coverage、report eligibility consistency。
- Legacy report warning/regenerate boundary。
- Candidate report information architecture and candidate-safe projection。
- Non-production owner-scoped developer diagnostics toggle。
- Candidate HTML/JSON/TXT/PDF PII and internal metadata redaction。
- Mock report reflection removal；explicit real-interview reflection entry boundary。
- Local shadow/development enforcement、tests、human voice review and rollback evidence。

### 3.2 Non-goals

- Text interview behavior、routes、UI、tests、defaults 或 text fallback。
- New LLM intent classifier、new provider 或 dependency。
- Production diagnostics、developer/admin RBAC。
- Historical report bulk migration。
- CV-JD scoring formula changes。
- Reflection/memory scoring authority。
- Production deployment or enforcement promotion。

## 4. Functional Requirements

### 4.1 Candidate-safe spoken questions

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| VCRI-Q-001 | Internal selection rationale and candidate wording must be separate fields/responsibilities. | `gap.summary`、ranking reason、risk、coverage 和 missing-evidence text never appear in `finalSpokenQuestion`. |
| VCRI-Q-002 | Match-gap composer must produce a candidate-safe fallback question. | No `I want to validate one possible gap around...` output. |
| VCRI-Q-003 | Candidate-safe topic must be bounded and human-readable. | A full JD sentence or gap paragraph cannot be used as the spoken topic. |
| VCRI-Q-004 | Spoken-question validation must detect assessor/rubric preambles. | Known internal phrase families are rewritten before TTS and transcript persistence. |
| VCRI-Q-005 | Model failure must not bypass wording policy. | Invalid JSON、timeout、empty output and guard failure all use a deterministic safe fallback. |
| VCRI-Q-006 | Questions should be concise and singular. | Exactly one primary question; target 25–30 English words unless a reviewed fixture proves more is necessary. |
| VCRI-Q-007 | Assessment intent must remain traceable internally. | Developer diagnostics retain reason and gap refs without sending them to candidate payloads. |
| VCRI-Q-008 | Candidate transcript/report must store the safe spoken question. | Turn-by-turn report does not reconstruct a question from raw internal metadata. |

Internal assessor/rubric phrase families include, but are not limited to:

- `I want to validate ...`
- `one possible gap ...`
- `limited direct evidence ...`
- `missing evidence for ...`
- `meeting the requirement ...`
- `your match gap ...`
- `the system identified ...`
- `the role evidence suggests ...`
- rank、coverage、risk、score 或 internal label phrasing。

The implementation may extend these families through reviewed data tables. It must not rely on a growing inline conditional embedded inside orchestration code.

### 4.2 Deterministic clarification intent classification

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| VCRI-C-001 | Normalize natural speech before classification. | Case、punctuation、repeated tokens、common filler and bounded ASR artifacts do not prevent matching. |
| VCRI-C-002 | Classify by intent families rather than an exhaustive sentence list. | Paraphrases map to stable intent codes. |
| VCRI-C-003 | Classification must use active-question context. | A clarification decision references the active root question or safely rejects when no root exists. |
| VCRI-C-004 | Classification must complete before formal answer persistence and evaluation. | No post-hoc delete is required for a correctly classified new turn. |
| VCRI-C-005 | `clarification` and `uncertain_help_request` are non-answer decisions. | Both avoid scoring and question advancement; uncertain requests receive safe repair wording. |
| VCRI-C-006 | A substantive assumption-framed answer remains an answer. | `I'll assume ...` plus meaningful answer content is not incorrectly swallowed as clarification. |
| VCRI-C-007 | A substantive answer followed by a small question is not automatically discarded. | Mixed turns follow a reviewed mixed-intent policy; no blanket question-mark rule. |
| VCRI-C-008 | No live classifier LLM call is allowed. | Deterministic logic remains mock-safe and bounded. |

Required intent codes:

```yaml
clarification_intent:
  - did_not_understand
  - request_repeat
  - request_slower_delivery
  - request_shorter_question
  - request_rephrase
  - ask_question_meaning
  - ask_focus_or_scope
  - ask_example_type
  - ask_timeframe
  - confirm_candidate_understanding
  - question_too_long
  - question_too_complex
  - question_too_ambiguous
  - uncertain_help_request
```

### 4.3 Clarification response and state behavior

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| VCRI-S-001 | Clarification request and response are non-countable. | Both set `countsAsQuestion=false` and `countsAsAnswer=false`. |
| VCRI-S-002 | Clarification stays on the same root. | `rootQuestionId` does not change and no new coverage event is created. |
| VCRI-S-003 | First clarification responds to the actual difficulty. | Repeat、shorten、rephrase、scope and example requests do not all receive the same canned response. |
| VCRI-S-004 | Prepared context remains bounded. | Response uses approved question intent/context and does not invent employer facts or answer hints. |
| VCRI-S-005 | Repeated misunderstanding cannot loop indefinitely. | First help -> second bounded scaffold -> candidate may skip without a zero-score answer. |
| VCRI-S-006 | Clarification does not call evaluator or next-question selector. | The normal accepted-answer pipeline resumes only after a later accepted answer. |
| VCRI-S-007 | Duplicate/reconnect must not double-save clarification. | Existing client-turn/idempotency boundary remains effective. |
| VCRI-S-008 | Clarification preserves voice latency observability. | Response first-audio milestones are recorded and evaluated against the existing 3-second target. |

### 4.4 Report answer eligibility and legacy behavior

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| VCRI-R-001 | New report scoring consumes accepted answers only. | Clarification、repair、repeat、confirmation、skip and system turns never create score rows. |
| VCRI-R-002 | Eligibility must be contract-driven. | Explicit metadata is authoritative for new turns; report does not infer acceptance from role/text alone. |
| VCRI-R-003 | Legacy suspicious turns fail safely. | High-confidence clarification-like legacy turn causes warning/needs-review or exclusion with visible legacy limitation; it is not silently treated as trustworthy. |
| VCRI-R-004 | Legacy handling must not rewrite raw transcript. | Original question and user turn remain inspectable by the owner. |
| VCRI-R-005 | Historical bulk migration is forbidden. | Existing reports are handled at read/projection time or by explicit regenerate action. |
| VCRI-R-006 | Score derivatives must use the same accepted-answer set. | Interview average、answered count、generic count、evidence metrics and turn breakdown cannot use divergent datasets. |

### 4.5 Candidate report information architecture

Candidate default view allowlist:

```yaml
candidate_report_sections:
  - trust_status
  - overall_score
  - cv_jd_score
  - interview_score
  - concise_scoring_explanation
  - top_three_improvement_priorities
  - accepted_turn_feedback
  - actionable_answer_rewrites
  - material_transcript_risk
```

Candidate default view denylist:

```yaml
candidate_report_excluded:
  - qa_rewrite_prompt
  - developer_recheck_controls
  - commercial_stress_test
  - provider_cost
  - token_usage
  - raw_evidence_dump
  - internal_evidence_labels
  - rank_and_coverage_trace
  - internal_reason_codes
  - repeated_section_breakdown
  - empty_detailed_metrics
  - mock_report_real_interview_reflection_form
```

Requirements:

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| VCRI-UI-001 | Candidate report prioritizes action over diagnostics. | No more than three top improvement priorities appear before turn detail. |
| VCRI-UI-002 | Duplicate coaching sections must be consolidated. | The same advice is not repeated across several peer sections. |
| VCRI-UI-003 | Trust status remains candidate-readable. | Draft/needs-review state stays visible without raw QA flags. |
| VCRI-UI-004 | Candidate print tree contains only candidate content. | Buttons、forms、developer controls and non-print interactions are absent from PDF. |
| VCRI-UI-005 | Reflection is not unconditional report content. | Mock report contains no real-interview reflection form. |
| VCRI-UI-006 | Explicit real-interview reflection remains private and non-scoring. | Entry is candidate-initiated outside the mock report; no score mutation or unsupported transfer claim. |

### 4.6 Developer diagnostics

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| VCRI-D-001 | Toggle is non-production only. | Production bundle/UI does not render the control; backend still returns forbidden. |
| VCRI-D-002 | Diagnostics are authenticated and owner-scoped. | A user cannot load another user's session diagnostics. |
| VCRI-D-003 | Candidate endpoint does not carry hidden developer fields. | Developer data is fetched from a separate authorized diagnostics surface. |
| VCRI-D-004 | Diagnostics retain useful internal evidence. | Selection reason、gap refs、classifier reason、turn eligibility、QA、cost/token and trace may be displayed locally. |
| VCRI-D-005 | PII remains masked by default. | Diagnostics access is not a blanket permission to expose email、phone 或 street address. |
| VCRI-D-006 | Access is auditable. | Existing diagnostics access logging is preserved or extended without logging candidate content. |

## 5. Security, Privacy, Ownership and Lifecycle

1. Every report and diagnostics request must resolve the authenticated user and owned session.
2. Candidate projection uses an allowlist; adding a new report field does not make it candidate-visible by default.
3. PII redaction applies to HTML、JSON、TXT and PDF:
   - email；
   - telephone/mobile；
   - unnecessary postal/contact fields；
   - internal database IDs where no candidate action needs them。
4. Frontend-only hiding is insufficient. Server response/export projection owns the boundary.
5. Diagnostics remain unavailable in production until a separately approved RBAC design exists.
6. No new retention or deletion semantics are authorized.
7. Reflection remains session-private and `canAffectScoring=false`.
8. Raw transcript is not rewritten by legacy repair or candidate report projection.
9. Logs and traces store stable reason codes and refs; they must not log full candidate answer、CV、JD、email、phone or prepared private clarification text.
10. Candidate report generation must fail closed or return a safe unavailable state if candidate-safe projection cannot be produced.

## 6. Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Latency | No new LLM、embedding、network fetch or unbounded retrieval in clarification classification; existing `speech_end -> first_audio <=3s` target remains. |
| Determinism | Classification、turn eligibility、PII redaction and candidate section allowlist are deterministic and fixture-testable. |
| Reliability | Every uncertain/error path has a stable reason code and safe candidate action. |
| Maintainability | Normalization、intent matching、response policy、persistence、report eligibility and projection are separate responsibilities. |
| Compatibility | Existing voice sessions remain readable; no historical bulk migration. Text behavior is unchanged. |
| Accessibility | Candidate view and diagnostics toggle retain keyboard, label, focus and screen-reader behavior. |
| Print quality | Candidate PDF contains no clipped controls, empty forms, internal labels or accidental PII. |
| Cost | No new paid provider call; real-provider eval requires separate approval. |
| Evidence honesty | Local mock/test pass cannot be described as live provider、human、browser or production proof. |

## 7. Architecture and Dependency Direction

### 7.1 Implemented responsibility flow

```text
question pool / selected gap
  -> candidate-safe topic and fallback wording
  -> bounded micro-planner
  -> spoken-question validator
  -> TTS / candidate transcript

final voice transcript
  -> confidence/review policy
  -> deterministic clarification intent policy
     -> clarification response policy -> same-root TTS
     -> accepted answer persistence -> evaluator -> next question

completed session
  -> shared accepted-answer dataset
  -> report generation / QA
  -> candidate-safe projection
     -> candidate HTML/JSON/TXT/PDF
  -> non-production owner-scoped diagnostics
```

### 7.2 Current source areas to refactor or extend

| Responsibility | Current source of truth / integration point |
| --- | --- |
| Match-gap fallback question | `backend/src/services/questions/questionPoolComposerService.js` |
| Question naturalization/validation | `backend/src/services/questions/interviewMicroPlanningService.js`、`questionWordingPolishService.js` |
| Voice clarification observation | `backend/src/services/voice/questionScopeClarificationService.js` |
| Clarification action/response | `backend/src/services/voice/questionScopeControllerService.js` |
| Voice persistence boundary | `backend/src/services/voice/realtimeVoiceTurnService.js`、`duplexTurnCoordinator.js` |
| Question counting | `backend/src/services/questions/questionDeduplicationService.js` and existing controller state |
| Report accepted-answer dataset | `backend/src/services/report/reportTurnDatasetService.js` |
| Candidate report sanitizer/read/export | Existing report controllers、publication summary and export helpers |
| Candidate report view | `frontend/src/pages/ReportPage.jsx`、report view model and components |
| PDF | `frontend/src/utils/reportPdf/reportPdfTemplate.js` and current browser print path |
| Diagnostics authorization | `backend/src/controllers/interviewDiagnosticsController.js` |

實際 file split 遵循既有 directory ownership，沒有建立第二套 voice controller 或 report source of truth。

### 7.3 Code-quality direction

- Phrase/intent data should be declarative and versioned, not scattered inline regex branches.
- Pure normalization/classification/projection functions should not perform persistence.
- Controllers coordinate; services own policy; repositories own storage.
- Candidate and developer view models must be separate projections.
- Shared accepted-answer dataset must feed all score derivatives.
- Additive helpers are preferred over increasing already multi-responsibility files.
- 新增 symbol/file 的存在性以 current source 與 Evidence Matrix 為準；未執行的 browser/live/human/production gate 不得標成已驗證。

## 8. Typed Contracts

### 8.1 Spoken question contract

```yaml
SpokenQuestionDecisionV1:
  schemaVersion: spoken_question_decision_v1
  sourceQuestionRef: string
  sourceType: string
  candidateSafeTopic: string|null
  assessmentIntentRef: string|null
  internalRationaleRef: string|null
  finalSpokenQuestion: string
  validation:
    oneQuestion: boolean
    candidateSafe: boolean
    internalPreambleDetected: boolean
    overlong: boolean
  fallbackUsed: boolean
  reasonCodes: [string]
```

Rules:

- Candidate payload exposes `finalSpokenQuestion` only.
- `internalRationaleRef` is developer-private and must not contain raw private payload in candidate projection.
- `candidateSafe=false` blocks TTS and selects deterministic safe fallback.

### 8.2 Clarification classification contract

```yaml
VoiceClarificationDecisionV1:
  schemaVersion: voice_clarification_decision_v1
  decision:
    enum: [accepted_answer, clarification_request, uncertain_help_request]
  intent:
    enum:
      - did_not_understand
      - request_repeat
      - request_slower_delivery
      - request_shorter_question
      - request_rephrase
      - ask_question_meaning
      - ask_focus_or_scope
      - ask_example_type
      - ask_timeframe
      - confirm_candidate_understanding
      - question_too_long
      - question_too_complex
      - question_too_ambiguous
      - uncertain_help_request
      - none
  confidenceTier:
    enum: [high, bounded, uncertain]
  rootQuestionId: string|null
  matchedReasonCodes: [string]
  countsAsQuestion: boolean
  countsAsAnswer: boolean
  shouldPersistFormalAnswer: boolean
  shouldRunEvaluator: boolean
  shouldAdvanceQuestion: boolean
  responsePolicy:
    enum: [none, repeat, shorten, rephrase, explain_intent, provide_scope, provide_example, scaffold, offer_skip]
```

Invariants:

- `clarification_request` and `uncertain_help_request` set all scoring/advance flags false.
- `accepted_answer` cannot be produced only because classification threw an error.
- Missing active root cannot create a formal answer silently.
- Reason codes are safe for logs; raw candidate text is not required in trace payload.

### 8.3 Candidate report projection contract

```yaml
CandidateReportProjectionV1:
  schemaVersion: candidate_report_projection_v1
  sessionId: string
  publicationSummary: object
  scores:
    overall: number|null
    cvJd: number|null
    interview: number|null
  scoreExplanation: object|null
  priorities:
    maxItems: 3
    items: [object]
  acceptedTurnFeedback: [object]
  answerRewrites: [object]
  transcriptRisks: [object]
  legacyLimitations: [object]
  piiRedactionApplied: boolean
```

Forbidden candidate fields include raw QA flags、repair history、model prompt、rank trace、coverage slots、cost/token detail、raw evidence dump、private IDs and contact PII.

### 8.4 Developer diagnostics view

```yaml
DeveloperReportDiagnosticsV1:
  availability: non_production_only
  ownership: authenticated_session_owner
  candidatePiiDefault: redacted
  sections:
    - question_decision
    - clarification_decision
    - turn_eligibility
    - report_qa
    - cost_and_usage
    - evidence_diagnostics
    - harness_trace
```

This contract does not authorize a production endpoint or a new role.

## 9. State Machine and Persistence

### 9.1 Voice transition

```text
waiting_for_user
  -> user_speaking
  -> stt_finalizing
  -> transcript review/confidence gate
  -> clarification classifier
       accepted_answer
         -> formal answer persistence
         -> answer_processing
         -> evaluator/ranker
         -> next_question_speaking
       clarification_request | uncertain_help_request
         -> non-answer transcript turn
         -> clarification response
         -> same root remains active
         -> waiting_for_user
```

Forbidden transition:

```text
clarification_request
  -X-> formal answer row
  -X-> evaluator
  -X-> question index increment
  -X-> new root question
  -X-> scored report row
```

### 9.2 Persistence

- Reuse existing transcript metadata and formal interview response boundary where safe.
- This Spec does not authorize a new database migration.
- Clarification request/response remains traceable in session transcript but not in formal answer storage.
- Idempotency must reuse existing `clientTurnId`/turn boundary; duplicate delivery cannot create two clarification or answer rows.
- Legacy records are not rewritten in bulk.
- Reflection persistence, if retained, uses the current session-private ownership/retention policy; implementation must verify the existing working-tree service before relying on it.

## 10. Failure, Retry, Concurrency and Rollback Behavior

| Failure | Required behavior | Block/continue |
| --- | --- | --- |
| Candidate-safe topic unavailable | Use reviewed generic safe question; never speak raw gap summary. | Continue safely. |
| Micro-planner invalid/timeout | Deterministic candidate-safe fallback. | Continue safely. |
| Spoken-question validator still fails | Do not send unsafe TTS; use minimal generic question or retry within bounded policy. | Block unsafe wording. |
| Classifier error | `uncertain_help_request`; no scoring/advance. | Same-root safe repair. |
| No active root question | Reject/recover turn; do not manufacture answer. | Block scoring. |
| Prepared clarification context unavailable | Generic bounded rephrase; no invented facts. | Same root. |
| Repeated clarification | Scaffold once, then offer skip. | No infinite loop. |
| Duplicate `clientTurnId` | Return/reuse prior outcome; no duplicate side effect. | Idempotent. |
| Report eligibility disagreement | Fail report QA or mark needs review; do not average divergent datasets. | Block trusted publication. |
| Candidate projection/redaction failure | Return safe unavailable/needs-review state; no raw fallback payload. | Fail closed. |
| Diagnostics requested in production | Return forbidden and render no toggle. | Fail closed. |
| Cross-owner diagnostics request | Return forbidden/not-found according to current ownership policy. | Fail closed. |
| PDF rendering failure | Existing retryable export error; never fall back to an unredacted template. | Fail closed for export. |

Rollback:

- Spoken-question policy can revert to previous candidate-safe generic fallback, not to raw internal rationale.
- Clarification enforcement can return to prior deterministic repair only if non-score/same-root invariants remain protected.
- Candidate view rollback must not re-expose PII or developer fields.
- Feature flags, if implementation uses them, must be server-authoritative and default to safe behavior.
- Rollback evidence must include before/after transcript, question count, accepted-answer dataset and candidate projection diff.

## 11. Retention, Deletion, Observability and Audit

### 11.1 Retention and deletion

- No retention duration changes.
- No new persistent raw payload snapshot.
- Session deletion and existing retention cleanup remain authoritative.
- No historical report bulk rewrite.
- Reflection does not gain new lifecycle authority.

### 11.2 Observability

Record bounded events/reason codes for:

- spoken question internal-preamble rewrite/fallback；
- clarification classification decision and intent；
- same-root response policy；
- formal-answer persistence skipped；
- evaluator skipped；
- report legacy limitation；
- candidate projection redaction result；
- diagnostics access。

Do not log:

- raw CV/JD；
- full candidate answer；
- email/phone/street address；
- prepared private clarification response；
- raw prompt or chain-of-thought。

### 11.3 Shadow evidence

Before development enforcement, shadow comparison should measure:

- old vs new clarification decision；
- false-positive candidate answer cases；
- missed clarification families；
- new vs old spoken question safety；
- latency delta；
- resulting accepted-answer count difference。

Shadow output cannot affect scoring or candidate response until the approved development-enforce gate.

## 12. BDD Scenarios

```gherkin
Feature: Candidate-safe voice questions and clarification integrity

  Scenario: Internal match-gap rationale is not spoken
    Given a prepared match gap whose internal summary says "Limited direct evidence for AWS"
    When the voice question is composed
    Then the final spoken question asks naturally about AWS experience and personal ownership
    And it does not contain "I want to validate", "possible gap", or "limited direct evidence"
    And the internal rationale remains available only in developer diagnostics

  Scenario: Long communication gap becomes one concise question
    Given a match gap summary contains a long JD sentence about communication across several business units
    When the question reaches the spoken-question validator
    Then the candidate hears one concise question about explaining a technical concept to a non-technical stakeholder
    And the long gap summary is not copied into the transcript

  Scenario: Model failure still produces safe wording
    Given bounded micro-planning times out or returns invalid JSON
    When the fallback question is selected
    Then the fallback is a natural candidate-facing question
    And no internal rubric or ranking language is spoken

  Scenario: Candidate asks the exact reported clarification
    Given an active voice root question
    When the candidate says "Can you clarify and clearly describe what you are asking? The question was long and I could not follow."
    Then the decision is clarification_request
    And no formal answer is saved
    And no evaluator runs
    And the question index does not advance
    And the same root question remains active

  Scenario: Candidate asks for a shorter question without punctuation
    Given an active voice root question
    When ASR returns "sorry too long can you make the question shorter"
    Then the intent is request_shorter_question
    And the interviewer asks one shorter version
    And the turn is not scored

  Scenario: Candidate asks what kind of example to use
    Given an active root question with approved prepared context
    When the candidate asks whether to use a university or work example
    Then the response policy provides bounded example scope
    And it does not reveal hidden evidence or a preferred answer
    And the root question remains active

  Scenario: Substantive assumption-framed answer remains scoreable
    Given an active open-scope question
    When the candidate says "I'll assume this is an internal workflow" and gives a substantive answer
    Then the turn is an accepted answer with scopeFraming explicit_assumption
    And no synthetic clarification turn is created

  Scenario: A real answer mentioning clarification is not a false positive
    Given an active behavioural question
    When the candidate gives a substantive example about how they clarified requirements with a stakeholder
    Then the turn remains an accepted answer
    And the word "clarified" alone does not classify it as a request

  Scenario: Classifier uncertainty fails safe
    Given a short help-seeking question-like transcript cannot be classified confidently
    When the classifier returns uncertain_help_request
    Then the system asks a bounded repair question
    And does not score or advance the turn

  Scenario: Repeated misunderstanding offers skip
    Given the candidate has already received a rephrase and a bounded scaffold for the same root
    When the candidate still cannot understand the question
    Then the interviewer offers to skip
    And skip does not create a zero-score answer
    And no infinite clarification loop occurs

  Scenario: Report excludes clarification from every derived metric
    Given a session contains six accepted answers and one clarification request
    When the report dataset and metrics are built
    Then scoredAnswerCount is six
    And answered count, interview average, evidence metrics and turn breakdown all use the same six answers

  Scenario: Legacy clarification contamination is visible
    Given a legacy session stored a likely clarification as user_answer
    When the report is read
    Then the candidate sees a legacy scoring limitation or needs-review state
    And the system does not silently claim the score is fully reliable
    And the raw transcript remains unchanged

  Scenario: Candidate report excludes developer and operations data
    Given a completed voice report has QA, cost, token, evidence and trace diagnostics
    When the candidate report is loaded or exported
    Then only candidate allowlisted sections are returned
    And Commercial Stress Test, raw evidence dump and internal identifiers are absent

  Scenario: Candidate export redacts contact PII
    Given CV evidence contains an email address, telephone number, or street address
    When candidate HTML, JSON, TXT and PDF are produced
    Then the contact values are absent or masked according to one shared policy
    And no format has a weaker redaction boundary

  Scenario: Mock PDF excludes reflection form and controls
    Given the candidate prints a mock interview report
    When the printable document is generated
    Then it contains no reflection form, developer toggle, QA prompt or inactive button

  Scenario: Development owner opens diagnostics
    Given the app is non-production and the authenticated user owns the session
    When the user selects Developer Diagnostics
    Then the app loads the authorized diagnostics view
    And candidate PII remains masked by default

  Scenario: Production diagnostics remain unavailable
    Given the app runs in production
    When any user opens the candidate report or calls a diagnostics route
    Then no diagnostics toggle is rendered
    And the backend denies diagnostics access

  Scenario: Cross-owner diagnostics are denied
    Given an authenticated user does not own the requested session
    When they request report diagnostics
    Then access is denied
    And no report, trace, cost, token or evidence metadata is returned
```

## 13. Corpus and Evaluation Contract

### 13.1 Dataset partitions

```yaml
clarification_evaluation:
  reviewed_golden:
    purpose: known intent families and reported regressions
    required_result: 100_percent_pass
  unseen_paraphrase_holdout:
    purpose: phrasing generalization after rules are frozen
    minimum_recall: 0.95
  negative_answer_corpus:
    purpose: prevent valid answers from being swallowed
    maximum_false_positive_rate: 0.01
  asr_variation_set:
    purpose: missing punctuation, repetition, filler, partial grammar
  human_voice_set:
    purpose: microphone, natural cadence, accent and TTS response review
```

Rules:

- Holdout wording must not be used to tune rules before the recorded evaluation run.
- Golden pass alone cannot satisfy generalization.
- Corpus must include mixed-intent and adversarial negatives, not only obvious `can you clarify` sentences.
- No demographic or accent quality label may be used as a candidate ability judgement.
- Dataset content must not contain real secrets or unnecessary PII.

### 13.2 Spoken-question evaluation

Required fixtures:

- long communication gap from the reported transcript；
- missing AWS evidence；
- AI workflow requirement；
- credential/education rubric wording；
- behavioural stakeholder question；
- model success；
- invalid JSON；
- timeout；
- generic fallback。

Every path asserts:

- one candidate-facing question；
- no internal preamble；
- no raw gap summary；
- retained assessment intent；
- bounded length or documented fixture exception。

## 14. Verification Plan

### 14.1 Focused automated tests

Current baseline test areas to extend:

- `backend/tests/robustness/questions/questionPoolComposerService.test.js`
- `backend/tests/robustness/questions/interviewMicroPlanningService.test.js`
- `backend/tests/robustness/voice/questionScopeClarificationService.test.js`
- `backend/tests/robustness/voice/questionScopeControllerService.test.js`
- `backend/tests/robustness/voice/voiceScopeClarificationE2e2026_2.test.js`
- `backend/tests/robustness/report/reportTurnDatasetRobustness.test.js`
- `backend/tests/robustness/report/reportFrameworkQa.test.js`
- `backend/tests/robustness/report/reportQaRewriteCandidateProjection.test.js`
- `backend/tests/robustness/report/reportRoleFitExport.test.js`
- `backend/tests/robustness/server/harnessRunDiagnosticsController.test.js`
- `frontend/src/utils/__tests__/reportViewModel.test.js`
- report component and PDF/template tests under `frontend/src/components/report/__tests__` and `frontend/src/utils/__tests__`

Required new test responsibilities:

- classifier corpus/holdout runner；
- mixed-intent and negative answers；
- persistence/evaluator spy assertions；
- question index/coverage invariants；
- duplicate/reconnect behavior；
- candidate/developer view separation；
- report-page integration test；
- HTML/JSON/TXT/PDF PII parity；
- print-only content contract；
- production toggle absence。

### 14.2 Broader local gates

After focused tests:

1. Backend voice-focused suite。
2. Backend question-focused suite。
3. Backend report-focused suite。
4. Backend lint。
5. Frontend relevant Vitest tests and lint。
6. Frontend production build/quality gate when feasible。
7. Existing harness replay for `interview_next_turn` and report publication。

No real AI/provider eval runs without explicit cost/credential approval.

### 14.3 Browser and visual verification

- Voice flow with natural clarification phrases。
- Same-root UI and replay/skip controls。
- Candidate report desktop and mobile reading order。
- Developer toggle local-only behavior。
- Candidate PDF page count、section transitions、no forms/controls、no clipped text。
- Search rendered/exported output for email、phone、internal IDs and forbidden phrases。

### 14.4 Human voice gate

A human reviewer must:

- speak at least one phrase from each clarification family；
- include natural pauses、grammar errors and no punctuation ASR output；
- listen to first and repeated clarification responses；
- confirm responses are helpful and not canned；
- confirm no answer hint or internal rationale is spoken；
- inspect first-audio latency evidence；
- review the final candidate report and PDF。

### 14.5 Production boundary

This Spec does not authorize production rollout. Production readiness requires a separate decision after:

- local automated gates；
- browser visual checks；
- human microphone/listening gate；
- live-provider latency evidence if production uses live providers；
- candidate report Product Owner review；
- privacy/export review；
- rollback rehearsal。

## 15. Acceptance Criteria

The implementation is locally ready for owner review only when:

1. All VCRI-Q/C/S/R/UI/D requirements are implemented and traced to tests.
2. Reported communication and AWS regressions pass.
3. Golden corpus is 100%。
4. Unseen holdout recall >=95%。
5. Negative false-positive <=1%。
6. Every clarification fixture produces zero formal answers、zero evaluator calls、zero score rows and zero question advancement.
7. Spoken-question success/failure paths contain no internal rationale.
8. Candidate report/export contains no forbidden developer/operations sections.
9. PII parity passes for HTML、JSON、TXT、PDF.
10. Production diagnostics remains forbidden.
11. Text interview behavior and focused tests show no intentional change.
12. Voice latency evidence is reported honestly; any `>3s` case blocks release claim.
13. Dirty-tree reconciliation and user-change preservation are documented.
14. Feature RFC and repo-docs synchronization is complete after runtime behavior changes.

## 16. Rollout Plan

### Phase 0: Documentation and baseline

- Approve Goal/Spec。
- Freeze reported transcript regressions。
- Record current classifier、spoken question、score and report output。

### Phase 1: Pure deterministic policies and tests

- Implement/refactor pure candidate-safe wording、classification and projection helpers。
- Run corpus/holdout/negative tests。
- No candidate-visible enforcement claim。

### Phase 2: Shadow comparison

- Compare old/new spoken-question and clarification decisions。
- Record false positives、missed clarifications、accepted-answer count and latency delta。
- No scoring or candidate response mutation from shadow result。

### Phase 3: Development enforcement

- Enforce candidate-safe spoken questions。
- Enforce clarification before answer persistence/evaluator。
- Enable candidate report projection and local diagnostics toggle。
- Run integration/browser/PDF gates。

### Phase 4: Human validation

- Human microphone/listening test。
- Product Owner report review。
- Privacy/export review。
- Rollback rehearsal。

### Phase 5: Separate production decision

- Decide whether evidence permits production rollout。
- Keep diagnostics production-disabled。
- Do not promote on local tests alone。

## 17. Compatibility and Migration

- Text mode remains unchanged and supported by current code.
- Existing voice session records remain readable.
- No database migration is approved by this Spec.
- New metadata, if needed, must be additive/versioned and confirmed during implementation discovery.
- Legacy reports remain immutable; warning/read projection and explicit regenerate are the supported paths.
- Candidate-safe redaction applies at read/export time to old and new reports where current data permits.
- If implementation discovery proves a migration is required, stop and obtain owner approval before drafting or executing it.

## 18. Approved Assumptions, Open Decisions and Stop Conditions

### Approved

- Voice only。
- Deterministic classifier。
- No live classifier LLM call。
- Candidate-safe natural responses by intent/context。
- Candidate/developer report separation。
- Local/development diagnostics only。
- Reflection removed from mock report。
- PII redaction across all candidate formats。
- No historical bulk migration。
- Internal rationale removed from spoken questions。

### Open decisions

沒有產品決策阻擋 local implementation。Production rollout、production diagnostics RBAC、真人 voice/browser 與 live-provider gate 仍需分開決定。

### Stop conditions

- Any request to modify text mode。
- Any proposal for production diagnostics/RBAC。
- Any schema migration、retention/deletion change or bulk rewrite。
- Any added provider/dependency or paid real-AI eval without approval。
- Any candidate visibility policy outside the approved allowlist。
- Any implementation that overwrites existing uncommitted user changes。
- Corpus、false-positive、PII、question-count、ownership or latency gate failure。

## 19. Human Review and Approval

- Blueprint Revision 2：Owner approved on 2026-07-30 by requesting Goal/Spec creation。
- Goal/Spec status：Owner-approved，並已同步 current implementation。
- Runtime implementation status：Implemented locally after the owner's explicit 2026-07-30 instruction。
- Local validation status：Focused、full package quality、integration、lint、build 與 docs validation results 記錄於 Evidence Matrix。
- Browser/live voice/human/production status：Not run。

Local automated pass 不等於 browser verified、live provider verified、human approved 或 production ready。

## 20. 2026-07-30 Implementation Record

| Contract area | Current implementation |
| --- | --- |
| Candidate-safe spoken question | `questionPoolComposerService.js` 直接產生 candidate-safe gap question；`interviewMicroPlanningService.js` 在 model success 與 fallback 都攔截 assessor/rubric preamble，raw gap 只留在 private metadata。 |
| Deterministic clarification | `questionScopeClarificationService.js` 以 intent families 分類 required intent codes，並保留 substantive/mixed-answer negative guard；runtime 以已持久化 latest question 補足 transcript context，兩者皆無 active root 時任何 accepted voice speech 都 fail closed；不新增 LLM/network call。 |
| Same-root non-score | `questionScopeControllerService.js` 與 `realtimeVoiceTurnService.js` 在正式 answer persistence/evaluator 前處理 clarification，保存 `clarificationIntent`、`countsAsAnswer=false`，不前進題號。兩次 bounded help 後可接受 non-scoring skip；下一個 fresh root 會再次通過共用 spoken-question safety guard 才朗讀與保存。 |
| Shared candidate report | `buildCandidateReportProjection` 是 candidate API、QA rewrite、JSON/TXT export 的 server-owned allowlist；Role-Fit/unavailable noise 不發布；`ReportPage` 與 PDF template 使用精簡 candidate reading order並保留 legacy/transcript risk。這個 report boundary 同時適用 Voice 與 Text session；Text turn runtime 未修改。 |
| Diagnostics | `GET /api/report/:sessionId/diagnostics` 是分離的 authenticated、owner-scoped、non-production surface，包含 selection/match-gap refs、turn eligibility、QA/cost 與 harness timelines；frontend 只在 non-production 顯示 lazy-load toggle。 |
| Legacy and privacy | Read/export 時偵測 legacy clarification contamination 並顯示 regenerate limitation；projection/export 對 nested email、phone、street address 做 redaction，不改寫 raw transcript。 |
| Reflection | Optional real-interview reflection form 已從 shared candidate report 移除；既有 session-private persistence 不會進 candidate report 或 scoring。 |

本實作沒有新增 dependency、schema migration、paid provider call、production deployment 或 git push。
