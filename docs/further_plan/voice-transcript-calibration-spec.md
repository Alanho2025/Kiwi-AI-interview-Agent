# Voice Transcript Calibration Spec

狀態：goal mode SDD spec；first deterministic implementation slice completed locally
日期：2026-07-13 Pacific/Auckland
Goal：[Voice Transcript Calibration Goal](voice-transcript-calibration-goal.md)
主要 guardrails：[Stakeholder Feature Conflict Guardrails](../stakeholder-feature-conflict-guardrails.md)

## Overview

### Goal

在 Kiwi AI Interview Agent 的 voice interview flow 中，新增一套 guardrail-first transcript calibration contract。它要提高 role-specific terms、CV/JD terms、technical acronyms、proper nouns 的 STT 可靠度，同時防止過度校準、答案美化、latency regression 和 privacy regression。

### Users

- Candidate：需要不因 STT 誤聽而被錯誤扣分。
- Product reviewer：需要知道 calibration 不會把 candidate 包裝成更好的答案。
- Engineering reviewer：需要明確的 data contract、latency boundary、test gates。
- Future coding agent：需要可直接拆成 SDD slices 的 contract。

### Risk Class

高。此 feature 會影響 transcript truth、answer scoring、question selection、report evidence、voice latency、CV/JD privacy。

### Non-Goals

- 不做大型 profession glossary。
- 不做 open-ended transcript rewriting。
- 不在 `speech_end -> next audio` hot path 內跑 heavy LLM/extraction。
- 不把 CV/JD context 轉成 spoken evidence。
- 不新增 dependency、provider、real-AI eval 或 paid service，除非另行批准。
- 不把 offline transcript cleanup 靜默覆蓋 live accepted transcript。

### Current Implementation Slice

2026-07-13 的 goal mode first slice 已落地在 backend voice path：

| Area | Implemented behavior | Source |
| --- | --- | --- |
| Contextual glossary | 從 existing session analysis、parsed CV profile、parsed JD rubric、interview plan 和 global fallback 產生 source-aware glossary；phrase hints 仍維持 120 cap | `backend/src/services/voice/speechPhraseHintService.js` |
| Conservative calibration | 保留 raw transcript；只在 provider N-best candidate confidence delta <= 0.15、文字相似且包含 glossary term 時 rerank | `backend/src/services/voice/transcriptCalibrationService.js` |
| Static normalization | 現有 safe replacements 仍可套用，但會以 `static_normalization` metadata 保留 raw/corrected boundary | `backend/src/services/voice/transcriptNormalizer.js`, `backend/src/services/voice/transcriptCalibrationService.js` |
| Provider wiring | Azure realtime STT、ElevenLabs realtime STT、test realtime STT 都輸出 `transcriptCalibration` 和 bounded `nbest` metadata | `backend/src/services/voice/realtimeSpeechSessionService.js`, `backend/src/services/voice/elevenLabsRealtimeSpeechSessionService.js`, `backend/src/services/voice/testRealtimeSpeechSessionService.js` |
| Accepted turn provenance | Duplex aggregation 和 realtime turn persistence 保存 calibration metadata；CV/JD context 不會變成 spoken evidence | `backend/src/services/voice/duplexVoiceAgentService.js`, `backend/src/services/voice/realtimeVoiceTurnService.js` |
| Guardrail tests | CV/JD 不補答案、N-best bounded rerank、provider 無 N-best fallback、static normalization 不覆蓋 raw transcript | `backend/tests/robustness/voice/voiceTranscriptCalibrationService.test.js`, `backend/tests/robustness/voice/realtimeVoiceTurnMocked.test.js` |

This slice intentionally excludes frontend review UI, live provider production verification, LLM cleanup, offline transcript replacement, persistence schema migration, and real-AI eval gates.

## Guardrail Gate

任何 implementation plan 必須先通過這個 gate。

