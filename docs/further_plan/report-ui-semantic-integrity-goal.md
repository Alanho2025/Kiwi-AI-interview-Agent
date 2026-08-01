# Candidate Report UI Semantic Integrity Goal

> **實作狀態 (Implementation Status)**：Planned / Owner-approved Goal；本文件只授權規格撰寫，不授權 runtime implementation。
>
> **校驗測試路徑 (Verified by Tests)**：None — documentation-only planning stage。

日期：2026-08-02 Pacific/Auckland  
對應 Spec：[Candidate Report UI Semantic Integrity Specification](report-ui-semantic-integrity-spec.md)  
上游產品契約：[QI-CP4 Report Alignment and Progress Coaching](../question_refine/04-report-progress-coaching.md)  
歷史 planning baseline：[Candidate Turn Assessment Goal](candidate-turn-assessment-goal.md)、[Candidate Turn Assessment Spec](candidate-turn-assessment-spec.md)

## 1. Overview and current baseline

本 Goal 優先修正 candidate 在 Report HTML 直接看到的錯誤內容。它不是 frontend-only 工作；若 backend pairing、rubric、score 或 projection 會讓 UI 顯示錯題、錯分、錯 framework、錯 coaching 或捏造內容，該最小 root-cause fix 仍在範圍內。

目前已由 `origin/main` source 確認：

- candidate projection 以 question queue 配對 assessment/rewrite，turn feedback normalization 仍存在 index-based fallback；duplicate、reorder、omission 可造成錯卡。
- candidate projection 未保留 UI 已能 render 的 safe framework/rubric fields，實際 API contract 與 component fixture 不一致。
- rewrite unavailable 時，frontend 可自行產生包含特定學校、公司、職位、專案與百分比的 stronger answer，形成 candidate-visible fabricated evidence。
- unknown/direct question 可落到 STARR；長但未命中 rubric signal 的回答可由字數取得 partial credit。
- question alignment 與 role-intent fit 可由 structure 或 question wording 得到不相稱的正向分數。
- fallback overall score 可把 adjacent experience 當 direct evidence；question-count mismatch 可在沒有 candidate-caused evidence 時顯示 concision advice。

## 2. Product outcome and target users

### Primary user

完成 Text interview 並查看 candidate Report HTML 的 candidate。

### Product outcome

每張逐題卡必須只顯示同一個 accepted Q&A pair 的：

1. canonical question 與 candidate answer；
2. 適用的 framework、dimensions 與 framework score；
3. candidate-safe Answer result；
4. 對應該題的 coaching feedback；
5. grounded stronger answer，或明確的 unavailable 狀態。

任何無法安全配對、分類或證明的內容必須降級為 unavailable / not assessed，而不是猜測、補造或沿用相鄰 turn。

## 3. Observable goals

| Goal | Observable result | Exit evidence |
| --- | --- | --- |
| RUI-G1 — Safe visible content | UI 不再生成或顯示 candidate 未提供的學校、公司、職位、技術、數字或成果。 | Projection + component negative tests。 |
| RUI-G2 — Correct card identity | Question、answer、feedback、assessment、framework 與 rewrite 永遠屬於同一 accepted turn。 | Reorder、omission、duplicate、unknown identity tests。 |
| RUI-G3 — Honest framework | Direct/technical/credential/unknown question 不會因 fallback 被顯示為 STARR。 | Rubric classification + candidate projection tests。 |
| RUI-G4 — Honest answer result | Off-topic structure、題目自身 wording 或回答長度不會製造高 alignment/framework score。 | Adversarial alignment/rubric tests。 |
| RUI-G5 — Honest summary coaching | Adjacent evidence 不冒充 direct；無 duration/focus evidence 時不責怪 answer length。 | Score + frontend fallback tests。 |
| RUI-G6 — Bounded delivery | 每個 slice 可由 Terra Extra High 在一個獨立 task、三個 cycles 和既定 file budget 內完成。 | Slice-specific diff、test evidence與 auditor matrix。 |

## 4. Authority and trust boundaries

```text
accepted-answer eligibility
  -> deterministic turn/rubric/alignment result
  -> bounded LLM wording
  -> server-owned candidate allowlist
  -> frontend rendering
```

Authority order：

```text
privacy / ownership / publication safety
  > accepted-answer and stable turn identity
  > deterministic rubric, score and alignment
  > LLM wording
  > frontend fallback and presentation
```

Frontend 不得補造 candidate facts。LLM output 不得改寫 deterministic identity、rubric 或 score。Server projection 只發布 UI 所需的 allowlisted fields，不為方便顯示而發布 internal IDs、trace、expected signals、CV/JD evidence 或 model reasoning。

## 5. Approved scope and slice order

本 milestone 分成四個獨立 implementation slices。批准某一 slice 不代表批准下一 slice。

