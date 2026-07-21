# Role-Fit Intelligence 實作計畫

狀態：提案與實作計畫，尚未實作  
日期：2026-07-10

相關現況審核：`docs/2026-07-10-role-fit-feature-gap-audit.md`  
這份文件是總計畫；正式 goal / spec 應搭配 feature gap audit 一起寫，避免漏掉目前 code 裡既有的 gating、voice state machine、question pool、report QA 和 persistence 細節。

## 目標

Kiwi 的下一版目標是：

> 幫助 job seekers 把 JD 轉成「公司真正想確認的 hiring logic」，再把自己的經驗轉成 role-relevant evidence，最後透過 voice-first interview 練到每個回答都能清楚證明 fit。

這不是把現有系統改成更多題庫，也不是把所有判斷寫成 hardcoded rule。目標是加一層 Role-Fit Intelligence：

```text
JD + company context
  -> company understanding review
  -> role intent profile
  -> candidate evidence graph
  -> role evidence map
  -> voice-first proof strategy
  -> adaptive voice interview
  -> answer alignment report
```

實作要一個 phase 一個 phase 做。每一個 phase 都要能單獨驗證、能回退，而且在新路徑還沒穩之前不能破壞現有 CV/JD match、voice interview 和 report QA。

## 你的產品決策

- 目標使用者是所有 job seekers，不只 international students 或 early-career graduates。
- 主體驗改成 voice-first。Text mode 保留為 fallback 和 regression-safe path。
- 使用者面向的 UI、report、schema、prompt、rewrite 最終都用英文。
- Role-Fit flow 裡 company website / company context 不應再是 optional。使用者需要先提供或確認公司背景，系統才能產出可信的 role intent。
- JD parse 階段要先產出 LLM 對公司的理解，並讓使用者 review / confirm，再讓下游 match、interview、report 使用。
- 面試中不提示使用者「這題該用哪個 evidence」。Live interview 要自然。Reasoning、evidence choice、question intent 放到 report 和 diagnostics 裡看。
- 不要把每個產業的能力分類都 hardcode 在程式碼裡。需要產業差異時，用 database-driven taxonomy、strategy registry、router agent。
- 但 deterministic code 仍然必要：安全、state machine、access control、schema validation、scoring contract、ranking math、QA integrity 都不能交給 LLM 自由決定。

## 現有基礎

現在 code 已經有這些基礎：

- CV upload / recent CV reuse / CV review / CV evidence profile。
- Pasted JD parse / guarded JD critic / reparse / JD human review。
- CV-JD match record，包含 strengths、gaps、requirement checks、question-plan hints。
- CV question seeds、JD question filter、prepared question pool、source priority、novelty filtering、readiness checks。
- Adaptive text / voice interview controller，可以 follow-up、validation、switch topic、wrap-up。
- Voice state machine、STT confidence gate、transcript confirmation、TTS provider routing、latency traces、resumable recording。
- Accepted-answer report dataset、deterministic turn rubric、report QA、bounded repair、claim grounding、evidence sources、transcript-risk UI。

缺的不是「更多問題」。缺的是一個明確、可 review、可追蹤的模型：

```text
這家公司為什麼要這個 role
-> 這個 candidate 哪些 evidence 能證明 fit
-> voice interview 應該測哪些 proof points
-> 每個回答到底有沒有對題、有沒有用對例子、有沒有證明 role intent
```

## 架構原則

### 1. 用 data-driven taxonomy，不要 hardcode 產業假設

不要在程式碼裡維護類似 `JD_CAPABILITY_TAXONOMY` 這種每個產業都要手改的 dict。

建議未來抽成資料層：

```text
job_industries
  -> capability_taxonomies
  -> role_intent_dimensions
  -> evidence_angle_definitions
  -> interview_probe_templates
```

系統根據 reviewed company context、JD context、role domain、user-confirmed role profile，在 runtime 載入對應 taxonomy。新增或修改產業時，應該是改資料或 admin config，不是改 backend source code。

### 2. 用 strategy registry 處理特殊 domain

有些 domain 需要特殊抽取或驗證，例如 healthcare、finance、education、safety-critical work。這類邏輯不要塞進同一個大型 parser。

