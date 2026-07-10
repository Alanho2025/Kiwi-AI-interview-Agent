# Role-Fit Intelligence Goal

狀態：local implementation 與新流量 cutover 已完成；pre-cutover snapshot cleanup、browser、live provider 與 human calibration gates 待外部條件
日期：2026-07-10  
產品名稱：Kiwi AI Interview Agent

## 文件定位

本文件定義 Role-Fit Intelligence 的產品目標、範圍、決策和成功標準。實作細節、資料契約、API、BDD 與驗證門檻在 [Role-Fit Intelligence Spec](role-fit-spec.md)；現況證據與設計來源保留在下列文件：

- [原始產品方向](recommend_plan.md)
- [總實作計畫](2026-07-10-role-fit-intelligence-implementation-plan.md)
- [逐 feature gap audit](2026-07-10-role-fit-feature-gap-audit.md)
- [Agent、ReAct 與 RAG evaluation 參考](references/agent-rag-evaluation-references.md)
- [實作 checkpoint 與 trace](role-fit-implementation-trace.md)

本文件中的「必須」是完整 Role-Fit Intelligence 的產品約束。CV parse、JD parse、CV-JD match、Phase 3 question runtime、Phase 4 Answer Alignment/report、Phase 5 mock-safe voice hardening與 Phase 6 local runtime evaluation 已在本輪落地；report browser visual、live voice provider 與真實 human calibration 仍是外部 gate。

## 概覽（Overview）

### 產品目標（Goal）

讓所有 job seekers 能把一份 JD 和公司的已確認背景，轉換成可理解、可追蹤的 hiring logic；再將自己的 CV 經驗轉譯成合適的 proof points，透過自然的 voice-first mock interview 練習，最後從報告看見每個回答是否真正證明了 role fit。

目標體驗：

```text
reviewed CV + reviewed JD + reviewed company context
  -> confirmed company understanding
  -> confirmed role intent
  -> source-linked candidate evidence map
  -> interview proof strategy
  -> natural adaptive interview
  -> answer alignment and role-fit report
```

### 使用者（Users）

- 主使用者：尋找任何職種、資歷或產業職位的 job seeker。
- 次要使用者：希望查看自己面試準備依據的 candidate；不是 employer、recruiter 或自動化篩選系統。

### 問題（Problem）

現有 Kiwi 已能做 CV/JD review、match、question pool、adaptive interview 和 report QA，但下游流程主要以 requirement、skill 和 match gap 為中心。使用者仍難以回答四件更接近實際面試判斷的事：

1. 這家公司為什麼需要這個 role？
2. 面試官可能想降低什麼 hiring risk？
3. 我的哪段經驗能以哪個角度證明 fit？
4. 我剛才的回答是否對準了這題真正要驗證的 role intent？

Role-Fit Intelligence 要補的是這條證據鏈，而不是增加泛用題目、讓 LLM 自由猜測公司意圖，或把現有 controller 換成不可控的 autonomous agent。

## 產品結果（Product Outcomes）

### 候選人結果（Candidate-facing outcomes）

- 使用者在開始 Role-Fit session 前，能 review 並確認系統對公司、role purpose、workflow pain 與理想 candidate signals 的理解。
- 每一個推薦 evidence 都能回到 CV 或使用者明確提供的來源，並說明它適合證明什麼、不能過度聲稱什麼。
- mock interview 題目能覆蓋已確認的 role intent、未解 gap 和 evidence depth，而不是只重複技術關鍵字。
- live text/voice interview 維持自然，不會提示「請用哪個 project」或暴露 proof-point metadata。
- 報告以英文清楚說明回答是否對題、使用的 evidence 是否合適、還缺什麼 proof，以及可如何把同一個例子換角度講得更好。

### 產品與工程結果（Product and engineering outcomes）

- 新 Role-Fit artifacts 有 version、owner、review status、source trust、privacy/retention boundary 與 backward-compatible fallback。
- question decision 能以 user-safe diagnostics 解釋「為何問這題」，而非保存或展示 model private chain-of-thought。
- RAG / agent quality 能以真實 retrieval output、generation grounding、trajectory contract 和 human calibration 評估，而不只以 fixture string checks 判斷。
- Role-Fit path 可由 feature flag 分 phase rollout；既有 CV-JD match、text interview、voice state machine、report QA 與舊 session 不被破壞。

## 範圍（Scope）

### 包含範圍（In scope）

