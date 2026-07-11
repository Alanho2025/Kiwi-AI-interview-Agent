# Role-Fit Closed Loop v2 Goal

狀態：final goal；V2-0 至 V2-6 已落地，release gate 為 `ready_with_known_issues`
日期：2026-07-11 NZST  
產品名稱：Kiwi AI Interview Agent  
關聯 spec：[Role-Fit Closed Loop v2 Spec](2026-07-11-role-fit-v2-spec.md)
實作追蹤：[Role-Fit Closed Loop v2 Implementation Trace](2026-07-11-role-fit-v2-implementation-trace.md)
實作敘事：[Role-Fit Closed Loop v2 Implementation Narrative](2026-07-11-role-fit-v2-implementation-narrative.md)

## 文件定位

本文件重新制定 Role-Fit 的下一階段目標。它不覆蓋 2026-07-10 已完成的 foundation trace；v1 現況仍以 [Role-Fit Intelligence 實作追蹤](role-fit-implementation-trace.md)、[Role-Fit Intelligence Goal](role-fit-goal.md) 和 [Role-Fit Intelligence Spec](role-fit-spec.md) 為準。

v2 的任務是把已落地的 preparation、match、question runtime、report extension 和 local eval，升級成真正的 Role-Fit closed loop：

```text
grounded company understanding
  -> hiring logic
  -> candidate evidence strategy
  -> proof strategy
  -> interview questions
  -> answer alignment coaching
  -> calibrated release evidence
```

## 已檢查的目前狀態

| Area | Current status | Evidence |
| --- | --- | --- |
| Git / workspace | V2 開始時以 `1eeaa907d8f7d90d6b226f2d6d0f49afa07ceacc` 作為乾淨基線；目前 V2 implementation slices 保持在本地 working tree，未提交。 | `git status --short --branch`、implementation trace |
| v1 local implementation | CV/JD/match、question v3、report v7、mock-safe voice hardening、runtime retrieval/trajectory eval 和新流量 cutover 已在 trace 中標為完成。 | `docs/role-fit-implementation-trace.md` |
| Release gates | Human calibration、adversarial、cutover/retention contract、browser visual 和 voice flow 已由 release gate 聚合；voice next-question 3 秒 SLO 超標，列為 known issue。 | `backend/eval/reports/role-fit-release-gate.latest.json` |
| Company context gate | JD summarize 需要 website URL 或 manual company context；缺少時會丟 `Missing company context`。 | `backend/src/controllers/jobDescriptionController.js` |
| Website understanding | Website URL 目前主要保存為 supplied URL；JD parsing 階段沒有驗證 website content。 | `backend/src/services/jobDescription/roleFitProfileBuilder.js` |
| Role intent | `buildRoleIntent()` 主要從 JD requirements、responsibilities、soft skills 和 parsed requirements 生成 intent items。 | `backend/src/services/jobDescription/roleFitProfileBuilder.js` |
| Human review confidence | 前端 user-edited role intent 仍寫入 `confidence: 1`，沒有拆成 source confidence 和 review confidence。 | `frontend/src/components/analyze/JobContextCard.jsx` |
| Report alignment | Answer Alignment 已有 accepted-answer-only path，但舊 / 缺少 proof contract 時仍以 safe legacy/unavailable path 降級。 | `backend/src/services/report/answerAlignmentService.js` |

V2 更新：2026-07-11 已把 source confidence 和 review confidence 拆開；website-only context 會標成 `supplied_url_only` / `url_supplied`。V2-1 已新增 bounded same-origin website evidence capture，能在安全 fetch 成功時把 snippets 標成 `company_website` evidence；manual context 明確否定 website domain term 時會輸出 conflict diagnostics，而不是靜默選邊。V2-2 已新增 deterministic `company_understanding_v2` detail fields 和 `role_intent_decoder_v2` slice，讓 company understanding 保留 business model、users/products/context、hiring hypotheses，role intent artifact 同時保留 legacy requirement `items`、hiring-logic fields 和 compact diagnostics；低信心 hiring logic 會透過 `roleFitDiagnostics.degradedReasons` 暴露。V2-3 至 V2-5 已接上 Candidate Evidence Graph、Role Evidence Map v2、proof strategy UX、metadata-aware ranking 和 Answer Alignment v2。V2-6 已新增 12-case mock-safe adversarial suite、完成 12/12 human calibration，release threshold 為 0.85；browser visual、real-backend voice flow 和 Role-Fit release gate 已跑通，唯一 known issue 是 voice next-question first audio 超過 3 秒。詳見 v2 implementation trace 與 implementation narrative。