後續可以加 strategy interface：

```text
JdExtractionStrategy
  -> extractCompanySignals()
  -> extractRoleIntent()
  -> buildEvidenceCriteria()
  -> validateUnsupportedClaims()
```

Generic strategy 是 default。特殊 domain strategy 要窄、獨立、可測，不能互相污染。

### 3. Router agent 只負責選路，不負責最後真相

Router agent 可以看 raw JD + company context，判斷這份 JD 比較像哪個 domain、需要哪個 taxonomy 或 strategy。

但 router 不應該直接成為 business truth。它只選路，後面還要經過 schema validation、critic、evidence check 和 human review。

建議流程：

```text
raw JD + company context
  -> router 判斷 domain / strategy / taxonomy
  -> selected strategy 產出 structured draft
  -> critic 檢查 evidence support
  -> user review company understanding 和 role intent
```

### 4. Voice-first 不能破壞 voice contract

後續所有 voice 改動都要保留：

- contentful low-confidence transcript 必須走 confirmation，不能直接 score 或丟掉。
- repair、confirmation、repeat、system、acknowledgement turn 不能算正式面試題。
- `user speech end -> next question first audio <= 3 seconds` 仍是 latency target。
- deterministic controller / ranker 決定要問什麼、為什麼問。
- LLM 主要負責把已選中的 question naturalize 成自然 spoken interviewer text。

## LLM / Human Review / Deterministic 的分工

| 區域 | 誰負責 | 原因 |
| --- | --- | --- |
| Raw JD cleanup 和 structured extraction | LLM draft + deterministic schema validation | JD 格式很亂，但輸出 shape 必須穩。 |
| Company understanding | LLM draft + human review | 公司理解可能錯，必須先讓使用者確認。 |
| Role purpose / business problem / workflow pain | LLM draft + critic + human review | 這些是 inference，不是硬事實。要有 evidence label。 |
| CV evidence extraction | Deterministic extraction + optional LLM normalization | CV evidence 必須能追回原始 CV。 |
| Evidence-to-role mapping explanation | LLM draft + deterministic grounding check | 需要語意推理，但不能產生 unsupported claim。 |
| Interview coverage contract | Deterministic planner | 系統必須知道這場 interview 要 cover 什麼，而且要可測。 |
| Question ranking | Deterministic scoring + data-driven taxonomy inputs | Ranking 要可解釋、可重跑、可 audit。 |
| Spoken question wording | LLM naturalization | Voice 要自然，但不能改變 selected intent。 |
| STT confidence handling | Deterministic state machine | 這是產品安全，不是模型偏好。 |
| Answer alignment diagnosis | Hybrid：deterministic signals + LLM explanation | Report 需要好懂的 coaching language，但分數維度要 bounded。 |
| Report QA / repair eligibility | Deterministic QA + LLM wording repair | deterministic integrity failure 不能被 rewrite 蓋掉。 |

## 目標資料契約

### CompanyUnderstandingProfile

用來表示 LLM 對公司的理解。這份資料必須讓 user review。

```json
{
  "schemaVersion": "company_understanding_v1",
  "companyName": "string",
  "companyWebsiteUrl": "string",
  "companySummary": "string",
  "businessModel": "string",
  "customersOrUsers": ["string"],
  "productsOrServices": ["string"],
  "operatingContext": ["string"],
  "hiringContextHypotheses": [
    {
      "hypothesis": "string",
      "evidence": ["string"],
      "confidence": "high | medium | low",
      "source": "company_website | jd | user_context | inferred"
    }
  ],
  "uncertainties": ["string"],
  "reviewStatus": "draft | user_confirmed | needs_revision"
}
```

### RoleIntentProfile

用來表示這個 role 為什麼存在，以及面試官可能想驗證什麼。