| Guardrail | Required result |
| --- | --- |
| Transcript truth | 保存 raw transcript；corrected transcript 不可覆蓋 raw evidence |
| Answer quality boundary | Correction 只能修 STT 誤聽，不可補 result、metric、structure、reflection、ownership |
| CV/JD boundary | CV/JD 可作 vocabulary context，不可作 candidate spoken answer |
| Low confidence behavior | Contentful low-confidence transcript 必須進 confirmation，不可直接評分或丟棄 |
| Turn counting | Repair / confirmation / clarification 不算 interview question |
| Latency | No heavy work after `speech_end_received` unless bounded and measured |
| Provenance | 每個 meaningful correction 要有 source、reason、confidence、decision type |
| Privacy | Raw CV/JD 最小化使用；不可進 unnecessary client/log/prompt/analytics path |

## Current-State Contract

### Existing Data Sources

```yaml
cv_sources:
  raw_text:
    owner: "DocumentContent.rawText"
    current_use: "CV upload extraction and analysis"
    allowed_for_calibration: "setup-time candidate term extraction only"
    not_allowed: "auto-filling spoken answer"
  normalized_text:
    owner: "DocumentContent.normalizedText"
    current_use: "analysis fallback"
    allowed_for_calibration: "setup-time extraction fallback"
  cv_profile:
    owner: "DocumentContent.cvProfile / SessionAnalysis.parsedCvProfile"
    current_use: "match, plan, speech phrase hints"
    allowed_for_calibration: "primary first-slice glossary source"

jd_sources:
  raw_jd:
    owner: "job_description_inputs.raw_text / AnalyzePage.rawJD"
    current_use: "JD summarization, match, session setup restore"
    allowed_for_calibration: "setup-time candidate term extraction"
    not_allowed: "spoken answer evidence"
  structured_jd:
    owner: "SessionAnalysis.jdStructuredText"
    current_use: "session analysis and restore"
    allowed_for_calibration: "role/topic term extraction"
  jd_rubric:
    owner: "SessionAnalysis.jdRubric / parsedJdProfile"
    current_use: "match, plan, speech phrase hints"
    allowed_for_calibration: "primary first-slice glossary source"

voice_sources:
  active_question:
    owner: "current interview turn / interview plan"
    allowed_for_calibration: "question-scoped glossary selection"
  interview_plan:
    owner: "InterviewPlan.questionPool and plan metadata"
    allowed_for_calibration: "session and question scoped hints"
  existing_phrase_hints:
    owner: "speechPhraseHintService"
    current_limit: 120
    allowed_for_calibration: "baseline behavior to preserve and refine"
  stt_nbest:
    owner: "Azure detailed recognition result when available"
    current_use: "NBest[0] confidence only"
    allowed_for_calibration: "bounded rerank candidates, not free generation"
  confirmed_corrections:
    owner: "future transcript calibration metadata"
    allowed_for_calibration: "same-session term memory only"
```

### Existing Product Constraints

```yaml
voice_product_contract:
  latency_target: "user speech end -> next question first audio <= 3 seconds"
  low_confidence_is: "system understanding quality"
  low_confidence_is_not: "answer quality"
  contentful_low_confidence: "confirmation required before scoring"
  non_counting_turns:
    - repair_prompt
    - transcript_confirmation
    - transcript_clarification
    - repeat_request
    - system_status
    - barge_in_acknowledgement
```

## Proposed Data Models

### ContextualGlossaryItem

```yaml
ContextualGlossaryItem:
  term: string
  normalizedTerm: string
  source:
    enum:
      - current_question
      - interview_plan
      - jd_rubric
      - jd_raw_text
      - cv_profile
      - cv_raw_text
      - confirmed_correction
      - global_fallback
  sourceRef:
    type: object
    fields:
      documentId: string_optional
      sessionId: string_optional
      questionId: string_optional
      fieldPath: string_optional
      sourceSnippetHash: string_optional
  scope:
    enum: [session, question, correction_memory, global_fallback]
  priority:
    enum: [high, medium, low]
  reason:
    enum:
      - proper_noun
      - technical_acronym
      - tool_or_framework
      - certification
      - company_or_product_name
      - domain_term
      - question_target_skill
      - user_confirmed
  safeForPhraseHint: boolean
  safeForAutoCorrection: boolean
  safeForReportCitation: boolean
  createdAt: iso_datetime
```

