# Role-Fit Intelligence Feature Gap Audit

狀態：現況審核與 spec 前置資料，尚未實作  
日期：2026-07-10  
關聯總計畫：`docs/2026-07-10-role-fit-intelligence-implementation-plan.md`

## 結論

目前的總 plan 足夠定義方向、phase 和產品原則，但不夠直接寫 implementation-grade goal / spec。

原因是這次不是單一功能新增，而是整個產品從「CV-JD match + interview practice」升級成「company / role intent / candidate evidence / voice-first proof strategy / answer alignment」的完整路徑。現有 code 已經有很多可沿用的基礎，如果 spec 只照總 plan 寫，容易漏掉既有 gating、question pool、voice state machine、report QA、persistence、frontend view model 這些細節。

因此 goal / spec 應該基於三份材料一起寫：

1. `docs/recommend_plan.md`：原始 Role-Fit 產品方向。
2. `docs/2026-07-10-role-fit-intelligence-implementation-plan.md`：總 phase plan。
3. 本文件：逐 feature 對照 current code 的問題點、gap、要補的契約、驗證方式與回退方式。

## Audit Scope

這份 audit 對照的 feature 範圍包括：

| Feature area | 目前主要 source truth |
| --- | --- |
| Analyze workflow / gating | `frontend/src/pages/AnalyzePage.jsx`, `frontend/src/components/analyze/*` |
| JD parse / review | `backend/src/controllers/jobDescriptionController.js`, `backend/src/services/jobDescription/*`, `frontend/src/components/analyze/JobContextCard.jsx` |
| Company context | `backend/src/services/company/*`, `backend/src/db/models/companyValuesProfileModel.js` |
| CV evidence | `backend/src/services/cv/*`, `frontend/src/components/analyze/CVManagementCard.jsx` |
| Match / evidence matching | `backend/src/services/matchService.js`, `backend/src/services/match/*`, `frontend/src/utils/matchResultViewModel.js` |
| Capability taxonomy | `backend/src/services/match/capabilityTaxonomy.js`, `backend/src/services/cv/cvCapabilityExtractor.js` |
| Question pool / ranking | `backend/src/services/questions/*`, `backend/src/db/models/interviewQuestionPoolItemModel.js` |
| Interview session plan | `backend/src/controllers/analyzeController.js`, `backend/src/services/session/*`, `backend/src/db/models/interviewPlanModel.js` |
| Voice runtime | `backend/src/services/voice/*`, `frontend/src/hooks/useVoiceInterviewSession.js` |
| Interviewer decision trace | `backend/src/services/agents/interviewerAgent.js`, `backend/src/services/aiControl/*` |
| Report generation / QA | `backend/src/services/agents/reportGeneratorAgent.js`, `backend/src/services/agents/reportQaAgent.js`, `backend/src/services/report/*` |
| Report UI | `frontend/src/pages/ReportPage.jsx`, `frontend/src/utils/reportView/viewModel.js`, `frontend/src/components/report/*` |
| Tests / evals | `backend/tests`, `frontend/src/**/*.test.*`, `eval/`, e2e scripts |

## 全產品 Gap Map