```json
{
  "schemaVersion": "role_intent_v1",
  "jdFingerprint": "string",
  "companyName": "string",
  "roleTitle": "string",
  "roleDomain": "string",
  "rolePurpose": {
    "shortStatement": "string",
    "confidence": "high | medium | low",
    "evidenceSource": "explicit_jd | company_context | inferred"
  },
  "businessProblemHypotheses": [
    {
      "id": "string",
      "problem": "string",
      "evidenceFromJD": ["string"],
      "evidenceFromCompany": ["string"],
      "confidence": "high | medium | low",
      "uncertainty": "string"
    }
  ],
  "workflowPainPoints": [
    {
      "id": "string",
      "painPoint": "string",
      "likelyImpact": "string",
      "evidence": ["string"],
      "confidence": "high | medium | low"
    }
  ],
  "idealCandidateSignals": [
    {
      "id": "string",
      "signal": "string",
      "whyItMatters": "string",
      "proofNeeded": ["string"]
    }
  ],
  "interviewProbeMap": [
    {
      "id": "string",
      "interviewerMayTest": "string",
      "strongEvidenceLooksLike": ["string"],
      "riskIfWeak": "string"
    }
  ],
  "reviewStatus": "draft | user_confirmed | needs_revision"
}
```

### CandidateEvidenceGraph

用來把 CV / user-added examples / transcript 轉成可重用 evidence items。第一版建議先用 CV evidence，user-added examples 放第二步。

```json
{
  "schemaVersion": "candidate_evidence_graph_v1",
  "cvFileId": "string",
  "evidenceItems": [
    {
      "evidenceId": "string",
      "source": "cv_project | cv_work_experience | cv_achievement | user_added_example | transcript",
      "title": "string",
      "rawSnippet": "string",
      "normalizedSummary": "string",
      "proofAngles": ["technical_ownership", "workflow_thinking", "communication"],
      "strengthSignals": {
        "specificity": 1,
        "outcomeEvidence": 1,
        "personalOwnership": 1,
        "roleRelevance": 1,
        "credibility": 1
      },
      "sourceTrace": {
        "documentId": "string",
        "section": "string",
        "chunkId": "string"
      }
    }
  ]
}
```

### RoleEvidenceMap

用來回答：這份 JD / role intent 對應到 candidate 哪些證據。

```json
{
  "schemaVersion": "role_evidence_map_v1",
  "roleIntentProfileId": "string",
  "cvFileId": "string",
  "requirementEvidence": [
    {
      "requirementId": "string",
      "roleIntentSignalIds": ["string"],
      "topEvidence": [
        {
          "evidenceId": "string",
          "fitType": "direct | adjacent | weak | gap",
          "score": 0.82,
          "whyItWorks": "string",
          "howToSayIt": "string",
          "angleWarnings": ["string"]
        }
      ]
    }
  ],
  "gaps": [
    {
      "id": "string",
      "gap": "string",
      "risk": "high | medium | low",
      "canUseAdjacentEvidence": true,
      "recommendedAction": "string"
    }
  ],
  "reviewStatus": "draft | user_confirmed | needs_revision"
}
```

### InterviewProofStrategy

用來控制 interview 要 cover 哪些 role intent、evidence、gap。Live interview 不顯示 recommended evidence，但 metadata 要存起來給 report。

```json
{
  "schemaVersion": "interview_proof_strategy_v1",
  "sessionId": "string",
  "targetRoleIntentIds": ["string"],
  "mustCover": [
    {
      "type": "role_intent | gap_validation | communication | evidence_depth",
      "id": "string",
      "minQuestions": 1,
      "requiredEvidenceOptions": ["string"],
      "allowAdjacentEvidence": true
    }
  ],
  "avoidOveruse": {
    "maxSameEvidenceRoot": 2,
    "maxSameAngle": 1
  },
  "voiceInterviewPolicy": {
    "doNotShowRecommendedEvidenceDuringInterview": true,
    "storeReasoningForReport": true
  }
}
```

### AnswerAlignment

用來評估每一題回答有沒有對題、有沒有用對 evidence、有沒有證明 role intent。