1. Company context、company understanding 與 role intent 的可 review preparation flow。
2. Candidate Evidence Graph 和 Role Evidence Map。
3. Database-driven taxonomy、strategy registry 與 bounded router selection。
4. Interview Proof Strategy、question pool v3 metadata、coverage/ranking integration。
5. Voice-first path 的預先計算 metadata integration 與 user-safe diagnostics。
6. Answer Alignment、role-intent coverage、evidence usage 與 report QA extension。
7. RAGAS-style retrieval / grounding / trajectory evaluation dataset 和 release gates。
8. 新 artifact 的 ownership、retention、deletion、access control 和 schema-version strategy。

### 非目標（Non-goals）

- Employer-side candidate screening、ranking、shortlisting 或 hiring-decision automation。
- 對公司、team、culture、業務問題做未標示且無來源的事實宣稱。
- 在 live interview 中給使用者答案提示、recommended evidence 或內部 ranking reason。
- 以 prompt 取代 voice state machine、STT confidence gate、question count rules、QA integrity 或 authorization。
- 在 source code 硬編所有產業 taxonomy、role templates 或公司規則。
- 為了採用 ReAct、RAGAS、LangGraph、Haystack、Phoenix 或 DeepEval 而直接搬遷核心 runtime。
- 未經明確批准就把 real-AI evaluation 作為日常 local test，或將敏感 CV/JD/transcript 送往新的外部服務。
- 宣稱尚未實作與驗證的 privacy、deletion、encryption 或 compliance guarantee。

## 已採用決策（Adopted Decisions）

這些決策已從先前 audit 的 recommended defaults 收斂為本版本規格的基線；改變任一項需要更新 spec 並重新檢查 rollout / migration impact。

| Decision | Adopted rule | Reason |
| --- | --- | --- |
| Company context | Role-Fit 需要 official company website **或** user-provided company context，至少一項。 | 支援 confidential recruiter、public sector、small business 與沒有可抓取網站的 JD。 |
| Review UX | JD review 擴成單一 `Job + Company Understanding` review step，內含 role intent section。 | 減少 prep flow 分頁，但保留 user confirmation gate。 |
| Company claims | 每個 inference 必須標示 `Directly stated`、`Company context`、`Reasonable inference` 或 `Need confirmation`。 | 防止系統假裝知道 hiring manager 的真實意圖。 |
| Taxonomy storage | Mongo collection + versioned seed JSON；runtime 載入 active version。 | 可查詢、可 rollback，也可日後增加 admin workflow。 |
| Role routing | Router 只選 generic/domain strategy 與 taxonomy；不能直接產生 business truth。 | LLM / heuristic routing 必須受 schema、critic、human review 與 generic fallback 約束。 |
| Evidence map | 每筆 role-fit mapping 必須有 source trace、fit type、proof angle、strength / gap status。 | 讓 candidate-facing coaching 可追蹤，不把 semantic similarity 當成事實。 |
| Answer alignment | Internal `0-100` score + `strong | partial | weak | off_target` label。 | 與現有 score UI 一致，也保留使用者可讀性。 |
| Voice behavior | Interview 前預先計算 proof strategy；turn-time controller / ranker 選擇 proof point，LLM 只 naturalize wording。 | 保護 3-second latency target、turn state machine 與 transparency。 |
| ReAct trace | 保存 structured, user-safe action rationale、tool/args、observation、fallback、outcome；不保存或顯示 raw chain-of-thought。 | 需要可稽核性，不需要暴露 private model reasoning。 |
| Rollout | 原地升級現有主鏈；flags 只用作短期 release kill switch。既有進行中 session 可由 version adapter 完成，但新 session 不長期保留 legacy alternative。 | 避免永久雙軌，同時不破壞已建立的 plan、question、report 或 resume flow。 |
| Product language | 所有 candidate-facing UI、report、prompt、rewrite 與 schema enum display text 使用英文。 | 產品體驗一致；技術文件可用中文。 |

## 產品原則（Product Principles）

### 證據優先於說服（Evidence before persuasion）

系統要幫 candidate 找到可說服面試官的證據，但不能把缺乏來源的推論包裝成事實。Role intent、company context、candidate evidence 和 report claim 都要留下可檢查的來源與不確定性。

### 下游承諾前先完成人工 review（Human review before downstream commitment）

未確認的 company understanding 或 role intent 不得驅動 Role-Fit match、proof strategy 或 report claim。使用者可以確認、編輯或要求修正；這是 workflow gate，不是可跳過的展示卡。

