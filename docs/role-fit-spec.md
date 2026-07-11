# Role-Fit Intelligence Spec

狀態：v1 historical implementation contract；V2 final 狀態以 `2026-07-11-role-fit-v2-spec.md` / release gate 為準
日期：2026-07-10  
執行模式：Builder，現有 Node/Express + React/Vite 架構內原地替換實作  
對應目標：[Role-Fit Intelligence Goal](role-fit-goal.md)

V2 補充：Role-Fit Closed Loop v2 已在 2026-07-11 落地為 final local implementation；release gate 為 `ready_with_known_issues`，known issue 是 voice next-question first audio 超過 3 秒。本 v1 spec 保留原 checkpoint contract，不覆蓋 V2 goal/spec/trace。

## 概覽（Overview）

### 目標（Goal）

在不破壞 Kiwi 現有 CV/JD match、prepared question pool、text fallback、voice state machine 與 report QA 的前提下，建立 Role-Fit Intelligence path：將已確認的公司/role 理解、candidate evidence、interview proof strategy 與 answer alignment 變成同一條可稽核資料鏈。

### 使用者（Users）

- 主要：任何產業、資歷和職種的 job seeker。
- 排除：employer-side screening、candidate ranking 或 hiring decision automation。

### 風險等級（Risk class）

高。此功能處理 CV、transcript、job application context 與推論性公司資訊；錯誤輸出可能造成 candidate 對自身經驗或公司角色的錯誤陳述。功能必須以 private ownership、human review、deterministic validation、grounding 和 feature flags 控制。

### 來源資料（Source material）

本 spec 將以下文件收斂為唯一 implementation contract；來源文件保留作為 rationale、現況與研究索引，不在本次刪除或改寫。

- `docs/recommend_plan.md`
- `docs/2026-07-10-role-fit-intelligence-implementation-plan.md`
- `docs/2026-07-10-role-fit-feature-gap-audit.md`
- `docs/references/agent-rag-evaluation-references.md`
- `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`

### 實作授權（Implementation authority）

使用者已在 2026-07-10 明確授權依本 spec 完成整份 Role-Fit goal，並批准為非技術使用者調整前端。Dependency、未列入 spec 的額外 architecture change、real-AI eval、live speech provider、destructive operation 或 push 仍須另行取得明確 approval。

## 需求（Requirements）

### 功能需求（Functional requirements）

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| RFI-001 | Role-Fit 必須直接升級現有 preparation -> match -> plan -> interview -> report 主鏈。 | Cutover 後所有新 session 使用升級 contract；temporary flag 只作 release kill switch，不能成為永久 dual-flow mode。 |
| RFI-002 | Role-Fit JD input 必須有 `companyWebsiteUrl` 或 `userCompanyContext` 至少一項。 | 兩者都缺時，parse response 是 `needs_review` / `missing_company_context`，UI 不可 confirm 或產生 Role-Fit plan。 |
| RFI-003 | 系統必須產生可 review 的 Company Understanding 和 Role Intent drafts。 | 每個 inference 有 source label、confidence、uncertainty；未 review artifact 不可成為下游 trusted input。 |
| RFI-004 | 使用者可在合併的 Job + Company Understanding step 確認或修正可編輯字段。 | submit 使用 optimistic version；stale version 回 `409`; successful review 將 status 變成 `user_confirmed`。 |
| RFI-005 | 系統必須從已 review CV 建立 Candidate Evidence Graph。 | 每一 evidence item 有 stable ID、source section、private source trace、raw snippet / normalized summary 與 strength signals。 |
| RFI-006 | 系統必須建立 Role Evidence Map，將 confirmed role intent / JD requirements 對應 direct、adjacent、weak 或 gap evidence。 | 無可追溯 source 的 item 永遠不能標為 direct/adjacent；high-priority role intent 必須有 strong/partial/missing status。 |
| RFI-007 | taxonomy 必須 data-driven，並容許 generic strategy fallback。 | router 或 active taxonomy 無效時記錄 diagnostic，回退 generic version，不中斷 legacy match。 |
| RFI-008 | plan creation 必須建立或明確降級 Interview Proof Strategy。 | `mustCover` intent 有 active question candidate 或 `degradedReason`; 沒有 silent omission。 |
| RFI-009 | prepared pool item v3 必須攜帶 role-fit metadata，並與既有 v2 item 共存。 | old item / old session 可讀、可問、可出 report；v3 item 可寫入 questionDecision / diagnostics。 |
| RFI-010 | live voice/text question selection 必須使用 precomputed Role-Fit metadata，不能顯示 recommended evidence 或 internal reasoning。 | controller/ranker 決定 action/intent；LLM 僅 naturalize 已選問題；UI / API public payload 不含 live evidence hints。 |
| RFI-011 | 只為 accepted answer pair 產生 AnswerAlignment。 | repair、repeat、clarification、system、barge-in acknowledgement、未確認低信心 transcript 不得計分或建立 alignment。 |
| RFI-012 | report 必須顯示 role intent coverage、evidence usage 和 per-turn answer alignment；artifact 缺失時顯示 safe legacy / unavailable state。 | 不可因 alignment service failure 讓既有 report generation fail。 |
| RFI-013 | report QA 必須檢查 role intent、company claim、evidence IDs、alignment grounding 和 must-cover coverage。 | deterministic failure 不能由 wording repair 移除。 |
| RFI-014 | 每個 Role-Fit artifact 必須有 user/session or match ownership、schema version、review/source trust 和 retention/deletion integration。 | 未授權使用者不可讀取其他 user 的 artifact；新資料不能繞過既有 retention cleanup registry。 |
| RFI-015 | RAG / agent eval 必須從 actual retrieval / generation / trajectory records 計算，而不是只檢查 fixture text。 | 建立 versioned, synthetic-or-anonymized dataset 和 per-case output；高風險 unsupported claims 由 blocking test 覆蓋。 |
| RFI-016 | 每一個 temporary compatibility adapter、flag、legacy schema reader、service 和 test fixture 都必須在 implementation manifest 登記 removal gate。 | Cutover 驗證完成、舊 session resume window 結束或已 migration 後，移除 obsolete code/data branch；CI test 證明沒有 production import/route 仍依賴它。 |