### TranscriptCalibrationDecision

```yaml
TranscriptCalibrationDecision:
  rawTranscript: string
  normalizedTranscript: string
  calibratedTranscript: string
  decisionType:
    enum:
      - no_change
      - static_normalization
      - nbest_rerank
      - conservative_term_correction
      - needs_user_confirmation
      - rejected_uncertain
  corrections:
    - rawSpan: string
      correctedSpan: string
      glossaryTerm: string_optional
      source: string
      reason: string
      confidence: number
      scoringImpacting: boolean
      userConfirmed: boolean
  confidence:
    stt: number_optional
    calibration: number_optional
  nbest:
    retained: boolean
    candidateCount: number
    selectedIndex: number_optional
  latency:
    extractionMs: number
    rerankMs: number
    correctionMs: number
    totalCalibrationMs: number
  guardrail:
    answerQualityChanged: false
    usedCvJdAsSpokenEvidence: false
```

## Functional Requirements

1. Calibration must always preserve raw transcript.
2. First implementation slice must reuse existing CV/JD/profile/plan data; no new external dependency.
3. Glossary generation must be dynamic and session/question scoped.
4. Phrase hints must stay bounded; current 120 phrase cap is the baseline unless changed by explicit spec update.
5. CV/JD raw text may be used at setup-time or warmup-time for candidate term extraction, not during post-speech hot path.
6. Active question and interview plan must influence which terms are highest priority for the current turn.
7. N-best rerank may select a non-top candidate only when:
   - the candidate contains a high-priority glossary term,
   - confidence delta is within a configured small bound,
   - the change is term-level, not answer-level,
   - provenance is saved.
8. Ambiguous or scoring-impacting uncertainty must ask for confirmation instead of auto-correcting.
9. Low-confidence contentful answers remain governed by the existing confidence gate.
10. Reports and scoring must distinguish spoken evidence from CV/JD context and correction metadata.

## Non-Functional Requirements

1. Live calibration must not introduce unbounded network or LLM calls into the voice hot path.
2. Any added computation after `speech_end_received` must be timed and included in latency traces.
3. Fallback must preserve existing behavior if glossary, N-best, or correction metadata is unavailable.
4. Correction rules must be deterministic-first; LLM correction, if ever added, must be exception-only and separately approved.
5. All new artifacts must be bounded and avoid raw CV/JD dumps.
6. Implementation must be testable with synthetic CV/JD/transcript data.

## Security and Privacy Requirements

1. Do not log raw CV/JD or full real transcripts in calibration diagnostics.
2. Do not expose raw extracted CV text to frontend unless the existing user review path already requires it.
3. Store only source references, hashes, snippets, or field paths where possible.
4. Use synthetic or anonymized cases for tests and evals.
5. Do not claim compliance or deletion guarantees beyond enforced backend behavior.

## Live Flow Contract

```text
Before interview / session setup
  -> extract bounded candidate terms from reviewed CV/JD/profile/rubric
  -> build session glossary with provenance

Before or during STT session start
  -> select question/session scoped phrase hints
  -> send bounded phrase list to speech provider

During speech recognition
  -> receive raw transcript and detailed result if available
  -> keep N-best metadata bounded

After STT final
  -> run static normalization
  -> run bounded N-best rerank only if available and cheap
  -> if uncertainty is scoring-impacting, ask confirmation
  -> if accepted, save raw + calibrated transcript metadata
  -> score only accepted candidate answer
```

## BDD Scenarios