## ChatGPT 評價收斂

[role_fit_recommend_by_chatGPT.md](role_fit_recommend_by_chatGPT.md) 的核心判斷是正確的：Kiwi 已完成 Role-Fit foundation，但 closed loop 尚未達到 production-ready。

v2 採納以下評價作為產品目標：

1. Role intent 要從 `requirement extraction` 升級成 `hiring logic inference`。
2. Company website 不能只當 URL；必須成為受限、可追蹤、可 review 的 evidence source。
3. Candidate Evidence Graph / Role Evidence Map 要成為核心資料模型，而不是 match 附屬說明。
4. Interview 前要有 Proof Strategy；live interview 不提示 recommended evidence。
5. Report 要從 general feedback 升級成 Answer Alignment coaching。
6. Diagnostics 要一路傳到 parse、match、plan、interview 和 report，讓 degraded path 可觀察。
7. Voice path 只能使用 precomputed metadata；不能把重型 reasoning 放進 turn-time hot path。
8. Eval 不能只靠小型 synthetic perfect score；需要 adversarial cases、人類校準和 per-slice failure review。

## North Star

Kiwi helps job seekers decode the hiring logic behind a JD, map their real experience into role-relevant evidence, and practise until each answer clearly proves fit.

這句是 v2 的產品北極星。Kiwi 不是 employer-side screening tool，也不是大型 JD parser。它是 candidate-side interview coach。

## 產品目標

讓 job seeker 在開始 mock interview 前能回答三個問題：

1. 這家公司為什麼可能需要這個 role？
2. 面試官可能想降低哪些 hiring risks？
3. 我的哪些真實經驗能以什麼角度證明 fit？

完成 mock interview 後，使用者還要能看見：

1. 每題想驗證的 role intent。
2. 自己是否直接回答了問題。
3. 使用的例子是否合適、清楚且足以降低 hiring risk。
4. 同一個例子是否應該換角度、更自然或更簡潔地重講。

## 使用者

- 主使用者：準備求職面試的 job seeker，包含轉職者、初中高階候選人、技術與非技術職種。
- 次使用者：需要回顧自己準備依據與報告可信度的 candidate。
- 排除：雇主篩選、候選人排名、錄用決策、自動拒絕或背景調查。

## In Scope

1. `sourceConfidence` / `reviewConfidence` 分離，避免把 user review 當成 employer truth。
2. Website-grounded company understanding，包括 SSRF guard、bounded fetch、source snippet 和 unsupported claim blocking。
3. Role Intent Decoder v2，輸出 role purpose、business problem hypotheses、workflow pain points、ideal candidate signals、interview probe map 和 hiring risks。
4. Candidate Evidence Graph v2，讓 proof angles、strength signals、fit limits 和 avoid-using guidance 成為可追蹤資料。
5. Role Evidence Map v2，將 role intent 與 candidate evidence 連到 direct、adjacent、weak、gap 和 how-to-say-it guidance。
6. Proof Strategy preparation UX，面試前顯示 focus、best evidence、risks 和 gaps。
7. Question metadata/ranking hardening，使用 role-fit metadata 但不在 live interview 提示答案。
8. Answer Alignment Report v2，逐題評估 question alignment、evidence fit、evidence clarity、role intent fit、naturalness 和 concision。
9. Compact `roleFitDiagnostics` 從 preparation 到 report 一路傳遞。
10. 12-case 以上 adversarial eval suite、人類 calibration 和 release-threshold decision。
11. `jobDescriptionController` / `roleFitProfileBuilder` 的邊界清理，讓 controller 只做 HTTP orchestration。

## Non-goals

- 不新增 employer-facing hiring decision、candidate ranking 或 screening API。
- 不在 live interview 畫面提示「請用哪個 project」或展示 internal proof metadata。
- 不用 prompt 取代 deterministic gates、ownership、review status、question counting、report QA 或 retention。
- 不承諾 website fetch 會抓取所有網站內容；受 robots、網路、安全策略或 provider 限制時必須明確 degraded。
- 不新增未批准的 dependency、external search provider、embedding provider、LLM judge provider 或 live provider eval。
- 不把 synthetic 1.00 eval 宣稱成 production semantic quality。
- 不把 human-edited role intent 的 review state 當成外部公司事實已驗證。

## 成功定義

### Candidate-facing success