### 非功能需求（Non-functional requirements）

| Area | Requirement |
| --- | --- |
| Replacement and compatibility | Existing contracts are upgraded in place. Old plans/reports remain readable through a short-lived schema adapter; new sessions do not retain a second legacy path after cutover. |
| Voice latency | `user speech end -> next question first audio <= 3 seconds` remains target；Role-Fit turn path 不得新增同步 LLM decode / website fetch / taxonomy seed load。 |
| Reliability | Every generated artifact has `draft | needs_review | user_confirmed | degraded | failed` equivalent state and user-safe failure reason。 |
| Explainability | Store structured `reasoningSummary`, evidence IDs, selected action, tool/args, observation and fallback; never store/display raw model chain-of-thought。 |
| Internationalization | Candidate-facing strings, reports, prompt outputs and labels in English；technical docs and code identifiers remain as repository convention。 |
| Cost control | Mock-safe tests are default；LLM judges are batch/explicit eval only; real provider eval needs approval and usage tracking。 |
| Dependency control | Phase 1-4 add no mandatory external runtime framework; any package install needs explicit approval。 |
| Cleanup | A temporary flag/adapter must have owner, removal gate and a testable deletion step. Permanent compatibility is a defect, not a feature. |

### 安全與隱私需求（Security and privacy requirements）

- Require authenticated user for all Role-Fit routes. Every fetch/update loads artifact by `userId` plus its ID/fingerprint; never rely on client-supplied owner ID.
- Treat raw CV snippets, manual company context, evidence graph and transcript evidence as sensitive private data. Do not include them in generic logs, public diagnostics, fixture exports or model error messages.
- Store source references minimally. Company artifacts store approved URL and bounded evidence excerpt/reference, not full fetched page bodies unless existing retention policy explicitly permits it.
- New Mongo models must use `retentionUntil`, `deletedAt`, `containsSensitiveData`, `accessScope` and be registered with the existing retention/deletion mechanism before the flag can turn on.
- Evaluation dataset uses synthetic or anonymized cases only. Any real user data requires explicit data-governance approval outside this spec.
- Report/export APIs return only the requesting user's Role-Fit data; no cross-session lookup by bare `matchAnalysisId` or `evidenceId`.

## 架構（Architecture）

### 目標流程（Target flow）

```text
reviewed CV
  -> CandidateEvidenceGraph

raw JD + company website OR manual company context
  -> guarded JD rubric
  -> CompanyUnderstandingProfile draft
  -> RoleIntentProfile draft
  -> critic + user confirmation

confirmed role intent + evidence graph + reviewed JD
  -> RoleEvidenceMap
  -> InterviewProofStrategy
  -> prepared question pool v3
  -> deterministic controller/ranker + bounded wording LLM
  -> accepted-answer pairing
  -> AnswerAlignment
  -> report sections + report QA
```

### 責任邊界（Responsibility boundary）

| Responsibility | Owner | Must not do |
| --- | --- | --- |
| Parse / normalize messy JD and company context | LLM draft behind a narrow service | Treat inference as confirmed fact. |
| Validate schema, source label, state transition, auth and fallback | Deterministic code | Delegate blocking decision to prompt wording. |
| Company / role confirmation | Candidate | Confirm an unreviewed inferred claim silently. |
| Evidence graph extraction | Existing deterministic CV evidence pipeline, optional bounded normalization | Re-parse raw CV needlessly or lose source trace. |
| Role evidence mapping explanation | Hybrid score + bounded LLM explanation | Upgrade weak/unsupported source into direct evidence. |
| Question coverage and ranking | Deterministic planner/ranker | Let a naturalization model invent intent or action. |
| Spoken question wording | Bounded LLM micro-planning | Change selected proof point, disclose evidence hints or skip voice guards. |
| Answer alignment explanation | Deterministic score/signals + bounded LLM explanation | Align rejected transcript or hide QA failure. |
| QA / repair eligibility | Deterministic QA, LLM only wording repair | Rewrite away a missing evidence, source or coverage failure. |

### ReAct 形態控制合約（ReAct-shaped control contract）

Kiwi remains a controlled state machine, not a free-running ReAct agent. The trace is a user-safe audit record.

```yaml
agent_turn_trace_v1:
  stateBefore:
    stage: string
    coverageGaps: [string]
    retrievalBudgetRemaining: integer
  candidateActions:
    - action: enum
      priority: number
      evidenceNeed: [string]
  selectedAction: enum
  selectionReason: string
  toolCall:
    name: string
    args: object
  observation:
    status: ready|limited|degraded|failed
    retrievedChunkIds: [string]
    qualityReasons: [string]
  outcome:
    questionId: string|null
    fallbackUsed: boolean
```

Forbidden trace content: raw model hidden reasoning, full prompt, raw CV/JD body, secret/provider credential, or candidate-facing recommendation emitted during a live turn.

### 原地替換策略（Replace, verify, retire）

Role-Fit 不建立第二套 runtime。它以現有 public entrypoints 和 persistence owners 為基礎，逐一替換內部 contract。可允許的暫時相容層只有：

1. pre-cutover session 的 read adapter；
2. release kill switch；
3. 只在 test/canary 使用的 baseline comparison harness。

禁止事項：雙寫兩份 company/CV/match/report source of truth、讓新 session 選擇 legacy path、永久保留 `legacy` endpoint、或用 feature flag 隱藏未清除的舊 business logic。

每個 phase 先寫 characterization tests，固定現有仍需保留的 public behavior；再替換 implementation、跑 focused / integration / e2e / eval checks；最後才進入下一 phase。當 replacement contract 通過 cutover gate，新增 session 只使用新 implementation，已存在 session 只讀自己的 schema snapshot。

## 合約（Contracts）

### 共用狀態與來源 enums（Shared status and source enums）

```yaml
review_status: [draft, needs_review, user_confirmed, needs_revision]
artifact_status: [not_started, draft, ready, degraded, failed]
source_trust: [explicit_jd, company_website, user_context, candidate_cv, accepted_transcript, inferred]
evidence_fit_type: [direct, adjacent, weak, gap]
coverage_priority: [must_cover, should_cover, optional]
alignment_label: [strong, partial, weak, off_target, unavailable]
```