| Feature | 現況 | Role-Fit 目標缺口 | Spec 要補的東西 |
| --- | --- | --- | --- |
| Analyze workflow | CV review、JD review、session setup、match result 已存在 | 沒有 company understanding review、role intent review、proof strategy readiness | 新增 prep states、review gates、feature flag、fallback path |
| JD parse | `paraphraseJD(rawJD)` 只 parse JD | company website / context 沒參與 JD parse；company 理解不是 required | 新 endpoint 或擴充 payload，產出 reviewable company understanding |
| Company context | company values enrichment 是 background / best-effort | 只做 values / culture，不保證 role intent 可用；缺 user confirmation | `CompanyUnderstandingProfile`，required gate，manual fallback contract |
| CV evidence | deterministic evidence profile 已有 | 缺 candidate evidence graph、proof angle、evidence-to-role explanation | `CandidateEvidenceGraph`，review / grounding strategy |
| Capability taxonomy | `CAPABILITY_TAXONOMY` hardcoded | 不適合所有 job seekers / industries，維護成本高 | database-driven taxonomy + strategy registry + router |
| Match result | requirement checks、semantic evidence matches 已有 | 沒有以 role intent 為中心的 evidence map | `RoleEvidenceMap` artifact，match/report 共用 |
| Question pool | source priority、readiness、novelty filtering 已有 | 沒有 interview proof strategy / role intent coverage contract | `InterviewProofStrategy`，question metadata v3 |
| Voice interview | state machine、STT confirmation、TTS、latency trace 已有 | role-fit metadata 尚未流入 selection / diagnostics；不能在 live prompt 暴露 evidence hint | precomputed strategy + metadata-only integration |
| Question reasoning | `questionDecision`、rank trace 已有 | trace 還沒說明 tested role intent / selected evidence angle | extend trace and diagnostics |
| Report | accepted-answer dataset、rubric、QA 已有 | 沒有 answer alignment：回答是否證明該 role intent | `AnswerAlignment` + role coverage report sections |
| Report QA | grounded claims / repair 已有 | 不檢查 alignment claim、company claim、role intent coverage | QA rule extensions |
| Frontend report | turn breakdown、evidence sources、risks 已有 | 缺 role intent reasoning、evidence usage map、alignment cards | 新 view model fields and report sections |
| Persistence | InterviewPlan / question pool / company values profile 已有 | 新 artifacts 沒有 ownership、retention、schema version | new schemas or versioned embedded artifacts |
| Tests | 多數 pipeline 有 unit / robustness / e2e 基礎 | 新 review gates、role-fit artifacts、voice metadata、report alignment 沒測 | phased test matrix |

## Feature 1: Analyze Workflow / Gating

### Current behavior

目前 `AnalyzePage.jsx` 的核心狀態是：

- `rawJD`
- `structuredJD`
- `structuredJDRubric`
- `jdReviewStatus`
- `cvReviewStatus`
- `voiceDeviceCheck`
- `analysisResult`
- `generatedSessionId`

`handleGeneratePlan` 目前只 gate：

- 有 selected CV 和 raw JD。
- CV parse 已 human reviewed。
- JD summary 是 current。
- JD summary 已 reviewed。
- session setup / voice readiness 由 UI 行為輔助，但不是 role-fit gate。

### Current gaps

- `companyWebsiteUrl` 現在在 `JobContextCard.jsx` 裡顯示為 `Company website URL (optional)`。
- `handleConfirmJDSummary` 會在 JD reviewed 後啟動 company values enrichment，但這是 background / best-effort。即使 enrichment 沒開始，JD 仍然可以進入 matching。
- workflow steps 沒有 company understanding review、role intent review、proof strategy review。
- `AnalyzeActionsCard` 的 readiness checklist 不知道 company / role intent / evidence map 是否 ready。

### Required upgrade

新增 Role-Fit prep state：

```text
companyContextStatus: missing | draft | needs_review | user_confirmed
roleIntentStatus: not_started | draft | needs_review | user_confirmed
roleEvidenceMapStatus: not_started | ready | degraded | failed
proofStrategyStatus: not_started | ready | degraded | failed
```

新的 generate plan gate：

1. CV reviewed。
2. JD reviewed。
3. Company context reviewed。
4. Role intent reviewed。
5. Role evidence map ready 或明確 degraded fallback。
6. Voice mode 下 device check ready。

### UX impact

可以不要增加太多頁面。建議把 JD Review 擴成 `Job + Company Understanding` review：

- JD parsed fields。
- Company understanding draft。
- Role intent draft。
- User 可以 edit / confirm。
- UI 文案必須英文。

### Rollback

加 feature flag，例如：

```text
ROLE_FIT_PREP_ENABLED=false
```