- 使用者能在 preparation 階段看到英文、可理解的三張核心摘要：`Why this role probably exists`、`What the interviewer may test`、`Your best evidence for this role`。
- 每個 company / role inference 都有 source label、source confidence、review confidence 和 uncertainty。
- 每個 recommended evidence 都能回到 CV、user-added example 或 accepted transcript source。
- live interview 自然提問，不顯示 recommended evidence、proof point ID 或 internal reasoning。
- report 能逐題說清楚：問題想驗證什麼、回答是否對題、例子是否選對、缺什麼 proof、下次怎麼重講。

### Engineering success

- Controller、service、builder、validator、repository 邊界符合 `docs/clean-code-rules.md`。
- Role-Fit degraded path 可以用 `roleFitDiagnostics` 查到原因。
- Voice turn-time path 不新增 website fetch、unbounded retrieval loop 或額外 heavy role-intent LLM call。
- Report QA 可阻擋 unsupported company claim、missing evidence ID、ungrounded alignment claim 和 must-cover omission。
- v2 artifacts 有 owner、schema version、source/review confidence、retention metadata 和 migration/cleanup plan。

### Release success

- Focused backend/frontend tests 覆蓋所有 v2 contracts。
- 12-case 以上 adversarial suite 包含 direct fit、missing evidence、adjacent evidence、career transition、marketing-heavy JD、fake company context、JD prompt injection、manual context prompt injection、website unavailable、role intent over-inference、same project different angle、wrong example answer。
- Human calibration 完成，並記錄 reviewer disagreement 和 threshold decision。
- Browser visual gate、live provider SLO 和 production retention gates 只能在取得真實證據後標完成。

## 分階段目標

| Phase | Goal | Release proof |
| --- | --- | --- |
| V2-0 | Contract hardening | `sourceConfidence` / `reviewConfidence`、diagnostics schema、legacy/current status reconciliation |
| V2-1 | Grounded company intelligence | Website fetch/extract/cache/source snippets、SSRF guard、manual fallback、unsupported claim blocking |
| V2-2 | Hiring-logic role intent | RoleIntentDecoder v2、business/workflow/hiring-risk fields、critic + review UI |
| V2-3 | Evidence strategy | CandidateEvidenceGraph v2、RoleEvidenceMap v2、how-to-say-it / avoid-using guidance |
| V2-4 | Proof Strategy UX + question ranking | Prep strategy page、metadata-aware question ranking、live no-hint verification |
| V2-5 | Answer Alignment coaching | Per-turn dimensions、better spoken answer plan、QA grounding, TXT/PDF/UI export |
| V2-6 | Evaluation and cleanup | Adversarial suite、human calibration、browser visual、voice flow、cutover/retention contract 和 release gate 已接入；voice 3 秒 SLO 是 known issue |

## Definition of Done

v2 只有在下列條件全部成立時才算完成：

1. New sessions can complete grounded company review, hiring-logic role intent review, evidence strategy, proof strategy, interview and answer-alignment report.
2. Human review does not overwrite source confidence.
3. Website-derived claims include bounded source snippets or remain unconfirmed/degraded.
4. Every strong/direct evidence claim has a traceable candidate source.
5. Every live question decision can be explained after the interview without exposing private chain-of-thought.
6. Answer Alignment is only produced for accepted answers and is blocked by deterministic QA when ungrounded.
7. Voice mock-safe gates, real-backend voice flow, browser visual gate, human calibration and retention contract gates are separately reported without exaggerating one as another; voice 3 秒 SLO 超標保持 known issue。
8. `repo-docs/` is updated only after shipped behavior changes; proposal language remains clearly marked as future plan.

## Open Decisions

| Decision | Recommended default |
| --- | --- |
| Website fetch scope | Official URL plus bounded same-origin pages only; max bytes, timeout, redirect, content-type and private-IP blocks. |
| Human review semantics | `reviewStatus=user_confirmed` means user approved current preparation interpretation; it does not mean employer truth is independently verified. |
| Role Intent Decoder owner | New service under `backend/src/services/jobDescription/`, composed by a thin `jobDescriptionPreparationService`. |
| Proof Strategy UX | Prep page only. Live interview receives no evidence hints. |
| Eval release threshold | 12/12 calibration 已完成；current threshold decision is 0.85；release gate status is `ready_with_known_issues` because voice next-question 3 秒 SLO 超標。 |

證據狀態：本文件基於 2026-07-11 NZST 對 `docs/role_fit_recommend_by_chatGPT.md`、現有 Role-Fit docs、implementation trace、repo-docs、current source locator 和 `backend/eval/reports/role-fit-release-gate.latest.json` 的檢查。V2 已成為 final local implementation；voice 3 秒下一題 SLO 是明確 known issue。