### 面試自然、事後可檢查（Natural interview, inspectable after the fact）

面試時應像真人 interviewer：問自然問題、根據答案追問、處理語音不確定性。事後 report / diagnostics 才顯示 proof point、evidence angle、coverage 和 reasoning summary。

### 安全邊界由 deterministic code 控制（Deterministic control at safety boundaries）

access control、schema validation、review status、state transition、question counting、ranking formula、fallback、retention 和 QA failure 由 deterministic code 負責。LLM 用在 messy extraction、bounded explanation 與 spoken wording，不能自由決定權限、完成狀態或 unsupported claim。

### 明確降級，絕不默默補造（Degrade explicitly, never silently invent）

company fetch、taxonomy routing、evidence mapping、proof planning 或 answer alignment 失敗時，必須顯示 / 記錄 `missing`、`needs_review`、`degraded` 或 `unavailable`。有可證明的 fallback 才可繼續；不能補造公司背景、candidate experience 或 report evidence。

### 功能本身必須可評估（Build evaluability with the feature）

每個新增模型輸出要能進入 fixture、contract test、trace、evaluation dataset 和 human review。Role-Fit 不以單一平均分數宣告成功；高風險 unsupported company/skill/seniority claim 必須是 blocking failure。

### 原地替換，驗證後退休（Replace, verify, retire）

Role-Fit 是現有 CV/JD preparation、match、question planning、interview control 和 report 的升級，不是第二套產品流程。實作可以暫時保留 version adapter、kill switch 和舊 session reader，讓已建立 session 安全完成；但每一個 temporary compatibility path 都必須有移除條件、owner 和 cleanup test。驗證完成後，新的 contract 成為唯一的新 session 主鏈，未使用的 service、flag、schema branch、fixture 與 UI branch 必須刪除。

## 成功定義（Success Definition）

### 硬性 release 條件（Hard release criteria）

- Role-Fit session 無法在 company context、company understanding 與 role intent 未確認時產生 plan。
- 每個 company / role inference 都有 source label、confidence 和 uncertainty；無來源 claim 不會自動 confirmation。
- 每筆 evidence recommendation 均可回溯到 private CV、user-provided example 或 accepted transcript source；無 source 的 mapping 必須是 `gap`。
- live voice/text UI 不顯示 recommended evidence、proof point、internal prompt 或 raw reasoning。
- contentful low-confidence transcript 仍走 confirmation，repair/confirmation/repeat/system turns 仍不計入 interview question 或 AnswerAlignment。
- deterministic QA 會阻擋 unsupported company claim、missing evidence ID、ungrounded alignment claim 或 missing must-cover intent report。
- flag off、role-fit artifact 缺失、舊 plan/report/session 均維持現有行為與可讀性。
- 新 session 在 cutover 後只使用升級後的主鏈；legacy reader 只服務於 cutover 前已建立的 session，不能成為新使用者的長期 alternative。
- 每個 temporary adapter / flag 都有 removal gate；達成 gate 後舊 implementation、dead code、obsolete test/fixture 和 no-longer-used persistence branch 必須移除。

### 量測成功（Measured success）

初始 release 不以未校準的通用分數作為產品宣稱。以下數據必須被量測與分 slice 檢視；人類標註校準完成後，才在 release gate 中設定明確 numerical threshold。

| Metric | What it answers | Required release evidence |
| --- | --- | --- |
| Review completion | 使用者是否能完成可理解的 company / role review。 | 每個 Role-Fit session 留下 review status；阻擋/修正原因可追蹤。 |
| Must-cover coverage | proof strategy 是否真的被 active questions 或 explicit degraded fallback 處理。 | 每個 must-cover intent 為 `covered`、`unresolved` 或 `degraded`，沒有 silent omission。 |
| Evidence traceability | 推薦 evidence 是否可回到來源。 | contract test 與 sampled eval 中 100% 有有效 source reference；缺 source 一律 gap。 |
| Unsupported-claim safety | 系統是否把不存在的 skill/company intent 提升成事實。 | synthetic/adversarial test cases 零容忍 blocking failure。 |
| Answer alignment usefulness | report 是否能指出 question/evidence/role intent 的實際缺口。 | human-reviewed holdout 的 per-case judgement、disagreement report 與 calibration decision。 |
| Retrieval quality | retriever 是否排序出正確 evidence，且不被 noise 誘導。 | actual retrieval benchmark 的 `precision@K`、`recall@K`、`MRR`、`nDCG`、noise sensitivity slices。 |
| Agent control | controller 是否選擇合法 action/tool/args 並正確結束。 | trajectory cases 的 action / tool argument / state safety results。 |
| Voice latency and safety | Role-Fit metadata 是否影響 voice contract。 | latency trace、question-counting、low-confidence confirmation regression tests。 |