```json
{
  "schemaVersion": "answer_alignment_v1",
  "turnId": "string",
  "questionId": "string",
  "questionIntent": "validate_requirement | risk_probe | behavioural_star | motivation | self_intro",
  "testedRoleIntentIds": ["string"],
  "expectedSignals": ["string"],
  "candidateAnswerSummary": "string",
  "detectedEvidenceUsed": [
    {
      "evidenceId": "string",
      "confidence": "high | medium | low",
      "angleUsed": "string"
    }
  ],
  "alignmentScores": {
    "questionAlignment": 1,
    "evidenceFit": 1,
    "evidenceClarity": 1,
    "roleIntentFit": 1,
    "naturalness": 1,
    "improvementAction": 1
  },
  "diagnosis": {
    "mainIssue": "string",
    "missedSignal": "string",
    "overuseRisk": "low | medium | high"
  },
  "betterAnswerPlan": {
    "useSameExample": true,
    "changeAngleTo": "string",
    "structure": "CAR | STAR | direct",
    "spokenRewrite": "string"
  }
}
```

## Phase-by-phase 實作路線

### Phase 0：Baseline 和 contracts

目的：先凍結現在行為，定義新資料契約，不直接動 runtime。

要做：

- 寫 Role-Fit Intelligence goal / spec。
- 加 schema contract tests。
- 加 mock fixtures：JD + company context + CV evidence + transcript alignment。
- 記錄現有 Kiwi baseline metrics。

驗證：

- 現有 backend question / report / voice robustness tests 仍然通過。
- 新 contract tests 可以先標成 pending 或 expected failure，避免假裝功能已完成。

回退：

- 移除新增 docs / tests / contracts，不影響 runtime。

### Phase 1：Company understanding + Role Intent Decoder

目的：Role-Fit flow 要求 company context，並產出可 review 的 company understanding 和 role intent。

Backend：

- 新增 `companyUnderstandingService`。
- 新增 `roleIntentDecoderService`。
- 新增 `roleIntentCriticService`。
- 新增 schema builders / validators。
- 擴充 JD parse response，回傳 `companyUnderstandingProfile` 和 `roleIntentProfile`。
- 保留原本 structured JD rubric，不要一開始就替換掉。

Frontend：

- JD review UI 加上 required company website / company context。
- 新增 `Review company understanding`。
- 新增 `Why this role exists`。
- 顯示 evidence labels：`Directly stated`、`Company context`、`Reasonable inference`、`Need confirmation`。

驗證：

- JD parse tests 確認 role intent 沒有被 user review 前不能算 confirmed。
- Prompt injection tests 確認 unsupported company / role claims 會降級。
- UI tests 確認 Role-Fit path 在 required review 沒完成前不能開始。

回退：

- 用 feature flag 關掉 Role-Fit JD path，回到現有 JD rubric review。

### Phase 2：Candidate Evidence Graph + Role Evidence Map

目的：把 CV evidence 轉成可重用 evidence items，並 map 到 role intent、JD requirements、gaps、proof angles。

Backend：

- 新增 `candidateEvidenceGraphService`。
- 新增 `roleEvidenceMapperService`。
- 新增 `evidenceAngleClassifierService`。
- 優先 reuse 現有 CV evidence profile，不重複 parse raw CV。
- 每個 evidence map item 都要能追回 CV / user source evidence。

Frontend：

- Match result 加上 `Best evidence for this role`。
- 顯示 `why it works`、`how to say it`、`risk/gap`。
- 使用者可以修正 evidence summary / angle，但不要直接暴露內部 raw hidden data。

驗證：

- CV / match robustness tests 確認 evidence item 非空、source-linked、不 invent。
- Mapping tests 確認 direct / adjacent / weak / gap cases 都能處理。

回退：

- 保留現有 CV-JD match response。新 artifact 不存在或 invalid 時隱藏 evidence map UI。

### Phase 3：Proof Strategy Planner + voice-first question metadata

目的：產出 interview proof strategy，讓 question selection 有 role intent coverage，但 live interview 不顯示 recommended evidence。

Backend：

- 新增 `roleSpecificPracticePlannerService`。
- 新增 `interviewCoverageContractService`。
- 新增 `evidenceUsageLedgerService`。
- 擴充 prepared question pool metadata：
  - `testedRoleIntentIds`
  - `recommendedEvidenceIds`
  - `evidenceAngle`
  - `coverageContractIds`
- 擴充 question ranking：
  - `roleIntentCoverageBoost`
  - `evidenceMapStrength`
  - `unmetCoverageBoost`
  - `gapRiskBoost`
  - `evidenceOverusePenalty`

Frontend：