flag off 時保留現有 CV review -> JD review -> match -> interview path。

### Verification

- Frontend unit test：缺 company context 時不能 generate plan。
- Frontend unit test：company / role intent confirmed 後才能 generate plan。
- Integration test：flag off 時舊 flow 不受影響。

## Feature 2: JD Parse + Company Understanding

### Current behavior

`jobDescriptionController.paraphraseJD` 目前只要求 `rawJD`：

```text
rawJD -> buildGuardedStructuredJobDescriptionRubric -> structuredJD / structuredJDRubric
```

company context 走另一個 endpoint：

```text
startCompanyValuesForReviewedJD(rawJD, jdRubric, companyWebsiteUrl)
```

### Current gaps

- JD parse 沒有拿到 company website / company context。
- LLM 對公司的理解沒有在 JD parse 後產出給 user review。
- `CompanyValuesProfile` 是 values / mission / culture notes，不等於 Role-Fit 需要的 company understanding。
- 目前沒有 `source: company_website | jd | user_context | inferred` 這類 evidence label。

### Required upgrade

新增或擴充 JD parse response：

```text
rawJD + companyWebsiteUrl + optionalUserCompanyContext
  -> structuredJDRubric
  -> CompanyUnderstandingProfile draft
  -> RoleIntentProfile draft
  -> safeguard / critic diagnostics
```

最小安全做法是新增 endpoint，不直接破壞現有 `paraphraseJD`：

```text
POST /api/jd/role-fit/parse
```

或在現有 endpoint 增加 role-fit mode：

```json
{
  "rawJD": "...",
  "companyWebsiteUrl": "https://example.com",
  "userCompanyContext": "...",
  "mode": "role_fit"
}
```

### LLM / Human / Deterministic split

| Part | Owner |
| --- | --- |
| Extract messy JD fields | LLM draft + deterministic schema validation |
| Company understanding | LLM draft + human review |
| Role purpose / business hypotheses | LLM draft + critic + human review |
| Review status and gating | deterministic code |
| Unsupported claim detection | deterministic checks + critic |

### Verification

- Unit test：missing `companyWebsiteUrl` and missing manual context returns review-blocking status。
- Contract test：response always includes `CompanyUnderstandingProfile.reviewStatus`。
- Snapshot test：company understanding never claims unsupported facts without source labels。

## Feature 3: Company Context / Website Requirement

### Current behavior

`companyValuesEnrichmentService` 可以：

- resolve official website。
- fetch pages。
- extract values。
- save `CompanyValuesProfile`。
- fallback when company name / website / pages / confidence are missing。

`shouldStartCompanyValuesEnrichment` allows enrichment when JD is human reviewed or manual website exists。

### Current gaps

- Company website / context 是 optional，不是 Role-Fit gate。
- Enrichment failure currently produces fallback values, not a required user-review problem。
- Current model is values-centric: `values`, `mission`, `cultureNotes`。
- Role-Fit needs business model、customers/users、products/services、operating context、hiring context hypotheses。
- Current background job timing is not reliable enough to block parse/review if the user must confirm company understanding before matching。

### Required upgrade

建議拆成兩層：

1. `CompanyValuesProfile`：保留現有 report / motivation fit 用途。
2. `CompanyUnderstandingProfile`：新增 Role-Fit prep artifact，必須 user reviewed。

如果 company website 不可用，為了支援所有 job seekers，建議 spec 定義：

```text
Required company context = official website OR user-provided company context.
```

否則很多 public sector、agency、confidential recruiter、small business JD 會被完全卡住。

### Rollback

- 保留 company values enrichment 作為 non-blocking coaching enhancement。
- 新 Role-Fit gate 在 flag off 時完全不啟用。

### Verification

- Backend test：website provided but fetch fails -> user review artifact shows uncertainty and blocks auto-confirm。
- Backend test：manual company context provided -> can produce company understanding with `source=user_context`。
- Frontend test：user cannot proceed until company understanding confirmed。