Rules:

- `inferred` cannot be the only evidence source for a confirmed company fact. It may appear as a reviewed hypothesis with uncertainty.
- `direct`, `adjacent` and `weak` require at least one source trace; no trace means `gap`.
- `user_confirmed` means the candidate has reviewed the current artifact version, not that an external company fact has been independently verified.
- A downstream artifact records the source artifact ID/version it used. If that source becomes `needs_revision`, new plan/report work must not use it as trusted data.

### 資料模型（Data models）

All model shapes are additive. Exact Mongoose schemas belong in the owning `backend/src/db/models/` module; controller code must only orchestrate validated service calls.

```yaml
CompanyUnderstandingProfile:
  key: [userId, jdFingerprint, contextFingerprint]
  fields:
    schemaVersion: company_understanding_v1
    userId: string
    jdFingerprint: string
    contextFingerprint: string
    companyName: string
    companyWebsiteUrl: string|null
    userCompanyContext: string|null
    companySummary: string
    businessModel: string|null
    customersOrUsers: [string]
    productsOrServices: [string]
    operatingContext: [string]
    hiringContextHypotheses:
      - hypothesis: string
        evidenceRefs: [SourceReference]
        confidence: high|medium|low
        sourceTrust: source_trust
        uncertainty: string|null
    uncertainties: [string]
    reviewStatus: review_status
    reviewedAt: ISODate|null
    sourceTrust: [source_trust]
    retentionUntil: ISODate
    deletedAt: ISODate|null
    containsSensitiveData: true
    accessScope: private

RoleIntentProfile:
  key: [userId, jdFingerprint, companyUnderstandingProfileId, companyUnderstandingVersion]
  fields:
    schemaVersion: role_intent_v1
    userId: string
    companyUnderstandingProfileId: string
    companyUnderstandingVersion: integer
    jdFingerprint: string
    roleTitle: string
    roleDomain: string
    taxonomyVersion: string
    strategyKey: string
    rolePurpose:
      shortStatement: string
      confidence: high|medium|low
      sourceTrust: source_trust
      evidenceRefs: [SourceReference]
    businessProblemHypotheses: [RoleHypothesis]
    workflowPainPoints: [RoleHypothesis]
    idealCandidateSignals: [IdealCandidateSignal]
    interviewProbeMap: [InterviewProbe]
    uncertainties: [string]
    reviewStatus: review_status
    criticDiagnostics: [Diagnostic]
    retentionUntil: ISODate
    deletedAt: ISODate|null
    containsSensitiveData: true
    accessScope: private

CandidateEvidenceGraph:
  key: [userId, cvFileId, cvReviewVersion]
  fields:
    schemaVersion: candidate_evidence_graph_v1
    userId: string
    cvFileId: string
    cvReviewVersion: string
    evidenceItems:
      - evidenceId: string
        source: cv_project|cv_work_experience|cv_achievement|user_added_example|accepted_transcript
        title: string
        rawSnippet: string
        normalizedSummary: string
        proofAngles: [string]
        strengthSignals:
          specificity: 0..100
          outcomeEvidence: 0..100
          personalOwnership: 0..100
          credibility: 0..100
        sourceTrace: SourceReference
    artifactStatus: ready|degraded|failed
    retentionUntil: ISODate
    deletedAt: ISODate|null
    containsSensitiveData: true
    accessScope: private

RoleEvidenceMap:
  key: [userId, matchAnalysisId, roleIntentProfileId, candidateEvidenceGraphId]
  fields:
    schemaVersion: role_evidence_map_v1
    userId: string
    matchAnalysisId: string
    roleIntentProfileId: string
    candidateEvidenceGraphId: string
    requirementEvidence:
      - requirementId: string
        roleIntentSignalIds: [string]
        status: strong|partial|missing
        topEvidence:
          - evidenceId: string
            fitType: evidence_fit_type
            score: 0..100
            scoreBreakdown: object
            whyItWorks: string
            howToSayIt: string
            angleWarnings: [string]
            sourceTraceRefs: [SourceReference]
    gaps: [GapRecord]
    reviewStatus: review_status
    artifactStatus: ready|degraded|failed
    degradedReason: string|null
    retentionUntil: ISODate
    deletedAt: ISODate|null
    containsSensitiveData: true
    accessScope: private

InterviewProofStrategy:
  storage: InterviewPlan.roleFit.proofStrategy
  fields:
    schemaVersion: interview_proof_strategy_v1
    roleIntentProfileId: string
    roleEvidenceMapId: string
    targetRoleIntentIds: [string]
    mustCover:
      - coverageId: string
        type: role_intent|gap_validation|communication|evidence_depth
        roleIntentId: string|null
        minQuestions: integer
        evidenceOptions: [string]
        allowAdjacentEvidence: boolean
        status: pending|covered|unresolved|degraded
    avoidOveruse:
      maxSameEvidenceRoot: 2
      maxSameAngle: 1
    voiceInterviewPolicy:
      doNotShowRecommendedEvidenceDuringInterview: true
      storeReasoningForReport: true
    artifactStatus: ready|degraded|failed
    degradedReason: string|null

AnswerAlignment:
  storage: SessionReport.roleFit.answerAlignments and report metadata
  fields:
    schemaVersion: answer_alignment_v1
    turnId: string
    questionId: string
    proofPointId: string|null
    testedRoleIntentIds: [string]
    expectedSignals: [string]
    candidateAnswerSummary: string
    detectedEvidenceUsed:
      - evidenceId: string
        confidence: high|medium|low
        angleUsed: string
    score: 0..100
    label: alignment_label
    scoreBreakdown:
      questionAlignment: 0..25
      roleIntentFit: 0..25
      evidenceFit: 0..20
      evidenceClarity: 0..20
      naturalness: 0..10
    diagnosis:
      mainIssue: string
      missedSignals: [string]
      overuseRisk: low|medium|high
    betterAnswerPlan:
      useSameExample: boolean
      changeAngleTo: string|null
      structure: CAR|STAR|direct
      spokenRewrite: string|null
    groundingStatus: grounded|limited|blocked
```