| Slice | Candidate-visible outcome | GitHub issues / confirmed defect | Max production / test / docs files | Max incremental lines |
| --- | --- | --- | --- | --- |
| RUI-S1 — Rewrite and projection safety | 正確 framework contract；rewrite 錯配或 unavailable 時不捏造內容。 | #205 rewrite family + untracked fabricated frontend fallback | 3 / 3 / 2 | 300 |
| RUI-S2 — Turn eligibility and feedback identity | Candidate question 不成為 answer card；LLM feedback omission/reorder 不會移位。 | #203、#205 turn-breakdown merge | 3 / 3 / 2 | 280 |
| RUI-S3 — Visible rubric and answer-result truth | 題型、framework、dimension score 與 Answer result 語意正確。 | #213、#235、#206、#207 | 3 / 3 / 2 | 350 |
| RUI-S4 — Visible score and coaching fallback truth | Overall fallback 與 improvement advice 不製造錯誤因果。 | #212、#259 | 2 / 2 / 2 | 220 |

執行順序固定為 S1 → S2 → S3 → S4。每個 slice 必須完成自己的 audit/acceptance 後停止；不得在同一 task 自動進入下一 slice。

## 6. Blast-radius policy

每個 slice 只能修改 Spec 列出的 allowed files：

- **Direct blast radius**：candidate report card、candidate projection、該 slice 的 deterministic source。
- **Permitted indirect radius**：同一 report-generation request 內的 normalization 或 fallback；不得新增 provider call。
- **Forbidden radius**：Voice runtime、question selection、CV/JD Match、Role-Fit coverage internals、ownership/security、analytics、persistence schema、historical migration、TXT/PDF layout、deployment。

若 root cause 需要超出 allowed files、超過 5 production files、3 test files 或 400 incremental lines，implementation 必須停止並提出更小的 split。不得用 client-side masking、放寬 tests 或新增第二套 scoring/pairing path 逃避 stop rule。

## 7. Non-goals and deferred issues

以下明確延後：

- #204 internal evidence-status fallback；candidate projection 目前不直接發布該欄位。
- #208 evidence-use diagnostics、#209 Role-Fit coverage、#210 strongest-example internal selection。
- #211 ownership assertion；另開 T3 security/trust contract。
- #148 answer-level ASR provisional status；保留為 Voice report release blocker並另開 voice-specific Goal/Spec。
- Developer diagnostics、progress analytics、harness enforcement、report export parity、browser redesign。
- 新 endpoint、provider、dependency、database schema、migration、bulk regeneration、deployment、Git push 或 GitHub issue write。

## 8. Approved assumptions

1. First release 以 candidate Report HTML 為驗收 surface；JSON 只因 HTML API contract 必須同步，TXT/PDF layout 不在範圍。
2. 不做視覺 redesign；沿用現有 card、heading、badge、colour與 keyboard interaction。
3. 新生成或明確 regenerated report 取得新結果；不靜默修改 persisted legacy reports。
4. Stable identity 優先使用既有 turn/question/answer identity；若必須新增 persisted identity/schema，該 slice hard stop。
5. Rewrite 無法安全驗證時，顯示 candidate-readable unavailable，不啟動 page-open retry或新 LLM call。
6. Requested execution profile 是 Terra Extra High；model choice 不擴大 file、cost、authority 或 rollout scope。

## 9. Delivery and validation boundary

每個 runtime slice使用 forensic-specialist execution mode：

1. Cycle 1：以 failing/adversarial case 重現，修改所有已確認且在 slice 內的 root cause。
2. Cycle 2：執行 focused tests與 affected-package lint，只修測試證明的 failures。
3. Cycle 3：一個 independent auditor 檢查 task-owned diff、acceptance criteria和 candidate-safety boundary；只修 auditor-confirmed gaps。

不得在 auditor final evidence matrix 前宣稱 PASS。Browser/manual review、live provider、human content review與 production rollout是不同 evidence gates。

## 10. Hard stops and approval status

Hard stops：

- 需要 persistence、migration、新 endpoint、新 provider request或新 dependency。
- 無法在不發布 private ID/trace 的情況下完成 candidate-safe mapping。
- 需要修改 Voice、Match、question-selection、analytics、diagnostics或export layout。
- 任一 slice 預估超過 file/diff/cycle budget。
- 發現 candidate-visible security/privacy exposure；停止本 semantic slice並改走 T3 review。

Human approval status：

- UI-first Task Blueprint：Owner-approved on 2026-08-02。
- Goal/Spec drafting：Owner-approved。
- Runtime implementation：Not authorised by this documentation task；每個 slice 需另行明確啟動。
- Deployment / production release：Not approved。

`Goal/Spec validated` 不等於 `runtime implemented`，也不等於 browser、human、live-provider 或 production verified。