## Feature 4: CV Review / Candidate Evidence Graph

### Current behavior

CV pipeline 已經有很好的基礎：

- `buildCvEvidenceProfile` extracts `evidenceItems`、tools、domains、responsibility signals、achievement signals。
- `cvReviewedProfileService` rebuilds evidence profile after user edits CV review fields。
- `cvQuestionSeedService` turns evidence profile into question seeds。

### Current gaps

- Evidence profile 是 extraction artifact，不是 role-fit graph。
- 沒有 proof angle，例如「這段 evidence 能證明 stakeholder communication」或「這段只證明 tool exposure，不證明 business impact」。
- User review 目前是 CV field review，不是 evidence graph review。
- `inferDomain` 和 `CAPABILITY_TAXONOMY` 仍有 regex / hardcoded assumptions。

### Required upgrade

新增 `CandidateEvidenceGraph`，由 deterministic extraction + optional LLM normalization 組成：

```text
CV reviewed profile
  -> deterministic evidence items
  -> evidence graph nodes
  -> evidence quality / proof type
  -> role-fit mapping candidate inputs
```

建議先不要要求 user 審每一個 evidence node，避免 prep flow 太重。第一版可以：

- User review CV profile fields。
- 系統自動產 evidence graph。
- Report 顯示 evidence 使用理由。
- 只有當 evidence graph confidence 太低時要求 user 補例子。

### Verification

- Unit test：reviewed CV profile changes rebuild evidence graph。
- Unit test：each graph node has source section and traceable CV text。
- Regression test：existing match still works if graph is missing and flag off。

## Feature 5: Data-Driven Taxonomy / Strategy Registry / Router

### Current behavior

`backend/src/services/match/capabilityTaxonomy.js` 現在是 source-code dict：

```text
automation -> phrases
data_cleaning -> phrases
process_improvement -> phrases
...
```

CV evidence builder 也有 regex domain inference：

```text
customer_service / marketing / healthcare / education / finance / data / software
```

### Current gaps

- 不適合所有 job seekers。
- 每新增 domain 都要改 backend source code。
- 容易變成使用者截圖裡說的 hardcoded rule / prompt / dict spaghetti。
- 現有 taxonomy 不是 versioned data，也不能由 admin 或 seed data 管理。

### Required upgrade

建議加三層：

1. Database-driven taxonomy：

```text
job_industries
capability_taxonomies
role_intent_dimensions
evidence_angle_definitions
interview_probe_templates
```

2. Strategy registry：

```text
generic
healthcare
finance
education
safety_critical
```

3. Router agent：

```text
raw JD + company context -> domain / strategy / taxonomy selection
```

Router 只能選路，不能直接成為 business truth。最後輸出仍要：

- schema validation。
- critic。
- human review。
- deterministic fallback。

### Spec decision needed

目前 repo 同時使用 MongoDB models 和其他 persistence patterns。正式 spec 要決定 taxonomy 放哪裡：

- Recommended：Mongo collection + versioned seed JSON。
- 理由：runtime 可 query，seed 可 review / rollback，未來 admin UI 可擴充。

### Verification

- Unit test：missing taxonomy falls back to generic。
- Unit test：router selected strategy invalid -> generic fallback。
- Regression test：existing hardcoded taxonomy can be disabled only after new taxonomy test coverage passes。

## Feature 6: Match / Role Evidence Map

### Current behavior

Match pipeline 目前做：

- `runCvJdMatchAnalysis`
- semantic evidence context。
- requirement checks。
- strengths / gaps / risks。
- match score。
- question plan hints。

`semanticEvidenceService` 已能把 JD requirements 對到 CV evidence candidates。

### Current gaps

- 現有 evidence map 是 requirement-centric，不是 role-intent-centric。
- 沒有回答「這家公司為什麼問這個 role、candidate 哪些 evidence 能證明 fit」。
- `matchResultViewModel` 顯示 score / evidence confidence / requirement checks，但不是 interview proof strategy。
- Report 和 interview question selection 不能共用同一份 role evidence map。