Supporting value objects:

```yaml
SourceReference:
  sourceType: explicit_jd|company_website|user_context|candidate_cv|accepted_transcript|inferred
  sourceId: string|null
  documentId: string|null
  section: string|null
  chunkId: string|null
  url: string|null
  excerpt: string|null

RoleHypothesis:
  id: string
  statement: string
  evidenceRefs: [SourceReference]
  confidence: high|medium|low
  uncertainty: string|null

Diagnostic:
  code: string
  severity: info|warning|blocking
  message: string
  sourceIds: [string]
```

### 評分合約（Scoring contracts）

#### Evidence mapping score（證據 mapping 分數）

```text
roleEvidenceScore =
  semanticRelevance * 0.25
  + jdRequirementMatch * 0.20
  + roleIntentMatch * 0.20
  + specificity * 0.15
  + personalOwnership * 0.10
  + outcomeEvidence * 0.10
```

Each input is normalized to 0-100. This score ranks candidate evidence; it is not a claim of job qualification. A source trace is mandatory before a score can yield `direct`, `adjacent` or `weak`.

| Fit type | Score guideline | Additional rule |
| --- | ---: | --- |
| `direct` | 80-100 | Explicit source evidence supports the requirement/signal. |
| `adjacent` | 60-79 | Transferable evidence exists but does not prove exact equivalent experience. |
| `weak` | 35-59 | Related exposure exists; report must state limitation. |
| `gap` | 0-34 or no trace | No supported evidence; never generate a positive claim. |

#### Answer alignment score（回答對齊分數）

`AnswerAlignment.score` is the sum of the defined breakdown fields. Initial labels are:

| Label | Score | Meaning |
| --- | ---: | --- |
| `strong` | 80-100 | Directly addresses the proof point with grounded, clear evidence. |
| `partial` | 60-79 | Relevant but missing an important signal, result, ownership or angle. |
| `weak` | 35-59 | Some relevant content but insufficient proof. |
| `off_target` | 0-34 | Does not answer the tested role intent or relies on unsupported evidence. |
| `unavailable` | n/a | No accepted answer, no valid proof metadata, or alignment generation unavailable. |

These thresholds are implementation defaults, not final product-quality claims. Phase 6 human calibration may change them only through a versioned contract update and baseline comparison.

### Taxonomy 合約（Taxonomy contract）

```yaml
CapabilityTaxonomy:
  key: [taxonomyKey, version]
  fields:
    taxonomyKey: string
    version: semver|string
    status: active|deprecated|disabled
    roleDomains: [string]
    capabilityGroups:
      - id: string
        labels: [string]
        aliases: [string]
        roleIntentDimensions: [string]
        evidenceAngles: [string]
        probeTemplateKeys: [string]
    seedSource: repo_versioned_json
    createdBy: seed|admin

RoleFitStrategyRegistry:
  allowedKeys: [generic, healthcare, finance, education, safety_critical]
  contract:
    extractCompanySignals: function
    extractRoleIntent: function
    buildEvidenceCriteria: function
    validateUnsupportedClaims: function
    fallbackKey: generic
```

The router receives raw JD plus company context and returns only `{ roleDomain, taxonomyKey, strategyKey, confidence, diagnostic }`. It cannot set a review status to confirmed, write candidate evidence, or bypass a critic. Invalid/missing result selects `generic` taxonomy/strategy and records `ROLE_FIT_ROUTER_FALLBACK_GENERIC`.

### API 合約（API contracts）

All endpoints are authenticated, subject to existing rate limit policy, and return the repository's standard success/error envelope.

```yaml
POST /api/job-description/paraphrase:
  purpose: Directly upgrade the existing JD parse endpoint to build guarded rubric plus reviewable company / role drafts.
  request:
    rawJD: string, required
    companyWebsiteUrl: string|null
    userCompanyContext: string|null
  validation:
    - rawJD is non-empty
    - one of companyWebsiteUrl or userCompanyContext is non-empty after production cutover
    - before cutover, the temporary release switch controls whether existing stored session drafts may use the old response reader
  response:
    structuredJD: string
    structuredJDRubric: object
    companyUnderstandingProfile: CompanyUnderstandingProfile
    roleIntentProfile: RoleIntentProfile
    diagnostics: [Diagnostic]
  errors:
    400: malformed body
    422: missing_company_context or blocking schema/critic failure

PUT /api/job-description/role-fit/reviews/:companyUnderstandingProfileId:
  purpose: Confirm/edit company understanding and role intent drafts.
  request:
    expectedVersion: integer, required
    companyUnderstandingPatch: object
    roleIntentPatch: object
    confirmCompanyUnderstanding: boolean
    confirmRoleIntent: boolean
  validation:
    - caller owns profile and linked role intent
    - only allowlisted editable fields may be patched
    - all retained hypotheses keep sourceTrust/confidence/uncertainty
    - confirmations require no blocking diagnostic
  response:
    companyUnderstandingProfile: CompanyUnderstandingProfile
    roleIntentProfile: RoleIntentProfile
  errors:
    403: not owner
    409: stale profile version
    422: invalid patch or unresolved blocking diagnostic

GET /api/role-fit/preparation/:matchAnalysisId:
  purpose: Return sanitized prep/match data for the authenticated owner.
  response:
    companyUnderstanding: object
    roleIntent: object
    roleEvidenceMap: object|null
    proofStrategy: object|null
    readiness:
      companyContextStatus: string
      roleIntentStatus: string
      roleEvidenceMapStatus: string
      proofStrategyStatus: string

POST /api/analyze/interview-plan:
  extension:
    roleFitPreparationVersion: string|null
  behavior:
    - server resolves confirmed Role-Fit artifacts from authenticated reviewed JD/CV state; client does not select a mode
    - production cutover requires confirmed profiles and ready/degraded evidence map
    - response returns sanitized preparation readiness and sessionId

GET /api/sessions/:sessionId:
  extension:
    analysisSetup.roleFitReadiness: object
    interviewPlan.roleFit: sanitized object
  redaction:
    - live session response excludes recommendedEvidenceIds, internal rank candidates and prompt content while in progress

GET /api/reports/:sessionId:
  extension:
    report.roleFit:
      roleIntentCoverage: object
      answerAlignments: [AnswerAlignment]
      evidenceUsageMap: object
      questionReasoning: [object]
```

