我先講結論：**扣除支付功能不看，Alan_work 這版已經不是普通 CV-JD match 工具了，它已經往「Role-Fit Interview Coach」走出關鍵一步。**
但現在最準確的定位是：

> **Role-Fit foundation 已完成，Role-Fit closed loop 還沒完成。**

我看的是主產品鏈路與本次 branch 相關的核心 code/docs/eval，不是逐行讀完每個歷史 plan、generated report、benchmark artifact。這次評價是 **code-level audit**，不是我在本機完整跑完所有 test / real provider eval。

---

## 總評分

| 面向                                |           評價 |
| --------------------------------- | -----------: |
| Role-Fit 方向正確性                    | **8.5 / 10** |
| Role-Fit 目前實作完成度                  |   **7 / 10** |
| Interview preparation workflow    |   **8 / 10** |
| Interview + Report 完整閉環           |   **6 / 10** |
| Code robustness / maintainability |   **7 / 10** |
| Production readiness，不含支付         | **6.5 / 10** |

一句話：**你現在的方向很對，而且已經把最難的 workflow gate 做進去了；但真正的「hiring logic → evidence strategy → answer alignment」還差最後一段閉環。**

---

# 1. Role-Fit 層面的評價

## 做得最好的地方：Role-Fit 已經變成 gate，不是漂亮卡片

你現在不是只在 UI 顯示「AI 覺得這個 role 是什麼」。後端已經要求 JD summarisation 前必須有 company website URL 或 manual company context；缺少 company context 會直接 throw `Missing company context`，不讓 JD preparation 繼續跑。這點非常重要，因為它把「理解公司背景」變成 workflow 前置條件，而不是 optional decoration。

更關鍵的是，match 也有 role-fit review gate。如果 JD rubric 裡有 `roleFit`，但 role-fit 沒有 verified，`guardedMatchService` 會回傳 `manual_review`，reason 是 `role_fit_review_required`，而不是硬跑 match。 這代表你的系統現在真正符合你自己的原則：**未確認的 company / role understanding 不應該驅動下游 match。**

這個改動很值。因為大多數 AI interview tool 是「先假裝懂，再給你分數」。你現在比較像「先讓使用者確認 AI 到底懂了什麼，再進入準備」。這才像產品，不像 AI 算命攤。

---

## 目前 Role-Fit 最強的產品價值

你的 Role-Fit goal 寫得很清楚：使用者真正卡住的不是單純不知道 JD requirements，而是四件事：公司為什麼需要這個 role、面試官想降低什麼 hiring risk、CV 哪段 evidence 能證明 fit、回答有沒有對準 role intent。

這個 problem statement 是對的。因為它不是「再做一個 mock interview app」。它是在解決：

```text
JD comprehension gap
+ evidence translation gap
+ interview delivery gap
```

你最新 goal 也已經把產品鏈路定成：

```text
reviewed CV + reviewed JD + reviewed company context
→ confirmed company understanding
→ confirmed role intent
→ source-linked candidate evidence map
→ interview proof strategy
→ natural adaptive interview
→ answer alignment and role-fit report
```

這條鏈是你的護城河。

---

## 目前最大弱點：Role intent 還偏「高級 JD extraction」

現在 `buildRoleIntent()` 主要從 JD 的 must-have requirements、responsibilities、soft skills、nice-to-have requirements 和 parsed requirements 建 role intent。它有 sourceTrace、confidence、uncertainty，也會過濾 prompt injection 和 boilerplate，這是好事。

但它目前比較像：

```text
這份 JD 最重視哪些責任與要求？
```

還沒有完全做到：

```text
這家公司為什麼現在需要這個 role？
這個 role 要解決什麼 business / workflow pain？
Hiring manager 最怕候選人缺什麼？
面試問題背後想驗證什麼風險？
```

所以目前 Role-Fit 是 **requirement-intent v1**，不是完整的 **hiring-logic inference v1**。

舉例，如果 JD 寫：

> Build automation tools and work with internal teams.

目前系統比較容易抽成：

```text
Role intent:
- Build automation tools
- Work with internal teams
```

但你真正想要的是：

```text
Likely role purpose:
The company may need someone who can reduce manual workflow friction and turn messy operational needs into reliable automation.

Hiring risk:
A candidate may know tools but fail to investigate workflow pain, work with non-technical staff, or validate the solution safely.
```

這就是下一階段要補的靈魂。

---

## Company understanding 現在還不夠深

`buildCompanyUnderstanding()` 目前會吃 manual context、JD company context 和 company website URL。問題是：如果只是提供 website URL，它目前主要記錄「Company website supplied for review」，而且 uncertainty 明確寫著 website content 在 JD parsing 期間沒有被驗證。

所以現在不能說：