- 新增 pre-interview `Proof Strategy` review panel。
- Voice mode live UI 保持自然，不提示 recommended evidence。
- 存 question reasoning 給 report 和 diagnostics。

驗證：

- Question pool tests 確認 coverage contract metadata。
- Ranker tests 確認 unmet role intent 和 unresolved gaps 會影響 ranking。
- Voice tests 確認 metadata 不破壞 turn counting、transcript confirmation、latency traces。

回退：

- Proof strategy invalid 時，回到現有 prepared question pool ranking，並記錄 degraded readiness。

### Phase 4：Answer Alignment Report

目的：讓 report 明確告訴使用者每一題是否回答到問題、是否用對 evidence、是否證明 role intent、是否自然。

Backend：

- 新增 `answerAlignmentEvaluatorService`。
- 新增 `evidenceUsageDetectorService`。
- 新增 `answerRewriteCoachService`。
- 新增 `roleIntentCoverageReportService`。
- 在 accepted-answer pairing 之後整合 AnswerAlignment。
- deterministic report scores 和 QA integrity checks 仍然是權威。

Frontend：

- 新增 `AnswerAlignmentCard`。
- 新增 `EvidenceUsageMap`。
- 新增 `RoleIntentCoverageSection`。
- 擴充 turn breakdown：
  - question intent
  - evidence used
  - why it fit or missed
  - better spoken answer

驗證：

- Report tests 確認 repair / confirmation / system turns 不進 scoring。
- Alignment tests 確認 unsupported evidence 不會被標成 confirmed。
- QA tests 確認 answer rewrites 是 readable English，且不 invent facts。

回退：

- Alignment generation 失敗時，report 仍可用現有 sections，顯示 `alignment unavailable`。

### Phase 5：Voice-first quality hardening

目的：讓 Role-Fit Intelligence 在 live voice practice 裡穩定。

Backend：

- 確保 role-fit metadata 能穿過 duplex voice flow 和 transcript storage。
- 必要時加 role-fit trace markers 到 voice latency summary。
- 保留 low-confidence contentful transcript confirmation path。
- 只做 conservative transcript repair，修常見 ASR substitution，不改意思，保留 raw text。

Frontend：

- Voice UI 保持簡潔。
- Role-fit reasoning 只在 interview 後顯示，不在 live answer 時顯示。
- Recording status 和 report status 繼續分開。

驗證：

- Voice robustness tests 覆蓋 contentful low-confidence transcript confirmation。
- Live voice E2E 只在 credentials 和使用者明確批准後跑。

回退：

- Role-fit metadata 可關閉，不影響正常 voice interview。

### Phase 6：Evaluation dataset 和產品證明

目的：證明新版 Role-Fit 比 generic prompt 和現有 Kiwi 更能改善 role understanding、evidence selection、question relevance、report usefulness。

比較組：

- Generic ChatGPT prompt。
- Existing Kiwi baseline。
- Kiwi Role-Fit version。

指標：

- Role intent clarity score。
- Top-1 / Top-3 evidence mapping usefulness。
- Question relevance score。
- Gap coverage rate。
- Duplicate question rate。
- Answer alignment usefulness。
- Cost per session。
- Median time to report。
- Voice latency distribution。

驗證：

- 至少建立 20 組 CV/JD labelled cases，再做強 claims。
- Competitor observation 只能當 qualitative observation，不能寫成大規模市場結論。

回退：

- Evaluation artifacts 是 additive，不影響 runtime。

## 會牽涉到的產品 features