No endpoint may accept `userId`, `sourceTrace`, `fitType`, `score`, `reviewStatus` or QA pass/fail as trusted client authority. Services recompute or validate them server-side.

### 持久化位置與相容性（Persistence placement and compatibility）

| Artifact | Persistence | Reason |
| --- | --- | --- |
| CompanyUnderstandingProfile + RoleIntentProfile | In-place v2 extension of the current company-profile persistence source; replace `CompanyValuesProfile` as the preparation source of truth while preserving values needed by company-motivation reporting. | One reviewed company context, not separate competing profiles. Temporary old-model reader is deleted after migration/resume window. |
| CandidateEvidenceGraph | In-place extension of the reviewed CV evidence profile. | Reuses current deterministic extraction and avoids a second CV evidence store. |
| RoleEvidenceMap | In-place `roleFit` extension of the existing match analysis record / `SessionAnalysis.evidenceMap`. | Match, plan and report read one match source of truth. |
| Proof strategy | In-place extension of existing `InterviewPlan.strategy` and `questionPlanSnapshot`. | Preserves current session snapshot semantics. |
| Question v3 metadata | Optional fields on `InterviewQuestionPoolItem` plus compatible embedded plan projection | Runtime ranker needs item-level access; old v2 remains valid. |
| Question decision / role-fit trace | In-place extension of transcript metadata and `SessionAnalysis.trajectoryRecords`. | Links actual turn to planned proof point without raw thought capture. |
| AnswerAlignment / coverage report | In-place extension of current `SessionReport` turn breakdown/report metadata. | Tied to accepted answers and final report lifecycle without a duplicate report store. |

`InterviewPlan.schemaVersion` advances only when validators can normalize old and new shapes. Pre-cutover sessions are read through a bounded adapter that infers `roleFit.enabled=false`; the adapter must be removed after its manifest gate is met. No permanent second plan format or read path is allowed.

### Legacy removal manifest

Before changing an existing service or schema, add a versioned manifest under `docs/role-fit-removal-manifest.md` or an equivalent tracked implementation artifact. It is a required implementation deliverable, not a TODO list.

```yaml
legacy_removal_manifest_v1:
  replacementArea: jd_review|company_context|cv_evidence|match|question_pool|report|taxonomy
  existingSourceFiles: [string]
  replacementSourceFiles: [string]
  persistedSnapshotCondition: string
  temporaryAdapter: string|null
  characterizationTests: [string]
  cutoverGate:
    - focused_tests_pass
    - integration_tests_pass
    - voice_contract_unchanged_when_applicable
    - report_qa_contract_unchanged_when_applicable
    - no_blocking_eval_regression
  removalGate:
    - no_new_session_writes_legacy_shape
    - existing_snapshot_resume_window_closed_or_migrated
    - production_import_search_has_no_legacy_reference
    - obsolete_fixture_and_test_removed_or_rewritten
  owner: string
  status: planned|active|ready_to_remove|removed
  removedAt: ISODate|null
```

The final removal change must delete the old implementation rather than merely stop calling it. It includes unused route branches, feature flags, service exports, model adapters, old prompt/config fields, UI branches, dead tests/fixtures and stale docs. Database cleanup follows the existing retention/deletion policy and must not delete live user artifacts early.

## 行為與狀態轉換（Behavior and state transitions）

### 準備流程（Preparation flow）

```text
JD input
  -> role-fit parse draft
  -> Job + Company Understanding review
  -> company / role user_confirmed
  -> CV evidence graph
  -> legacy match + role evidence map
  -> plan readiness
  -> interview plan creation
```

Required preparation state:

```yaml
RoleFitReadiness:
  companyContextStatus: missing|draft|needs_review|user_confirmed
  roleIntentStatus: not_started|draft|needs_review|user_confirmed
  roleEvidenceMapStatus: not_started|ready|degraded|failed
  proofStrategyStatus: not_started|ready|degraded|failed
  blockingReasons: [string]
  degradedReasons: [string]
```

Plan gate order after cutover:

1. Selected CV has current human review.
2. Raw JD matches reviewed rubric fingerprint.
3. Company context has been supplied and company understanding is `user_confirmed`.
4. Role intent is `user_confirmed`.
5. Role Evidence Map is `ready`, or `degraded` with explicit generic proof fallback.
6. If voice mode, existing voice device readiness conditions are met.

Any edit to raw JD, company website/context, confirmed company fields or role intent invalidates downstream drafts by fingerprint/version and sets plan readiness back to blocked until regenerated/reviewed.

### 公司 context 失敗行為（Company-context failure behavior）

| Condition | Required behavior |
| --- | --- |
| No website and no manual context | Block Role-Fit parse/review; explain required input in English UI. |
| Website fetch/search fails but manual context exists | Draft uses `user_context`, shows uncertainty; candidate may review/confirm. |
| Website fetch/search fails and no usable manual detail | `needs_review`, not auto-confirmed; candidate can add context or leave Role-Fit path. |
| LLM draft has unsupported company claim | Critic emits blocking diagnostic; claim is removed/downgraded before confirmation. |
| Pre-cutover kill switch active | Only existing stored sessions may use the bounded legacy reader; do not offer a new-session legacy branch. |

### 證據與 proof planning（Evidence and proof planning）

1. Reuse reviewed CV `evidenceItems`; do not create a second raw CV parser.
2. Build Evidence Graph nodes with immutable source traces.
3. Load selected taxonomy/strategy, or generic fallback.
4. Generate Role Evidence Map from confirmed Role Intent + legacy JD requirements + graph nodes.
5. Create `must_cover` role intents, gaps and evidence-depth items.
6. Compose question candidates and persist optional v3 metadata.
7. Rank questions with existing priority/coverage/risk/mode/novelty logic plus Role-Fit terms:

```text
roleFitRankAdjustment =
  roleIntentCoverageBoost
  + evidenceMapStrengthBoost
  + unmetCoverageBoost
  + gapRiskBoost
  - evidenceOverusePenalty
```