> 系統已經理解公司網站內容。

比較準確是：

> 系統已經要求公司 context，能保存與 review company context，但 website-grounded company intelligence 還沒完整完成。

這不是小問題。Role-Fit 的核心就是「為什麼這家公司需要這個 role」。如果 company understanding 不夠深，後面的 role purpose 會容易退回 JD requirement summary。

---

# 2. Frontend / UX 評價

JD review UI 現在已經可以 review/edit responsibilities、must-have requirements、soft skills、technical skills、company understanding 和 role intent priorities，而且 UI 明確寫出 match 使用 structured version，不只是 raw JD。

這是很好的第一版。但 UX 還有一個問題：

**現在比較像表單，不像 job seeker 的 decision assistant。**

目前使用者看到很多可編輯欄位，但不一定會立刻知道：

```text
哪些是 JD 直接說的？
哪些是 AI 推論？
哪些需要我確認？
哪個 role intent 最重要？
哪段 CV evidence 最適合？
```

下一版 UI 應該從「review parsed fields」升級成三張核心卡：

1. **Why this role probably exists**
2. **What the interviewer may test**
3. **Your best evidence for this role**

不然 backend 很聰明，但使用者看起來還是像在填大型表單。表單很努力，但它沒有靈魂，像週一早上的 Canvas submission。

---

# 3. Report / Answer Alignment 還是未完成閉環

你的 goal 文件已經明確說，candidate-facing report 應該說明：回答是否對題、evidence 是否合適、還缺什麼 proof、同一個例子如何換角度講得更好。

但目前 docs 也承認：本輪主要落地的是 CV parse、JD parse 和 CV-JD match；question strategy、interview、report 和 RAGAS-style eval 仍是後續範圍。

所以現在不要急著說：

> Kiwi 已經可以完整判斷每個回答是否證明 role fit。

可以說：

> Kiwi 已經完成 role-fit preparation foundation，下一步要把 role intent 和 candidate evidence 接進 question strategy、live interview selection 和 answer-alignment report。

這樣講最穩，也最不會被 code 打臉。

---

# 4. Evaluation 評價

目前 retrieval eval 結果很好看：8 cases、average score 0.97、coverage 95.83%、citation accuracy 100%、hallucination rate 0%、success rate 100%。

但這個 eval 還不能證明 Role-Fit 已經 production ready，因為：

1. 只有 8 cases，太少。
2. `paraphrased_skill_match` coverage 只有 66.7%，adversarial check fail。
3. `weak_evidence_not_upgraded` 有 failed check。
4. latency 是 microsecond 級，明顯偏 deterministic/local eval，不代表真實 LLM + DB + network runtime。

所以它證明的是：

```text
基本 evidence routing / retrieval contract 是健康的。
```

不是：

```text
真實世界所有 CV + JD + company context 都能準確理解 hiring logic。
```

這一點你報告或 pitch 裡要講保守一點。AI eval 很會讓人膨脹，但 production bug 專治膨脹。

---

# 5. Future plan 建議

## Phase 1：把 Role Intent 從 requirement extraction 升級成 hiring logic

你應該新增或強化一個 `RoleIntentDecoder`，輸出不要只停在 requirement list，而是固定產出：

```json
{
  "rolePurpose": "...",
  "businessProblemHypotheses": [],
  "workflowPainPoints": [],
  "idealCandidateSignals": [],
  "interviewProbeMap": [],
  "hiringRiskIfWeak": [],
  "uncertainties": []
}
```

你的 implementation plan 其實已經設計了 `CompanyUnderstandingProfile` 和 `RoleIntentProfile` schema，包括 business model、customers/users、products/services、hiringContextHypotheses、businessProblemHypotheses、workflowPainPoints、idealCandidateSignals 和 interviewProbeMap。

下一步不是再想架構，而是把這個 schema 真正產品化。

---

## Phase 2：讓 company website 真的變成 evidence source

現在 website URL 可以進系統，但 website content 不一定真的被理解。下一步應該做：

```text
companyWebsiteUrl
→ fetch official website pages
→ extract company facts
→ label source snippets
→ build company understanding
→ user review
→ role intent inference
```

每個 company claim 都要有：

```text
sourceType: company_website | JD | manual_context | inference
confidence
uncertainty
rawSnippet
```

你的 goal 裡已經要求每個 company / role inference 有 source label、confidence 和 uncertainty，不能自動確認 unsupported claim。

這裡也要小心 URL security。你現在已經有 HTTP/HTTPS URL normalization 和 prompt-injection filtering。 但 URL capture 這類功能最好再加 SSRF hardening：block localhost/private IP、限制 redirects、限制 content type、限制 max bytes、timeout、不要抓內網。這種 bug 平時不起眼，一出事就是「哇，怎麼打到自己家後端了」。

