# Candidate Turn Assessment and Grounded Better-Answer Goal

> **實作狀態 (Implementation Status)**：Partial / local implementation exists；independent audit blocked duplicate/reordered rewrite matching。
>
> **校驗測試路徑 (Verified by Tests)**：Focused backend/frontend tests passed at the recorded 2026-07-30 checkpoint；release-complete status was not verified。

> **Remediation authority**：本文件保留為歷史 planning baseline。後續 UI-visible semantic remediation 以 [Candidate Report UI Semantic Integrity Goal](report-ui-semantic-integrity-goal.md) 與 [Specification](report-ui-semantic-integrity-spec.md) 為準；不得沿用本文件舊的 runtime file budget 或「尚未實作」聲稱。

日期：2026-07-30 Pacific/Auckland

對應 Spec：[Candidate Turn Assessment and Grounded Better-Answer Spec](candidate-turn-assessment-spec.md)
上游產品契約：[QI-CP4 Report Alignment and Progress Coaching](../question_refine/04-report-progress-coaching.md)

## 1. Overview and current baseline

目前 candidate report 的逐題卡可顯示回答框架：Introduction、STARR 或 Role-specific Reasoning 的分項及 framework score。它沒有清楚回答候選人最需要知道的兩件事：

1. 「我有沒有直接回答這一題？」
2. 「若保持我實際提供的事實，更好的回答會長什麼樣子？」

後端已建立 `answer_alignment_v2`，可從 accepted answer 判斷 question alignment、evidence fit/clarity、role-intent fit、naturalness 和 concision；但 candidate projection 不發布 `roleFit`，前端逐題卡也不渲染此判斷。報告的 LLM contract 已能產生帶有 exact question 的 grounded rewrite，但目前 HTML 將 rewrite 作為獨立區塊，未可靠地和每一題逐題對位。

本 Goal 補齊這個 candidate-visible CP4 outcome，不重做 question selection、CV-JD match、Voice state machine 或 employer-side ranking。

## 2. Product outcome and target users

### Candidate outcome

對每一個實際面試中被接受、且可評分的回答，candidate 可以在同一張逐題卡理解：

- 回答框架與框架分數；
- 回答結果：`Directly addressed`、`Partly addressed`、`Needs a clearer connection` 或 `Not assessed`；
- 0–100 的 coaching score 與簡短、可驗證的原因；
- 一至兩個最重要的缺口與下一步；
- 以該題、該回答及允許 evidence 為依據的完整英文示範回答，或明確的 `Rewrite unavailable` 狀態。

分數是練習訊號，不是錄取、能力、人格或真實工作表現的判決。

### Developer outcome

Developer 能以 focused tests 驗證：每一個 accepted pair 都得到安全的 candidate assessment；non-answer 不會被評分；LLM rewrite 不會錯題、捏造事實或洩漏 internal metadata；candidate HTML 只接收 allowlisted fields。

## 3. Observable goals

| Goal | Observable result | Exit evidence |
| --- | --- | --- |
| CTA-G1 — Per-turn answer result | Every accepted answer has a safe result label, score, reason and next step. | Backend assessment and publication-projection tests. |
| CTA-G2 — Framework remains distinct | Existing framework score remains visible and is never relabelled as question-answer correctness. | Frontend card test and visual review. |
| CTA-G3 — Grounded better answer | Every actual accepted answer is requested from the existing report-generation LLM call; an ungrounded, missing or mismatched rewrite renders unavailable. | Normalization/projection tests and adversarial fixtures. |
| CTA-G4 — Candidate safety | No role-fit IDs, rank trace, expected signals, private CV/JD text, provider prompt, or chain-of-thought reaches the candidate. | Candidate projection allowlist tests. |
| CTA-G5 — Honest compatibility | Old reports are not silently rescored; the candidate can regenerate to receive the new detail. | Legacy projection regression test. |

## 4. Authority and trust boundaries

```text
accepted-answer eligibility
  -> deterministic answer assessment
  -> grounded report-generation rewrite
  -> server-owned candidate projection
  -> candidate Turn-by-Turn UI
```

Authority order:

```text
privacy / ownership / report publication policy
  > accepted-answer eligibility and deterministic assessment
  > LLM wording and rewrite
  > candidate-facing UI
```