### Scenario: CV/JD glossary is built before voice hot path

```gherkin
Scenario: Build contextual glossary from reviewed CV and JD
  Given a session has a reviewed CV profile
  And a reviewed JD rubric
  And an interview plan with target question topics
  When the voice session prepares STT phrase hints
  Then the glossary includes relevant tools, acronyms, project names, role terms, and company terms
  And each term records source, scope, priority, reason, and safe-use flags
  And no raw CV or full raw JD is copied into the phrase hint payload
```

### Scenario: CV/JD terms do not become spoken evidence

```gherkin
Scenario: Candidate did not say a CV fact
  Given the CV says the candidate used PostgreSQL
  And the JD asks for database design
  When the candidate answer transcript only says "I worked on the database"
  Then calibration must not rewrite it as "I designed PostgreSQL schemas"
  And scoring must not treat PostgreSQL as spoken evidence
  And the report may mention PostgreSQL only as CV/JD context, not as an interview answer claim
```

### Scenario: N-best rerank corrects a bounded technical term

```gherkin
Scenario: Correct term appears in a near-confidence N-best candidate
  Given the high-priority glossary contains "PostgreSQL"
  And NBest[0] says "post gray SQL" with confidence 0.72
  And NBest[1] says "PostgreSQL" with confidence 0.68
  When the confidence delta is within the configured rerank bound
  Then the selected transcript may use "PostgreSQL"
  And the decision type is "nbest_rerank"
  And the correction records source, reason, confidence delta, and glossary match
```

### Scenario: Ambiguous correction requires confirmation

```gherkin
Scenario: Correction would change answer meaning
  Given the transcript contains a phrase that could map to multiple glossary terms
  Or the correction would add a tool, metric, ownership claim, or result
  When calibration cannot prove it is a term-level STT error
  Then the system must not auto-correct
  And if the answer is contentful and scoring-impacting, it asks the candidate to confirm understanding
```

### Scenario: Low-confidence contentful answer is not scored directly

```gherkin
Scenario: Contentful low-confidence transcript
  Given the user speaks for a meaningful answer length
  And STT confidence is low
  When the final transcript arrives
  Then the system stores it as pending confirmation
  And does not score it
  And does not ask the next interview question
  And does not increment question count
```

### Scenario: Latency hot path rejects heavy extraction

```gherkin
Scenario: Speech end has already been received
  Given the user has stopped speaking
  When transcript finalization starts
  Then the system must not perform full CV/JD extraction
  And must not call an unrestricted LLM correction prompt
  And any bounded rerank/correction time is recorded in latency metadata
```

### Scenario: Provider result lacks N-best metadata

```gherkin
Scenario: STT provider returns only a top transcript
  Given the provider does not return N-best alternatives
  When final STT arrives
  Then calibration falls back to static normalization and confidence gate
  And no error blocks the interview flow
  And the artifact records nbest.retained false
```

## Acceptance Criteria by Phase

| Phase | Acceptance criteria |
| --- | --- |
| VTC-S0 Guardrails | Goal/spec accepted; guardrail checklist exists; unsafe old plan assumptions are narrowed |
| VTC-S1 Source contract | Tests prove CV/JD/profile/plan terms can be selected without raw data leakage |
| VTC-S2 Glossary builder | Deterministic glossary items include source, priority, safe-use flags, and bounded phrase list output |
| VTC-S3 N-best rerank | Rerank only changes term-level ASR errors within confidence delta; ambiguous changes fall back to confirmation |
| VTC-S4 Provenance | Transcript saves raw, normalized, calibrated text and correction metadata without treating CV/JD as spoken evidence |
| VTC-S5 Voice behavior | Low-confidence contentful answers still require confirmation; repair turns do not count as questions |
| VTC-S6 Latency | Hot-path calibration time is traced; no unbounded work after speech end |
| VTC-S7 Release gate | Synthetic/adversarial evals include accent, acronyms, CV/JD terms, ambiguous corrections, and privacy cases |