---

## Phase 3：Candidate Evidence Graph / Role Evidence Map

這是你產品最有價值的下一步。

你要讓系統不只是說：

```text
You match Python / SQL / React.
```

而是說：

```text
This JD signal needs proof of workflow automation.
Best evidence:
1. Kiwi Agent — direct evidence for AI workflow design.
2. Food Agent — adjacent evidence for full-stack/RAG delivery.
3. Foxconn DOE / automation experience — transferable evidence for operational problem solving.
```

每個 evidence item 建議要有：

```text
source: CV project / work experience / user-added example / transcript
rawSnippet
proofAngles
strengthSignals
roleIntentLinks
fitType: direct / adjacent / weak / gap
howToSayIt
avoidUsingFor
```

你的 adopted decisions 已經說 evidence map 必須有 source trace、fit type、proof angle、strength/gap status。 這部分現在應該從「方向」變成「核心資料模型」。

---

## Phase 4：Interview Proof Strategy

正式 interview 前加一頁：

```text
Your Proof Strategy for This Role
```

內容包含：

```text
The company likely wants to know:
1. Can you solve this workflow / business problem?
2. Can you show ownership with real evidence?
3. Can you communicate with the right stakeholders?

Best examples to prepare:
- Kiwi Agent: AI workflow + technical ownership + report QA
- Food Agent: full-stack delivery + RAG + team project
- Foxconn: root cause + operation improvement + measurable outcome

Risks:
- Cloud deployment evidence is weak
- Testing story needs clearer validation
```

注意：**這些 metadata 不要在 live interview 裡提示使用者**。你的 plan 也明確說 live interview 不應提示 recommended evidence；reasoning、evidence choice、question intent 要放到 report 和 diagnostics 裡。

這個設計很對。面試中提示答案會變作弊感，面試後拆解才是 coaching。

---

## Phase 5：Answer Alignment Report

這應該是你下一個大 feature。

每一題 report 不要只說 STAR 好不好，而要回答：

```text
這題面試官想確認什麼？
你有沒有回答到問題？
你用的 example 對不對？
你 evidence 講清楚了嗎？
這個 answer 有沒有降低 hiring risk？
如果重講一次，怎麼講更自然？
```

建議每題加 6 個維度：

| 維度                 | 問題                              |
| ------------------ | ------------------------------- |
| Question Alignment | 有沒有直接回答問題                       |
| Evidence Fit       | example 是否選對                    |
| Evidence Clarity   | action / decision / result 是否清楚 |
| Role Intent Fit    | 是否證明這個 role 真正在乎的能力             |
| Naturalness        | 是否像自然對話                         |
| Concision          | 有沒有太散、太 technical dump          |

你的 Role-Fit goal 裡已經把 answer alignment 定義成 `0-100` score + `strong | partial | weak | off_target` label。 這個非常適合做 report UI。

---

# 6. 整體 code 還需要優化的地方

## 1. `jobDescriptionController` 開始變胖

現在 `paraphraseJD` 同時做：

```text
rawJD validation
URL detection / capture
JD parsing
roleFit build
company context gate
fingerprint extraction
draft save
usage tracking
response formatting
```

它還能跑，但 controller 已經有點開始「全都我來」。建議拆一個 service：

```text
jobDescriptionPreparationService.js
```

讓 controller 只負責 request / response，service 負責 orchestration。你現在自己在 controller header 也寫了要保持 HTTP、business logic、persistence、formatting 分離。 那就別讓 controller 偷偷健身變巨人。

---

## 2. `roleFitProfileBuilder` 建議拆小

現在它同時處理：

```text
URL normalization
manual context sanitization
company understanding build
role intent extraction
security flags
warnings
review input validation
```

這些邏輯都重要，但放同一支 file，之後會難測、難替換。

建議拆成：

```text
roleFitSourceSanitizer.js
companyUnderstandingBuilder.js
roleIntentBuilder.js
roleFitReviewValidator.js
roleFitProfileBuilder.js
```

`roleFitProfileBuilder` 最後只負責 compose。

---

## 3. Human-edited role intent 的 confidence 不要直接等於 truth

前端 `updateRoleIntent()` 會把 user edited item 設成 `confidence: 1`，sourceLabel 是 `Human-reviewed role intent`，sourceTrace 是 human_review。

這有一點風險。

Human review 可以代表：

```text
user confirmed this as useful for preparation
```

但不一定代表：

```text
this is objectively true about the employer
```

建議拆成兩個欄位：

```text
sourceConfidence
reviewConfidence
```

例如：

```json
{
  "sourceConfidence": 0.72,
  "reviewStatus": "user_confirmed",
  "reviewConfidence": 1.0
}
```