The new adjustment must be separately traceable in `rankTrace`; it may not overwrite the base score/reason of old sessions.

### Live interview 行為（Live interview behavior）

Role-Fit metadata is precomputed before a voice/text session. During each accepted answer:

```text
accepted answer
  -> existing evaluator and decision context
  -> deterministic action planner
  -> question ranker uses proof metadata when present
  -> interviewer agent selects base question
  -> bounded LLM naturalizes wording
  -> mode/novelty guards
  -> persist question decision and coverage state
```

Live constraints:

- The client must never receive `recommendedEvidenceIds`, evidence map snippets, `proofPointId` explanation, candidate alternatives, private prompt content or raw `thoughtSummary` while the interview is in progress.
- Role-Fit cannot add a synchronous company fetch, taxonomy seed read, unbounded retrieval loop or additional LLM role-intent decode to the voice turn critical path.
- Existing voice states, STT confirmation behavior, question count rules, barge-in behavior and latency markers remain authoritative.
- Contentful low-confidence transcript remains pending confirmation; it does not create evidence usage, coverage progress or AnswerAlignment until accepted.

### 報告行為（Report behavior）

For each accepted question-answer pair with valid proof metadata:

1. Lookup the proof point and tested role intent from persisted question decision.
2. Detect candidate evidence only from Evidence Graph / accepted transcript source references.
3. Compute deterministic alignment signals and score.
4. Generate an English bounded explanation and optional spoken rewrite.
5. Ground every generated claim against evidence IDs / reviewed role intent.
6. Run extended report QA.

Report handling:

| State | Candidate-visible behavior |
| --- | --- |
| `grounded` | Show score label, concise explanation, evidence fit and better answer direction. |
| `limited` | Show alignment with limitation / low-confidence label; do not state unsupported evidence as fact. |
| `blocked` | Omit unsafe claim, surface safe `alignment unavailable` copy and retain QA status. |
| no Role-Fit artifact / legacy session | Render existing report sections unchanged; no broken empty cards. |

### Report QA 擴充（Report QA additions）

New deterministic failure codes:

```text
role_intent_reference_missing
answer_alignment_without_proof_point
alignment_claim_not_grounded
company_claim_not_in_reviewed_profile
evidence_id_not_found
must_cover_intent_unreported
role_fit_artifact_not_owned
```

`runReportQaRepairLoop` may repair English prose only when the underlying evidence/reference is valid. It must not clear any listed deterministic failure merely because a rewrite looks coherent.

## 前端規格（Frontend specification）

### Analyze / 準備體驗（Analyze / preparation experience）

Affected surfaces: `AnalyzePage`, `JobContextCard`, workflow shell/actions, match result view model and their tests. These components are upgraded in place; there is no separate Role-Fit page or permanent mode switch.

| UI area | Required state and interaction |
| --- | --- |
| Job context input | Add Company website URL and Company context fields to the existing JD input; show at least one as required after cutover. |
| Combined review | Upgrade existing JD review into English `Job and company understanding` sections: parsed role, company understanding, why this role exists, inferred/uncertain items, confirm/edit controls. |
| Readiness | Show company context, role intent, evidence map and proof strategy readiness. Blocking reasons are actionable; degraded state is explicit. |
| Match result | Show high-level `Best evidence for this role`, gaps and role-fit readiness; do not claim direct experience where map is weak/gap. |
| Pre-interview | May show interview coverage/strategy at a high level before start. It may not inject recommended evidence into the live session UX. |
| Existing draft/resume | Persist only role-fit IDs/status/version in local draft; re-fetch sensitive artifacts from authenticated backend on restore. Pre-cutover drafts use the bounded compatibility reader until their resume window ends. |

### Live interview 體驗（Live interview experience）

Affected surfaces: text interview page/hook, voice hook/components and diagnostics payload handling.

- No new visible evidence card, prompt, suggested project, hidden reason, proof-point label or answer template during active interview.
- Preserve the existing interface for repair, confirmation, repeat, microphone readiness and recording status.
- Frontend may use a boolean `roleFitEnabled` for presentation, but backend remains the source of truth for all gating/ranking.

### 報告體驗（Report experience）

Add view-model fields and new sections after current evidence/risk information:

```text
RoleIntentCoverageSection
EvidenceUsageMapSection
AnswerAlignmentTurnCard
QuestionReasoningSection
```

Each section must handle `ready`, `limited`, `unavailable` and legacy absence. Product-facing copy is English. Do not make one large nested card; use the existing report section layout and responsive test pattern.

## 行為情境（BDD Scenarios）