| Feature | 影響 |
| --- | --- |
| JD intake | Role-Fit flow 需要 company website / company context；現有 pasted JD parse 可暫時保留為 fallback。 |
| Company research/context | 從 optional support 變成 Role-Fit session 的 reviewed input。 |
| JD review | 新增 company understanding 和 role intent review。 |
| CV review | 會餵給更強的 evidence graph；後續可能讓 user 補充或確認 evidence summary。 |
| CV-JD match | 從 score / strengths / gaps 升級成 requirement-to-evidence 和 role-intent-to-evidence mapping。 |
| Question preparation | 新增 proof strategy、role intent coverage、evidence angle metadata、overuse prevention。 |
| Voice interview | 變成 primary experience，但必須保留 state machine、confidence gate、latency constraints。 |
| Text interview | 保留為 fallback 和 regression path。 |
| Interview diagnostics | 需要更完整的 question reasoning、top candidates、selected role intent、evidence angle、coverage trace。 |
| Report generation | 新增 answer alignment、role intent coverage、evidence usage map、better spoken answer coaching。 |
| Report QA | 要驗證 alignment claims、evidence references、rewrite quality、unsupported role-intent claims。 |
| Data persistence | 可能新增或嵌入 company understanding、role intent、evidence map、proof strategy、usage ledger、answer alignment。 |
| Evaluation | 新增 role-fit labelled datasets、baseline comparison、usefulness metrics。 |
| Privacy/security | 必須維持 candidate-side coaching，不做 employer-side screening 或 hiring-decision automation。 |

## 預期會動到的檔案區域

Backend：

- `backend/src/controllers/jobDescriptionController.js`
- `backend/src/services/jobDescription/`
- `backend/src/services/company/`
- `backend/src/services/cv/`
- `backend/src/services/evidence/`
- `backend/src/services/match/`
- `backend/src/services/questions/`
- `backend/src/services/voice/`
- `backend/src/services/report/`
- `backend/src/services/agents/reportGeneratorAgent.js`
- `backend/src/db/models/`
- `backend/tests/robustness/jd`
- `backend/tests/robustness/cv`
- `backend/tests/robustness/match`
- `backend/tests/robustness/questions`
- `backend/tests/robustness/voice`
- `backend/tests/robustness/report`
- `backend/eval/`

Frontend：

- `frontend/src/pages/AnalyzePage.jsx`
- `frontend/src/pages/InterviewPage.jsx`
- `frontend/src/pages/ReportPage.jsx`
- `frontend/src/components/analyze/`
- `frontend/src/components/interview/`
- `frontend/src/components/report/`
- `frontend/src/hooks/useInterviewSession.js`
- `frontend/src/hooks/useVoiceInterviewSession.js`
- `frontend/src/hooks/voice/`
- `frontend/src/utils/jobDescriptionViewModel.js`
- `frontend/src/utils/matchResultViewModel.js`
- `frontend/src/utils/reportView/`
- `frontend/src/api/`

Docs：

- `docs/implementation-workflows.md`
- `docs/code-document-alignment.md`
- `repo-docs/`

這些 docs 只能在功能真的 ship 後更新。現在這份文件必須保持「proposed plan」狀態，不能寫成 implemented。

## Non-goals

- 不做 employer-side candidate screening。
- 不做 hiring decision automation。
- 不產生 unsupported company intent claims。
- 不用 prompt 邏輯取代 voice state machine。
- 不把每個產業能力分類 hardcode 到 backend source。
- 不在 live voice answer 時顯示 recommended evidence。
- 不把 real AI provider eval 當成日常 local verification。
- 不宣稱尚未實作的 privacy / compliance guarantees。

## 建議實作順序

1. 寫 goal 和 spec 文件。
2. 加 schema contracts 和 mock fixtures。
3. 實作 company understanding + role intent review。
4. 實作 candidate evidence graph + role evidence map。
5. 實作 proof strategy + question metadata。
6. 整合 voice-first question ranking 和 reasoning traces。
7. 實作 answer alignment report。
8. 建 evaluation dataset 和 baseline comparison。
9. 功能驗證後再同步 `repo-docs/` 和 alignment docs。

## Definition of Done

- Role-Fit path 不能基於未 review 的 company understanding 或 role intent 繼續。
- 每個 role intent inference 都有 evidence 和 confidence label。
- 每個 evidence recommendation 都能追回 candidate source evidence。
- Voice interview 保持自然，不在 live answer 時提示 recommended evidence。
- Question selection 存下為什麼問這題、測哪個 role/evidence target。
- Report 用英文解釋 answer alignment、evidence fit、role intent fit、better spoken answer。
- Unsupported claims 會被 downgrade、block 或送 review。
- 新 Role-Fit artifact 缺失時，現有 fallback path 仍可用。
- 每個 phase 都有 focused tests 和 rollback path。