### Required upgrade

新增 `RoleEvidenceMap`：

```text
RoleIntentProfile + CandidateEvidenceGraph
  -> role intent dimension
  -> candidate evidence candidates
  -> evidence strength
  -> proof angle
  -> gap / risk
  -> recommended interview probe
```

這份 map 應該成為下游共用 source：

- Match result 顯示 high-level role-fit readiness。
- Question pool 用它產 proof strategy。
- Report 用它判斷 answer alignment。

### Verification

- Contract test：每個 high-priority role intent 至少有 `strong | partial | missing` status。
- Contract test：每個 mapped evidence 都能回到 CV source text。
- UI test：match page 不暴露 live interview evidence hints，只顯示 prep-level summary。

## Feature 7: Interview Proof Strategy / Question Pool

### Current behavior

Question pool 已有：

- source priority。
- prepared question pool。
- match gap question。
- requirement validation question。
- CV seed question。
- common template。
- novelty filtering。
- readiness checks。

`questionPoolRankerService` 目前用 priority、coverage、risk、mode fit、missing evidence、freshness、time fit 來 score。

### Current gaps

- 沒有 `InterviewProofStrategy`。
- question pool item 沒有 `testedRoleIntentIds`、`recommendedEvidenceIds`、`evidenceAngle`、`proofPointId`。
- readiness 目前主要看 question count / novelty，不看 role intent coverage。
- rank trace 不知道「這題為什麼是對這個 company / role 的 proof point」。

### Required upgrade

新增 precomputed proof strategy：

```text
RoleEvidenceMap
  -> proof points
  -> must-cover role intents
  -> question candidates
  -> expected answer evidence shape
  -> coverage and fallback rules
```

Question pool schema v3 建議加：

```json
{
  "proofPointId": "string",
  "testedRoleIntentIds": ["string"],
  "recommendedEvidenceIds": ["string"],
  "evidenceAngle": "string",
  "coveragePriority": "must_cover | should_cover | optional",
  "roleFitReason": "string"
}
```

### Voice-first constraint

這些 metadata 不能在 live interview 直接提示使用者：

- 不說「請用某某 project」。
- 不說「這題測 proof point A」。
- 只讓 interviewer 問自然問題。

Reasoning 放到 report / diagnostics。

### Verification

- Unit test：must-cover role intents produce at least one active question。
- Unit test：ranker boosts uncovered must-cover proof points。
- Integration test：question pool v2 sessions still run。

## Feature 8: Interview Plan Persistence / Backward Compatibility

### Current behavior

`InterviewPlan` schema 已有：

- `strategy` mixed。
- `questionPlanSnapshot` mixed。
- `questionPool` embedded schema。
- `schemaVersion: v3`。

`InterviewQuestionPoolItem` model 已有 richer fields：

- `schemaVersion: v2`
- `sourceStage`
- `questionRole`
- `questionFamily`
- `evidenceMode`
- `rankTrace`
- `metadata`

### Current gaps

- Embedded `InterviewPlan.questionPool` schema 比 `InterviewQuestionPoolItem` model 更舊。
- 新 Role-Fit artifacts 沒有正式 ownership。
- 需要支援 existing sessions / existing reports 讀舊資料。

### Required upgrade

Spec 要決定：

1. 新 artifacts 是 embedded 在 `SessionAnalysis` / `InterviewPlan`，還是獨立 model。
2. Question pool v3 是擴展 existing `InterviewQuestionPoolItem`，還是另開 Role-Fit proof point collection。
3. Existing v2 question pool 如何 fallback。

Recommended：

- `CompanyUnderstandingProfile` and `RoleIntentProfile` 可以獨立 model 或 embedded in match analysis，因為要 user review。
- `RoleEvidenceMap` 可以 attached to match analysis。
- `InterviewProofStrategy` attached to interview plan。
- Question pool item 用 backward-compatible optional fields。