Hard boundaries:

- Only accepted answers are eligible. Clarification, repeat, repair, transcript confirmation, system and acknowledgement turns never create a card, score or rewrite.
- The deterministic assessment owns the label and score. The LLM may explain or improve wording, but cannot change them.
- A better answer may reorganise or clarify supplied evidence; it must not invent projects, technologies, metrics, employers, responsibilities or outcomes.
- Candidate visibility is owned by the server allowlist, never client-side hiding.

## 5. Approved scope and non-goals

### In scope

- Candidate HTML report's per-accepted-answer card.
- Existing framework score, safe answer-result assessment and grounded stronger-answer preview in one card.
- A generic question-relevance fallback so every accepted answer can be assessed even when no Role-Fit proof strategy exists.
- Existing report-generation LLM call produces one rewrite request for every actual accepted answer; no fixed cap such as three or eight questions.
- Candidate projection and focused backend/frontend tests.
- New/re-generated reports only; legacy reports remain readable and show an honest regenerate path where detail is unavailable.

### Non-goals

- Employer-side scoring, hire/no-hire recommendation, calibration claim, personality diagnosis or real-interview performance prediction.
- New provider, new LLM request at page-open time, dependency, database schema, migration, endpoint or persistence model.
- Changing Voice selection, question count, transcript acceptance, CV-JD matching, overall-score formula or report QA repair semantics.
- Bulk regeneration or migration of historical reports.
- TXT/PDF re-layout. JSON receives the same safe candidate fields through the normal report projection; export layout parity is a separately approved slice.
- Deployment, real-provider evaluation, paid evaluation, Git push or production rollout.

## 6. Approved decisions and assumptions

Owner-approved on 2026-07-30:

1. The feature applies to every actual accepted interview answer, not a fixed maximum question count.
2. The result uses a candidate-readable label plus a 0–100 coaching score; it is not a hiring score.
3. The existing report-generation LLM call supplies a per-turn stronger answer. It must fail safely as unavailable when evidence is insufficient or the rewrite cannot be matched to the question.
4. HTML receives the complete first implementation. JSON gets the same safe fields; TXT/PDF re-layout is deferred.
5. Legacy reports are not altered. Regeneration is required to obtain the new per-turn assessment/rewrite.

Recommended technical assumptions, to verify during implementation discovery:

- A generic fallback can score directness to the asked question without claiming role-intent evidence.
- The existing report-generation prompt consumes deterministic fallback rewrites; expanding that fallback to every accepted turn should request one rewrite per turn without adding another provider request. Output-token use may grow with interview length and must be measured in the focused test fixture, not guessed.
- Candidate-facing rewrites will be mapped by the canonical exact question within the server process, then nested under that rendered turn. No internal question ID is sent to the browser.

## 7. Delivery, budget and stop boundary

This Goal/Spec documentation stage is limited to two new documents, roughly 340–430 lines, 15–20 minutes and at most 8k task tokens.

If a later runtime task is explicitly authorised, it is constrained to:

- maximum 5 production files, 3 test files and 2 documentation files;
- fewer than 290 incremental changed lines;
- target 35 minutes, hard stop at 45 minutes from the first runtime edit;
- 26k runtime-token limit; combined Goal/Spec plus runtime envelope: 34k tokens;
- exactly three cycles: patch, focused tests/repair, independent audit/only auditor-confirmed repair.

Any need for a new provider call, persistence change, report-export redesign, more than 10 task-owned files, more than 290 code/documentation lines in the runtime slice, or a fourth cycle is a stop condition requiring a new owner decision.

## 8. Delivery and validation boundary

```text
Goal/Spec approved
  -> separate runtime approval
  -> implementation discovery and scoped baseline
  -> patch
  -> focused backend/frontend tests and lint
  -> independent audit
  -> manual candidate-report visual review
  -> separate release decision
```

Passing Goal/Spec validation does not mean runtime implementation, LLM/provider validation, browser validation or production rollout has occurred.

## 9. Human approval status

- Task Blueprint: Owner-approved on 2026-07-30, including actual-question-count rewrite coverage.
- Goal and Spec: Owner-approved for drafting only.
- Runtime implementation: Not approved by this Goal/Spec drafting request; requires a separate explicit request.
- Production rollout: Not approved.