## 分階段結果地圖（Phased Outcome Map）

| Phase | User-visible capability | Delivery proof |
| --- | --- | --- |
| 0 | 尚無 runtime change；以現有 public contracts 建 characterization tests、fixtures、baseline。 | Baseline test artifacts、removal manifest。 |
| 1 | 現有 JD review 原地升級，使用者可確認 company understanding 與 role intent。 | Review gates、source labels、現有 endpoint/component contract tests。 |
| 2 | 現有 match result 原地增加 role evidence mapping。 | Source-linked evidence map、direct/adjacent/weak/gap tests。 |
| 3 | 現有 interview plan / question pool 原地升級 proof metadata。 | Question metadata、coverage/ranker、voice no-hint tests。 |
| 4 | 現有 report 原地增加 answer alignment、evidence usage 與 role intent coverage。 | Accepted-answer-only alignment、QA rules、legacy session adapter。 |
| 5 | 升級後的 voice-first path 維持 state-machine 與 latency contract。 | Voice regression / trace evidence。 |
| 6 | 新主鏈成為唯一新 session path，完成 evaluation/calibration 後清除 obsolete implementation。 | Versioned datasets、cutover proof、removal PR。 |

## 風險與 guardrails（Risks and Guardrails）

| Risk | Guardrail |
| --- | --- |
| 系統杜撰公司意圖 | Source trust labels、critic、user review、QA failure code。 |
| Weak adjacent evidence 被說成 direct experience | Deterministic source trace、fit type、blocked claim test、report grounding。 |
| Prep flow 過長導致 drop-off | 合併 Job + Company review；低信心才要求補充；legacy flow 仍可用。 |
| Voice latency 退化 | Precompute role-fit artifacts；bounded turn path；latency trace and gate。 |
| LLM 自由選題或無限 loop | Enum actions、candidate action validation、retrieval/action budgets、deterministic fallback。 |
| 新 schema 破壞舊 session | Optional fields、new sessions only、schemaVersion、flag-off fallback。 |
| CV/JD/company 資料外洩或 retention 不清楚 | Private ownership、minimal storage、retention / deletion integration、no unapproved external dependency。 |
| 評估分數造成假安全感 | Per-case evidence、human calibration、high-risk blocking rules、no generic threshold claim。 |

## 完成定義（Definition of Done）

Role-Fit Intelligence 只有在所有下列條件成立時才算完成：

1. 新 session 可完成已 review 的 company / role / evidence / proof / interview / report 全流程。
2. 每一個下游決策都有明確 artifact owner、schema version、source trace 與 fallback。
3. live interview 仍遵守 voice product contract 和 text fallback path。
4. report 的 role-fit feedback 只建立在 accepted answer、reviewed role intent 與 grounded evidence 上。
5. old sessions、old reports 在其 retention/resume window 內仍可讀、可完成、可生成 report；新 session 不保留 legacy alternative。
6. focused backend、frontend、voice、report、privacy、evaluation gates 都通過；real-AI eval 只在已批准的成本 / credential 條件下執行。
7. temporary compatibility adapter、kill switch、dead service、obsolete test/fixture 和不再讀取的 persistence branch 已依 removal manifest 刪除。
8. 功能真正 shipped 後，更新 `repo-docs/`、implementation workflow 與 change log；在此之前不要把 proposal 寫成 current behavior。

證據狀態：CV/JD/match、Phase 3、Phase 4 product code、Phase 5 mock-safe voice hardening、Phase 6 local evaluation與新流量 cutover已通過對應 robustness/eval gates。新 match 只接受 owner-scoped verified Role-Fit；question/report 寫 v3/v7；Role-Fit artifacts 使用 private retention contract/registry；`legacy_reviewed_jd` 已移除。1.00 synthetic 分數不是 production semantic/real-AI 保證；human calibration 仍為 0/6、threshold `not_set`。三個 pre-cutover snapshot readers 仍等待 14-day telemetry/migration/retention gate；Phase 4 browser visual 與 live provider 3 秒 gate 仍待外部條件。現況與 locator 見 `docs/role-fit-implementation-trace.md` 和 `repo-docs/`。