### Verification

- Migration-free tests：old sessions load without role-fit fields。
- New session test：role-fit fields persist and survive `sessionViewBuilder` sanitize。
- Privacy test：new artifacts respect userId / sessionId ownership。

## Feature 9: Voice Runtime

### Current behavior

Voice runtime 已經有重要產品契約：

- STT confidence gate。
- transcript confirmation。
- repair / clarification / repeat / bridge acknowledgement 不算正式題。
- TTS streaming。
- latency traces。
- phrase hints。

`duplexTurnCoordinator` 負責 speech-to-turn orchestration。`interviewerAgent` 和 question pool 決定下一題。

### Current gaps

- Voice runtime 沒有 role-fit strategy metadata。
- Speech phrase hints 還沒有加入 role intent / company understanding / evidence graph 的安全短語。
- Live interview 不應顯示 evidence hint，但 backend trace 要記錄 role-fit reasoning。
- 如果把 Role-Fit LLM 推理放在每次 voice turn 即時計算，可能破壞 latency target。

### Required upgrade

Voice-first 實作原則：

```text
Before interview:
  precompute role evidence map and proof strategy

During voice turn:
  deterministic ranker selects next proof point / question
  LLM only naturalizes selected question wording
  STT / TTS state machine unchanged

After interview:
  report shows reasoning and alignment
```

### Verification

- Voice e2e：role-fit metadata exists but live prompt does not expose recommended evidence。
- Voice robustness：low-confidence contentful transcript still requires confirmation。
- Latency check：precomputed strategy avoids extra model calls in turn selection path。

## Feature 10: Interviewer Decision Trace / Diagnostics

### Current behavior

`interviewerAgent` already builds `questionDecision` with:

- selected question。
- source policy。
- evidence package。
- top root candidates。
- rank trace。
- selected angle。
- short reason。
- latency。

`interviewQuestionDiagnosticsService` can summarize question selection diagnostics。

### Current gaps

- Trace does not include role intent IDs。
- Trace does not include proof point ID。
- `microPlanEvidenceUsed` is from naturalization, not a durable RoleEvidenceMap reference。
- Report cannot reliably explain why a question was asked in Role-Fit terms。

### Required upgrade

Extend `questionDecision` with:

```json
{
  "proofPointId": "string",
  "testedRoleIntentIds": ["string"],
  "recommendedEvidenceIds": ["string"],
  "evidenceAngle": "string",
  "roleFitReason": "string",
  "coverageBefore": {},
  "coverageAfter": {}
}
```

### Verification

- Unit test：selected question carries proof metadata when available。
- Diagnostics test：report-safe reasoning excludes internal prompt text。
- Regression test：old questions without proof metadata still produce valid report。

## Feature 11: Report / Answer Alignment

### Current behavior

Report pipeline already has:

- accepted-answer dataset。
- deterministic turn rubrics。
- STARR / self intro / company motivation / role-specific scoring。
- evidence signal extraction。
- deterministic feedback。
- LLM candidate feedback。
- claim grounding。
- QA and bounded repair。

### Current gaps

- Report does not answer: did this answer prove the role intent the question was testing?
- `companyMotivationFit` is useful but narrow。
- No answer-level map between question proof point、candidate answer、CV evidence、role intent。
- Current turn breakdown tells structure quality, not role-fit alignment quality。

### Required upgrade

Add `AnswerAlignment` for accepted answer pairs only:

```json
{
  "questionId": "string",
  "proofPointId": "string",
  "testedRoleIntentIds": ["string"],
  "candidateAnswerSummary": "string",
  "alignmentScore": 0,
  "alignmentLabel": "strong | partial | weak | off_target",
  "usedEvidenceIds": ["string"],
  "missingProof": ["string"],
  "reasoning": "string",
  "betterAnswerDirection": "string"
}
```