```gherkin
Scenario: Confirmed company and role understanding unlock Role-Fit plan creation
  Given ROLE_FIT_PREP_ENABLED is true
  And the candidate has a current reviewed CV and reviewed JD
  And the candidate supplied an official company website or manual company context
  And CompanyUnderstandingProfile and RoleIntentProfile are user_confirmed
  And RoleEvidenceMap is ready
  When the candidate generates an interview plan in Role-Fit mode
  Then the backend persists an InterviewProofStrategy snapshot
  And active question-pool items include optional v3 proof metadata
  And the client receives plan readiness without private evidence snippets

Scenario: Missing company context blocks Role-Fit preparation
  Given ROLE_FIT_PREP_ENABLED is true
  And the candidate supplies raw JD text without a website or manual company context
  When the client requests Role-Fit parsing
  Then the response identifies missing_company_context as blocking
  And neither company understanding nor role intent is user_confirmed
  And plan generation remains disabled in the frontend

Scenario: Manual company context safely replaces unavailable website context
  Given a company website cannot be fetched
  And the candidate provides a manual company context
  When Role-Fit parsing completes
  Then company claims derived from that text have sourceTrust user_context
  And uncertainties remain visible for unsupported details
  And the candidate can review and confirm the current artifact version

Scenario: Unsupported company hypothesis cannot become a confirmed fact
  Given a draft says the company uses a specific internal workflow without source evidence
  When the critic and schema validator run
  Then the claim is downgraded or produces a blocking diagnostic
  And confirmation is rejected until the artifact is corrected
  And downstream Role Evidence Map generation cannot use that claim as trusted input

Scenario: Evidence mapping preserves a gap instead of inventing direct experience
  Given a JD requires production Kubernetes ownership
  And the candidate only has a student deployment example with no Kubernetes source trace
  When RoleEvidenceMap is generated
  Then the mapping is weak or gap, never direct
  And the report may recommend adjacent evidence with an explicit limitation
  And the question planner may create a gap-validation proof point

Scenario: Generic taxonomy fallback preserves the interview path
  Given the router selects an unknown taxonomy or invalid strategy
  When Role-Fit preparation continues
  Then the generic taxonomy and strategy are selected
  And diagnostic ROLE_FIT_ROUTER_FALLBACK_GENERIC is persisted
  And no invalid domain-specific claim reaches the candidate

Scenario: Live voice interview remains natural and safe
  Given a session has a precomputed proof strategy
  And the current voice transcript is contentful with low ASR confidence
  When the user finishes speaking
  Then the system enters transcript_needs_confirmation
  And it does not score the answer, advance coverage or count a question
  And the confirmation UI does not show recommended evidence or proof-point metadata

Scenario: Accepted answer creates grounded alignment
  Given an accepted answer is paired with a question containing proofPointId
  And the candidate used evidence that has a valid graph source trace
  When report generation runs
  Then AnswerAlignment has a 0-100 score, label and score breakdown
  And each displayed explanation is grounded to evidence IDs and reviewed role intent
  And the report shows the outcome in English

Scenario: Report QA blocks an ungrounded alignment claim
  Given generated coaching says the candidate demonstrated stakeholder leadership
  And neither the accepted answer nor evidence graph supports that claim
  When report QA runs
  Then alignment_claim_not_grounded is a deterministic blocking failure
  And wording repair cannot change the QA result to ready

Scenario: Existing session remains usable after rollout
  Given an interview plan was created before Role-Fit schema v1
  When the owner resumes the session or opens its report
  Then the validators normalize roleFit.enabled to false
  And existing question selection and report rendering continue without a migration

Scenario: Actual retrieval benchmark evaluates ranked runtime output
  Given a versioned synthetic evaluation case defines query, source filter and relevant chunk IDs
  When the retrieval evaluation runner executes the production scoring function or its deterministic in-memory equivalent
  Then it records ranked chunk IDs and precisionAtK, recallAtK, MRR and nDCG
  And generation-grounding evaluation records response claims separately from retrieval ranking
```

## 測試與評估（Testing and evaluation）

### 測試矩陣（Test matrix）

| Layer | Required focused coverage |
| --- | --- |
| JD/company services | request validation, source labels, critic downgrade, review version conflict, manual context fallback, ownership. |
| New models/repositories | schema defaults, private access, retention fields, deletion registry, old/missing artifact normalization. |
| CV/evidence services | graph rebuild after CV review change, source traceability, no evidence invention, direct/adjacent/weak/gap cases. |
| Taxonomy/router | seed validation, active version loading, invalid strategy generic fallback, deterministic diagnostic. |
| Match/planning | Role Evidence Map contracts, must-cover coverage, degraded proof plan, rank adjustments and overuse penalty. |
| Questions/interviewer | question pool v2/v3 compatibility, proof metadata persistence, public/live redaction, question diagnostics. |
| Voice | no added turn-time model call, low-confidence confirmation, question counting, latency markers, no live evidence hint. |
| Report/QA | accepted-answer-only alignment, score labels, evidence ID grounding, new QA codes, legacy report fallback, bounded repair. |
| Frontend | gating, review edit/confirm, ready/degraded/failed views, old/new view model, responsive report sections. |
| API integration | auth/ownership, route payload contract, plan creation with flags on/off, session/report sanitization. |

### RAG 與 agent 評估合約（RAG and agent evaluation contract）

Phase 6 adds separate datasets and runners. They must be local/mock-safe by default and contain only synthetic/anonymized material.

```yaml
retrieval_case_v1:
  caseId: string
  datasetVersion: string
  query: string
  sourceTypes: [string]
  corpus: [{ chunkId: string, sourceType: string, text: string, metadata: object }]
  relevantChunkIds: [string]
  forbiddenChunkIds: [string]
  labels:
    domain: string
    risk: low|medium|high
  expectedFallback: string|null

generation_grounding_case_v1:
  caseId: string
  input: { objective: string, query: string }
  retrieval: { chunkIds: [string], contexts: [string], configFingerprint: string }
  output: { text: string, claimRefs: [string] }
  reference:
    requiredClaims: [string]
    forbiddenClaims: [string]
  labels: { domain: string, risk: low|medium|high }

trajectory_case_v1:
  caseId: string
  state: object
  allowedActions: [string]
  expectedAction: string
  expectedTool: string|null
  expectedArgs: object
  expectedObservationClass: string
  expectedTerminalCondition: string|null
```

Required metrics:

- actual retrieval: `precisionAtK`, `recallAtK`, `MRR`, `nDCG`, forbidden-evidence retrieval rate, source-policy accuracy.
- generation: claim faithfulness, required-claim coverage, response relevancy, noise sensitivity, unsupported-claim failure rate.
- agent: action selection accuracy, tool argument validity, evidence use accuracy, interview state safety, latency budget compliance.
- calibration: per-slice human-vs-judge disagreements, reviewer guidance and threshold decision.

Existing `eval:retrieval` remains a useful deterministic safety suite, but it must not be renamed or reported as the actual retrieval benchmark until it invokes the required runtime scoring path and writes ranked results.

### 驗證命令（Verification commands）

Run the smallest affected checks first. Expected future command groups are:

```text
backend: npm run test:jd
backend: npm run test:cv
backend: npm run test:match
backend: npm run test:questions
backend: npm run test:voice
backend: npm run test:report
backend: npm run test:retrieval
frontend: npm run test:all
frontend: npm run lint
```

Run broader `backend npm run test:all` and `frontend npm run quality:all` before a structural phase is considered complete when feasible. Do not run `eval:real` / `eval:all` unless credentials, cost and explicit user approval are in place.

## Rollout 與 rollback（Rollout and rollback）

### Temporary release flags

```text
ROLE_FIT_REPLACEMENT_KILL_SWITCH=true
ROLE_FIT_TAXONOMY_SOURCE=code|database
ROLE_FIT_LEGACY_READER_ENABLED=true
```