這樣下游 report 不會把「使用者確認想這樣準備」誤當成「雇主真的是這樣想」。

---

## 4. Evaluation dataset 需要擴大

目前 retrieval eval 只有 8 cases。下一步至少補 12-case role-fit adversarial suite：

1. Clear direct fit
2. Missing evidence
3. Adjacent / transferable evidence
4. Career transition
5. Noisy marketing-heavy JD
6. Fake company context
7. Prompt injection in JD
8. Prompt injection in manual company context
9. Company website unavailable
10. Role intent over-inference
11. Same project different angle
12. Answer uses wrong example

每個 case 都要測：

```text
role intent correctness
evidence mapping correctness
unsupported claim rate
gap detection
question relevance
answer alignment
```

你現有 eval 數據可以當 baseline，但不要當終點。現在只是熱身，真正比賽還沒鳴槍。

---

## 5. Role-Fit diagnostics 要一路傳到 plan / interview / report

建議每個重要 response 加一個 compact diagnostics：

```json
{
  "roleFitDiagnostics": {
    "companyContextStatus": "ready",
    "companyUnderstandingStatus": "reviewed",
    "roleIntentCount": 6,
    "unsupportedInferenceCount": 1,
    "evidenceMapCoverage": 0.72,
    "proofStrategyStatus": "ready | degraded | missing",
    "degradedReasons": []
  }
}
```

這樣 debug 時你不用猜：

```text
到底是 company understanding 弱？
還是 evidence map 沒建好？
還是 question ranker 沒用到？
還是 report 沒接上？
```

現在很多 AI 系統最可怕的不是壞掉，是「看起來正常但其實降級了」。你之前的系統就有這個問題，現在別讓 role-fit 又走同一條老路。

---

## 6. Voice 不要急著塞重型 Role-Fit reasoning

你的 implementation plan 對這點是對的：voice path 要保留 state machine、low-confidence transcript confirmation、repair/confirmation 不計題數、speech end 到 next audio 3 秒目標。

所以 Role-Fit reasoning 應該：

```text
interview 前預先計算 proof strategy
turn-time 只做 lightweight rank/select
LLM 只 naturalize selected question wording
heavy verification 放到 report
```

不要把 dual-agent、CoVe、deep role reasoning 放進 voice hot path。那樣很容易從 AI interviewer 變成 AI loading screen。沒有人想面試時看 AI 思考人生。

---

# 7. 建議的下一輪 PR 順序

## PR 1：Role-Fit contract hardening

做：

```text
sourceConfidence / reviewConfidence 分離
roleFit review schema validation 加強
frontend 顯示 source label + uncertainty
docs 狀態修正
```

驗證：

```bash
cd backend
npm run test:jd
npm run test:match

cd frontend
npm run test:all
npm run build
```

---

## PR 2：Company website grounded understanding

做：

```text
website fetch / cache / source snippet
company facts extraction
companyUnderstandingProfile v1
unsupported company claim blocking
SSRF / timeout / max-size guard
```

---

## PR 3：Candidate Evidence Graph + Role Evidence Map

做：

```text
CV project/work experience → evidence items
role intent → top evidence mapping
direct / adjacent / weak / gap classification
howToSayIt guidance
```

---

## PR 4：Proof Strategy page

做：

```text
before interview 顯示:
- why this role exists
- interviewer may test
- best evidence
- risks / gaps
```

但 live interview 不提示答案。

---

## PR 5：Question ranking 接 Role-Fit metadata

做：

```text
question metadata:
testedRoleIntentIds
recommendedEvidenceIds
evidenceAngle
coverageContractId
evidenceOverusePenalty
```

這會讓 prepared question pool 真正從「JD-specific」升級成「role-fit-specific」。

---

## PR 6：Answer Alignment Report

做：

```text
per-turn:
question intent
evidence used
evidence fit
role intent fit
main issue
better spoken answer
same example / different angle warning
```

這會成為你產品最能打的部分。

---

# 8. 最後評價

你現在不要再把 Kiwi 叫成普通 **AI interview practice agent**。那個定位太擠，也太容易被看成 wrapper。

更好的定位是：

> **Kiwi helps job seekers decode the hiring logic behind a JD, map their real experience into role-relevant evidence, and practise until each answer clearly proves fit.**

這句才是你的北極星。

目前 Alan_work 的 role-fit 方向已經站住了。真正需要補的是三件事：

```text
1. Company understanding 要更 grounded
2. Role intent 要從 requirements 升級成 hiring logic
3. Report 要從 general feedback 升級成 answer alignment coaching
```

前面是地基，現在地基不錯。下一步是把房子蓋成「面試教練」，不要蓋成「超大型 JD parser」。