Score scale should be decided in spec. Recommended:

- Internal score: `0-100` for consistency with existing score display。
- Report label: `strong | partial | weak | off_target` for user readability。

### LLM / Deterministic split

| Part | Owner |
| --- | --- |
| Accepted-answer pairing | deterministic |
| Role intent / proof point lookup | deterministic |
| Signal extraction from answer | deterministic + bounded NLP |
| Alignment explanation | LLM draft |
| Unsupported evidence claims | deterministic grounding / QA |

### Verification

- Unit test：repair / confirmation / repeat turns never get AnswerAlignment。
- Unit test：answer with no role evidence returns weak / off_target, not invented support。
- Report snapshot：shows reasoning in English。

## Feature 12: Report QA / Grounding

### Current behavior

Report QA already checks:

- missing sections。
- metric mismatch。
- rewrite safety。
- rubric mismatch。
- evidence references。
- transcript risks。
- trust fields。

### Current gaps

- QA does not validate RoleIntentProfile references。
- QA does not validate AnswerAlignment support。
- QA does not validate company understanding claims against reviewed company profile。
- QA does not validate evidence ID usage in report UI fields。

### Required upgrade

Add QA checks:

```text
role_intent_reference_missing
answer_alignment_without_proof_point
alignment_claim_not_grounded
company_claim_not_in_reviewed_profile
evidence_id_not_found
must_cover_intent_unreported
```

### Verification

- QA unit tests for each new failure code。
- Repair loop test：wording repair can fix prose, but cannot erase deterministic QA failure。
- Regression test：old reports without Role-Fit artifacts show legacy fallback notice, not broken UI。

## Feature 13: Frontend Match / Report UX

### Current behavior

Analyze / report UI already shows:

- CV / JD review。
- match score and status。
- evidence strength summary。
- requirement checks。
- report sections。
- turn breakdowns。
- evidence sources。
- transcript risks。

### Current gaps

- Analyze page cannot review company understanding or role intent。
- Match result does not show role evidence readiness。
- Report page does not show:
  - role intent coverage。
  - which proof points were tested。
  - whether answers aligned。
  - evidence usage map。
  - reasoning behind question selection。

### Required upgrade

New or extended components:

```text
CompanyUnderstandingReviewCard
RoleIntentReviewPanel
RoleEvidenceReadinessCard
RoleIntentCoverageSection
EvidenceUsageMapSection
AnswerAlignmentTurnCard
QuestionReasoningSection
```

All product-facing UI text must be English.

### UX constraint

Do not overload live interview screen. The user asked that evidence choice should not be prompted during interview. Therefore:

- Prep/review page can show company / role understanding。
- Match/report page can show reasoning。
- Live voice interview should remain natural。

### Verification

- Component tests for empty / degraded / ready states。
- Report view model test for old and new schema。
- Responsive UI check for new report sections。

## Feature 14: Privacy / Retention / Access Control

### Current behavior

Existing models already mark sensitive data in places:

- `InterviewPlan.containsSensitiveData`
- runtime retention indexes for question pool items。
- userId / sessionId ownership on many records。
- company values profile stores fetched page previews, not necessarily full page text。

### Current gaps

- New Role-Fit artifacts will contain sensitive career evidence and inferred company/role assumptions。
- Need to avoid storing raw fetched company page content unless necessary。
- Need clear ownership and deletion behavior for new artifacts。

### Required upgrade

Every new artifact must define:

```text
userId
sessionId or matchAnalysisId
schemaVersion
reviewStatus
sourceTrust
containsSensitiveData
retentionUntil
deletedAt when applicable
```

### Verification

- Model tests for required ownership fields。
- Deletion / retention tests if existing pattern supports it。
- API tests: user cannot access another user's Role-Fit artifacts。

## Feature 15: Testing / Evaluation

### Current behavior

Repo already has:

- backend robustness tests。
- frontend tests。
- e2e scripts for interview / voice flows。
- eval runners for AI behavior。