Before production cutover, `ROLE_FIT_REPLACEMENT_KILL_SWITCH` may return new traffic to the last verified implementation. At cutover the upgraded flow is the default and `ROLE_FIT_LEGACY_READER_ENABLED` serves only pre-cutover session snapshots. `ROLE_FIT_TAXONOMY_SOURCE=code` is temporary until database seed validation passes. All three flags require a removal owner and gate; no flag survives the removal phase.

### Phase 順序（Phase order）

1. Phase 0: characterization tests, fixtures, baseline metrics and legacy-removal manifest; no runtime change.
2. Phase 1: replace existing JD/company review contract in place with company understanding and role intent.
3. Phase 2: replace current match evidence projection with the extended reviewed-CV evidence and Role Evidence Map contract.
4. Phase 3: upgrade existing plan/question pool/ranker fields to proof metadata and coverage rules.
5. Phase 4: upgrade current report turn breakdown/QA/view model with Answer Alignment and role-fit coverage.
6. Phase 5: verify voice-first execution against the unchanged state machine and latency target.
7. Phase 6: run retrieval/grounding/trajectory/calibration evaluation, cut over new sessions, then remove legacy implementation.

### Rollback 規則（Rollback rules）

- Before cutover only, kill switch returns new traffic to the last verified build. After cutover it must not be used to create a permanent second product path.
- Pre-cutover artifacts are retained only until existing retention/resume rules permit cleanup; the schema adapter reads them without creating new legacy data.
- Plan/question/report loaders normalize absent Role-Fit fields only for pre-cutover snapshots.
- Degraded map/proof strategy uses explicit generic policy inside the upgraded planner; it is not a fallback to a separate old planner.
- If alignment fails, the upgraded report renders `alignment unavailable`; report generation must not become a global failure.
- Any deterministic privacy, ownership, source-trace, grounding, voice state or QA violation blocks release and requires rollback / kill switch before cutover.

## 驗收條件（Acceptance criteria）

### Phase 1 驗收（Phase 1 acceptance）

- Existing JD parse contract returns versioned CompanyUnderstandingProfile and RoleIntentProfile.
- Website-or-manual-context gate works in the upgraded backend and frontend flow.
- User confirmation is versioned and invalidates downstream drafts when source context changes.
- Characterization tests prove current unrelated JD/match/interview behavior remains valid before/after replacement.

### Phase 2 驗收（Phase 2 acceptance）

- Evidence Graph and Role Evidence Map persist owner/source traces.
- Mapping preserves direct/adjacent/weak/gap distinction and never promotes no-source evidence.
- Generic taxonomy fallback is tested.

### Phase 3 驗收（Phase 3 acceptance）

- Every must-cover intent is represented by a question or explicit degraded fallback.
- v2 and v3 question pool sessions run side by side.
- Live payload/UI hides evidence hints and diagnostics are report-safe.

### Phase 4 驗收（Phase 4 acceptance）

- AnswerAlignment exists only for accepted answer pairs and uses the defined score/label contract.
- Extended QA catches all listed failure codes; repair cannot suppress deterministic failures.
- Report view renders ready, limited, unavailable and legacy states responsively.

### Phase 5 驗收（Phase 5 acceptance）

- Role-Fit has no new critical-path LLM/company fetch in voice turns.
- Existing low-confidence transcript confirmation and question counting tests remain green.
- Latency tracing makes Role-Fit path costs diagnosable against the 3-second target.

### Phase 6 驗收（Phase 6 acceptance）

- Actual ranked retrieval results, generation grounding and agent trajectory records are written per evaluation case.
- Dataset versions/config fingerprints and sliced metrics are persisted.
- Human calibration documents judge disagreements before numerical release thresholds are asserted.
- Removal manifest proves new sessions have no legacy entrypoint/import; pre-cutover reader, old service branches, obsolete flags and superseded tests are deleted after their gate.

## 開放的實作限制（Open implementation constraints）

- New retention duration is intentionally not invented here. The implementation must attach new artifacts to the repository's existing retention/deletion policy, or request a separate product decision before enabling cleanup claims.
- This spec does not authorize a new external company-search provider, embedding provider, LLM judge provider or agent framework. Reuse current approved capabilities first; request approval before adding a dependency or external data flow.
- `ROLE_FIT_TAXONOMY_SOURCE=database` may become the default only after seed validation, rollback and generic fallback tests exist. Code taxonomy remains the legacy fallback until that phase passes.
- No real-CV or production transcript may be added to evaluation fixtures by convenience. Synthetic/anonymized evidence is a release requirement.
- A compatibility layer may not be retained merely because it is convenient. Its manifest must name the source files, persisted schema condition, tests, cutover criterion, cleanup criterion and owner before implementation begins.

## 驗證（Verification）

- Spec completeness: run `python3 /Users/heminghan/.codex/skills/spec-driven-development-blueprint/scripts/spec_lint.py docs/role-fit-spec.md --format json`.
- Source alignment: compare all requirements against the linked goal, gap audit and voice product behavior contract before code starts.
- Implementation verification: use the phase-specific focused test matrix above; update `repo-docs/` only after implemented behavior ships.

證據狀態：本文件是 v1 historical spec。RFI-002 至 RFI-015 的 local/mock-safe product/evaluator implementation與 RFI-016 新流量 cutover 已落地；當時 Phase 4 browser visual gate、Phase 5 live provider 3 秒 gate和真實 human calibration 尚未完成。Current V2 final 狀態請以 `docs/2026-07-11-role-fit-v2-spec.md`、`docs/2026-07-11-role-fit-v2-implementation-trace.md`、removal manifest 和 `backend/eval/reports/role-fit-release-gate.latest.json` 為準：12/12 calibration 已完成、threshold 0.85、browser visual 與 real-backend voice flow 已跑，release gate 為 `ready_with_known_issues`，唯一 known issue 是 voice next-question first audio 超過 3 秒。三個 pre-cutover evidence/question/report readers 的 final deletion 仍需要 production 14-day telemetry、migration 或 retention-window closure 證據，本地 repo 只能證明 new-flow cutover contract。