## Implementation Mapping

| Phase | Current status |
| --- | --- |
| VTC-S0 Guardrails | Implemented in goal/spec and encoded in robustness tests |
| VTC-S1 Source contract | Implemented for existing parsed CV/JD/profile/plan sources; raw CV/JD extraction remains setup-time/future only |
| VTC-S2 Glossary builder | Implemented as source-aware in-memory glossary and bounded phrase-list output |
| VTC-S3 N-best rerank | Implemented for bounded provider N-best rerank; ambiguous confirmation UX remains governed by existing confidence gate |
| VTC-S4 Provenance | Implemented in provider payload, duplex aggregation, and accepted turn metadata |
| VTC-S5 Voice behavior | Preserved by existing confidence gate tests and full `test:voice` suite |
| VTC-S6 Latency | Preserved as dependency-free local computation; live provider latency artifact still needs approved live run |
| VTC-S7 Release gate | Not implemented in this slice; synthetic/adversarial dataset expansion remains a follow-up |

## Verification Gates

### Unit / Service Tests

- `speechPhraseHintService` keeps phrase list bounded and source-derived.
- Glossary extraction filters generic words and preserves source metadata.
- N-best rerank refuses confidence gaps outside threshold.
- Correction decision refuses answer-quality improvements.
- CV/JD context never appears as `spoken_evidence` unless present in transcript.

### Backend Robustness Tests

- Low-confidence contentful transcript goes to confirmation.
- Confirmation / repair turns do not increment question count.
- Provider without N-best falls back safely.
- Calibration metadata remains bounded and redacted.

### Browser / Voice E2E

- Test STT transcript with low confidence shows confirmation UI.
- Technical acronym/proper noun correction does not skip confirmation when uncertain.
- Voice flow still emits latency artifact with `speech_end_received`, `stt_final_ready`, `confidence_gate_done`, `first_sentence_ready`, `tts_first_audio`.

### Eval / Adversarial Cases

Dataset must include:

- accented technical terms;
- acronym misrecognition;
- proper nouns from CV;
- JD domain terms;
- ambiguous homophones;
- cases where CV contains a term the candidate did not say;
- low-confidence contentful answer;
- no-N-best provider fallback;
- privacy redaction check.

### Spec and Docs

- Run spec lint on this file before implementation starts.
- Update repo-docs only after behavior-bearing implementation changes, or when current guide would otherwise mislead.
- Any future implementation trace must link goal, spec, tests, release gate, and known issues.

## Open Decisions

1. Exact rerank threshold: initial candidate is max confidence delta 0.10-0.15, but final threshold needs test data.
2. Glossary persistence: in-memory per session vs persisted session artifact. Initial preference is persisted bounded metadata if provenance is needed across reconnects.
3. UI confirmation detail: ask only scoring-impacting uncertainty vs expose a transcript correction review panel. Initial preference is minimal interruption.
4. Offline cleanup: whether it can update report evidence or only provide a secondary transcript view. Initial preference is secondary view unless user confirms.
5. LLM correction: not in first slice. If introduced later, it must be behind a separate spec update, latency budget, prompt contract, and adversarial eval gate.

## Agent Execution Instructions

1. For any next implementation slice, start with tests that encode guardrails before adding correction behavior.
2. Keep future slices deterministic-first and dependency-free unless a separate spec update approves otherwise.
3. Do not install packages or add providers without explicit approval.
4. Keep route handlers thin; voice logic belongs under `backend/src/services/voice` or existing interview services.
5. Preserve `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` as the source of truth for state machine, confidence, turn counting, and latency.
6. If implementation conflicts with this spec or the voice product contract, stop and raise the conflict before editing code.

證據狀態：本文件已同步 first deterministic backend slice。它 does not claim frontend review UI, live provider SLO verification, offline cleanup, real-AI eval, or production telemetry.