### Current gaps

Role-Fit introduces new cross-feature contracts that are not covered:

- Company context required gate。
- Company understanding review。
- Role intent review。
- Role evidence map grounding。
- Proof strategy coverage。
- Voice metadata integration。
- Answer alignment report。
- QA integrity for alignment claims。

### Required test matrix

| Phase | Minimum tests |
| --- | --- |
| Company context gate | frontend gating tests + backend contract tests |
| Company understanding / role intent | schema validation + critic fallback tests |
| Evidence graph / evidence map | source traceability + no unsupported mapping tests |
| Proof strategy / question pool | coverage and ranker tests |
| Voice integration | voice e2e with role-fit metadata + low-confidence regression |
| Report alignment | accepted-answer pairing + alignment QA tests |
| Data-driven taxonomy | seed loading + fallback + router invalid selection tests |

Real AI evals should not be routine verification unless credentials, cost, and quota are explicitly approved.

## Feature 16: Rollout Plan / Feature Flags

### Current gap

Role-Fit is too broad to land as one unguarded change.

### Required rollout

Use feature flags:

```text
ROLE_FIT_PREP_ENABLED
ROLE_FIT_COMPANY_CONTEXT_REQUIRED
ROLE_FIT_TAXONOMY_SOURCE=code|database
ROLE_FIT_PROOF_STRATEGY_ENABLED
ROLE_FIT_REPORT_ALIGNMENT_ENABLED
```

Recommended rollout:

1. Add read-only contracts / schemas / tests behind flags。
2. Add company context review gate。
3. Add role intent review。
4. Add evidence map and proof strategy。
5. Feed proof metadata into question pool。
6. Feed metadata into report alignment。
7. Move taxonomy from code dict to database-backed source。

### Rollback

Each phase must allow:

- New artifacts ignored by old flow。
- Existing sessions and reports still render。
- Flag off returns to current CV-JD match / interview / report behavior。

## Spec Readiness Assessment

### Is the total plan enough to write the goal document?

Yes, for a high-level goal document.

It already defines:

- Product north star。
- User target。
- Voice-first direction。
- LLM / human / deterministic boundaries。
- Phase direction。
- Key target artifacts。

### Is the total plan enough to write the implementation spec?

No.

The implementation spec should also include this gap audit, because the spec must know:

- Which existing gates are being changed。
- Which current services are reused。
- Which artifacts are new vs extensions。
- Which old sessions must keep working。
- Which voice product contracts cannot be changed。
- Which report QA guarantees must be extended。
- Which UI components and view models need new fields。

## Decisions Needed Before Final Spec

These are the remaining product / architecture decisions I would ask before writing the final implementation spec:

| Decision | Recommended default | Why it matters |
| --- | --- | --- |
| Company context requirement | Require official website OR user-provided company context | Supports all job seekers, including confidential or small-company roles. |
| Review UI shape | One combined `Job + Company Understanding` review step with sections | Keeps prep flow shorter than separate pages. |
| Taxonomy storage | Mongo collection seeded by versioned JSON | Runtime queryable, rollbackable, and later admin-friendly. |
| Alignment score scale | Internal 0-100 + user-facing label | Matches current score UI while staying readable. |
| Rollout scope | New sessions only, behind flags | Avoids breaking existing sessions/reports. |
| Voice role-fit behavior | Use precomputed proof strategy during voice turns | Protects latency and state-machine guarantees. |

## Recommended Next Step

Before writing goal/spec, treat the source of truth as:

```text
recommend_plan.md
+ role-fit implementation plan
+ this feature gap audit
+ final answers to the decisions above
```

Then write:

1. `docs/role-fit-goal.md`：產品目標、成功定義、scope、non-goals。
2. `docs/role-fit-spec.md`：data contracts、API changes、frontend states、backend services、test plan、phase rollout。

The goal document can be shorter. The spec must be feature-by-feature and phase-by-phase.
