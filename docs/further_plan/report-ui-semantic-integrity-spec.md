# Candidate Report UI Semantic Integrity Specification

> **實作狀態 (Implementation Status)**：Planned / Owner-approved specification；runtime code 尚未由本 task 修改。
>
> **校驗測試路徑 (Verified by Tests)**：None — documentation-only planning stage。

日期：2026-08-02 Pacific/Auckland  
對應 Goal：[Candidate Report UI Semantic Integrity Goal](report-ui-semantic-integrity-goal.md)  
上游契約：[QI-CP4 Report Alignment and Progress Coaching](../question_refine/04-report-progress-coaching.md)

## 1. Overview, risk and conflict rules

本 Spec 修復 candidate Report HTML 直接呈現的 semantic defects。Execution mode 是 **Forensic specialist**：先用 adversarial fixture 重現，再做 root-cause-only change；不得把它當作 UI redesign、report architecture rewrite或 #273 全量清理。

Risk class：High。錯誤可將 candidate question 當 answer、把 feedback/rewrite 掛到錯題、顯示錯 framework/score，或在 candidate 未提供的情況下捏造學校、公司、職位、技術與成果。

Conflict order：

1. Privacy、ownership、candidate publication allowlist。
2. Accepted-answer eligibility與 stable turn identity。
3. Deterministic rubric、framework score與 answer assessment。
4. LLM coaching wording。
5. Frontend rendering convenience。

遇到缺少或矛盾 evidence 時，target behaviour 是 unavailable / not assessed；禁止正向預設、相鄰 index fallback或 frontend-generated candidate facts。

## 2. Current baseline and target delta

| Area | Current verified baseline | Required target |
| --- | --- | --- |
| Rewrite UI | `TurnBreakdownSection` 在 rewrite 非 ready 時生成帶有 University of Auckland、ZURU、AI engine、85% rating 等固定內容。 | Frontend 不生成 candidate facts；非 ready 只顯示 unavailable或不顯示 rewrite正文。 |
| Candidate projection | `turnBreakdowns` 只發布 question/answer/feedback/status與 micro scores，沒有完整 safe framework contract。 | Server allowlist 發布 UI 必需的 safe rubric/framework fields，並繼續排除 IDs/traces/private evidence。 |
| Rewrite matching | Server normalizer 可回退到 partial match或 array index；projection 主要以 normalized question queue 配對。 | 以 stable internal identity或可證明的 exact Q&A identity配對；ambiguous/unmatched一律 unavailable。 |
| Answer dataset | User turn 可因 permissive metadata 被當成 pending interviewer question的 answer。 | Persisted candidate-question intent永不進 scored pair；保留 transcript但不產生 answer card。 |
| Feedback merge | LLM turn breakdown和 deterministic turn breakdown可依 index合併。 | Reorder、omission、insertion不移動後續 feedback；unknown/duplicate identity fail safe。 |
| Rubric fallback | Unknown/direct question可 universal fallback至 STARR。 | STARR只在 behavioural past-example contract成立時使用；其他採 direct/generic或 not evaluated。 |
| Dimension score | 未命中 signal但回答達字數門檻時可取得每個 dimension partial credit。 | Dimension credit需要 compatible signal；length只可影響獨立 clarity/concision。 |
| Answer result | Structure或question wording可補足 question alignment / role-intent fit。 | Target relevance與candidate-authored role connection各自成立後才給相應分數。 |
| Overall fallback | Adjacent experience可進 direct ratio。 | Direct與adjacent分開；若不能安全加權，adjacent不取得direct credit。 |
| Improvement advice | Asked/planned question count不同可觸發 concise-answer建議。 | Concision advice只由answer duration、word count或focus evidence觸發。 |

## 3. Scope and architecture direction

```text
transcript
  -> buildReportTurnDataset
  -> deterministic turn identity / rubric / assessment
  -> bounded report coaching
  -> buildCandidateReportProjection
  -> buildReportViewModel
  -> ReportPage / TurnBreakdownSection / CoachingSection
```

Dependency direction保持單向：frontend不得重算 backend identity、rubric或answer result；projection不得暴露internal IDs來換取client pairing；LLM output不得覆蓋deterministic fields。

No new API、event、database model、migration、dependency或provider call。Existing generate/read/QA rewrite endpoints繼續使用同一 candidate projection。

## 4. Candidate-facing and internal contracts

### 4.1 Candidate-safe turn display

```yaml
CandidateTurnDisplayV2:
  question: string
  answer: string
  feedback: string
  scores:
    business: number | null
    logic: number | null
    evidence: number | null
  rubricType: self_intro | company_motivation | starr | role_specific | conversation | direct | not_evaluated
  frameworkKey: allowlisted_string | null
  frameworkLabel: string | null
  starApplicable: boolean
  structureLabel: string | null
  frameworkBreakdown:
    normalizedScore: 0..10 | null
    summary: string | null
    dimensions:
      - key: allowlisted_string
        label: string
        status: clear | partial | missing | not_applicable
        score: 0..10
        reason: string
  starBreakdown: candidate_safe_breakdown | null
  answerAssessment:
    status: directly_addressed | partly_addressed | needs_clearer_connection | not_assessed
    score: 0..100 | null
    summary: string
    missingSignals: [candidate_safe_signal]
    nextStep: string
  strongerAnswer:
    status: ready | unavailable
    answer: string | null
    unavailableReason: string | null
```

Projection MUST recursively strip `turnId`, `questionId`, proof/coverage/evidence IDs, expected signals, rank trace, raw CV/JD, prompt/model reasoning, QA internals與diagnostic codes。Candidate-safe dimension reasons也必須經既有PII redaction。

### 4.2 Internal turn identity

Internal mapping order：

1. existing stable answer/turn identity；
2. existing stable question identity加same-answer identity；
3. exact normalized `(question, answer)` pair only when unique；
4. otherwise ambiguous/unmatched。

Array index、question-only partial match、answer-only partial match不得作為semantic identity。Ambiguous/unmatched model item被丟棄或隔離；該deterministic turn保留自己的framework/score並使用unavailable coaching。Internal identity不得出現在candidate payload。

## 5. Slice RUI-S1 — Rewrite and projection safety

### Functional requirements

1. 移除 `buildFallbackStrongerAnswerText` 的candidate-fact generation。
2. `status=unavailable` 必須顯示中性原因，不顯示綠色ready answer正文。
3. Rewrite normalization只接受可證明的same-pair match；duplicate/reordered output以pair queue或stable identity處理。
4. Candidate projection發布Section 4.1所需的最小safe framework fields。
5. Generate、read與QA rewrite response走相同projection contract。
6. Frontend component test必須以實際projected payload形狀驗證，不只使用raw internal fixture。

### Allowed files and blast radius

| Type | Allowed files |
| --- | --- |
| Production (3) | `backend/src/services/reportCoachingService.js`; `backend/src/services/report/reportPublicationSummaryService.js`; `frontend/src/components/report/TurnBreakdownSection.jsx` |
| Tests (3) | `backend/tests/robustness/report/reportQaRewriteCandidateProjection.test.js`; `backend/tests/robustness/contracts/reportPublicationSummary.test.js`; `frontend/src/components/report/__tests__/TurnBreakdownSection.test.jsx` |
| Implementation docs (2) | `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md`; `repo-docs/change-log.md` |

Direct blast radius：candidate report read/generate/QA-rewrite payload與turn card。  
Permitted indirect radius：shared candidate projection redaction。  
Explicitly unaffected：persisted raw report、provider call count、TXT/PDF layout、Voice、scores。  
Budget：3 production + 3 test + 2 docs files；≤300 incremental lines。  
Safe rollback：停用stronger-answer正文並保留unavailable；framework contract失敗時省略該section，不恢復fabricated fallback。

## 6. Slice RUI-S2 — Turn eligibility and feedback identity

### Functional requirements

1. `candidate_question`或等價persisted intent不建立`questionAnswerPairs`、`acceptedAnswers`或turn card。
2. 普通answer內的rhetorical question在persisted intent仍為candidate answer時保持可評分。
3. Deterministic turn breakdown保留server-only identity直到LLM merge完成。
4. LLM reorder、omission、insertion或duplicate不能把feedback移到其他turn。
5. Missing model feedback使用same-turn deterministic feedback；unknown model item不進candidate report。

### Allowed files and blast radius

| Type | Allowed files |
| --- | --- |
| Production (max 3) | `backend/src/services/report/reportTurnDatasetService.js`; `backend/src/services/agents/reportGeneratorAgent.js`; only if identity must cross normalization: `backend/src/services/reportCoachingService.js` |
| Tests (max 3) | `backend/tests/robustness/report/reportTurnDatasetRobustness.test.js`; `backend/tests/robustness/report/reportFrameworkPipeline.test.js`; if coaching normalization changes: `backend/tests/robustness/report/reportCoachingAndStarReview.test.js` |
| Implementation docs (2) | F-34 + `repo-docs/change-log.md` |

Direct blast radius：accepted answer count、turn cards、per-turn feedback。  
Permitted indirect radius：interview score/evidence summary因錯誤answer被排除而合理改變。  
Explicitly unaffected：live candidate-question handling、question selection、transcript persistence、legacy migration。  
Budget：≤3 production + ≤3 test + 2 docs files；≤280 incremental lines。  
Safe rollback：candidate-question turn維持excluded；無法配對的LLM feedback省略，不能恢復index merge。

## 7. Slice RUI-S3 — Visible rubric and answer-result truth

### Functional requirements

1. STARR只適用於metadata或wording明確要求past behavioural example的question。
2. Direct factual、technical knowledge、credential、availability和unknown question使用conservative direct/generic rubric或`not_evaluated`。
3. Role-specific dimension未命中compatible signal時為missing/0；answer length不得產生partial credit。
4. Question alignment先要求target relevance；off-topic STAR structure不得補分。
5. Role-intent fit只由candidate answer與approved intent contract的連結產生；question wording不能代答。
6. Framework score與Answer result獨立顯示，不合成新overall公式。

### Allowed files and blast radius

| Type | Allowed files |
| --- | --- |
| Production (3) | `backend/src/services/report/turnRubricService.js`; `backend/src/services/report/roleAnswerAnalysisService.js`; `backend/src/services/report/answerAlignmentService.js` |
| Tests (3) | `backend/tests/robustness/report/roleSpecificFrameworkRobustness.test.js`; `backend/tests/robustness/report/reportFrameworkPipeline.test.js`; `backend/tests/robustness/report/answerAlignmentService.test.js` |
| Implementation docs (2) | F-34 + `repo-docs/change-log.md` |

Direct blast radius：framework label/dimensions/score、Answer result badge/score/reason。  
Permitted indirect radius：existing interview performance可因corrected framework score改變；不得改overall formula或weights。  
Explicitly unaffected：question generation、Role-Fit coverage、evidence-use diagnostics、Match score。  
Budget：3 production + 3 test + 2 docs files；≤350 incremental lines。  
Rollback：unknown/direct turn顯示not evaluated；不得回到universal STARR或length credit。

## 8. Slice RUI-S4 — Visible score and coaching fallback truth

### Functional requirements

1. Fallback direct ratio只把`direct_past_experience`算作direct。
2. Adjacent evidence可有bounded credit only if既有公式能明確表達；本slice不得設計新scoring architecture。否則視為non-direct。
3. `Practise concise answers`需要實際duration、word-count或focus evidence。
4. Manual ending、time limit、repair/confirmation、degraded pool、no unique question、provider/controller completion不能被歸因於answer length。
5. 缺少causal evidence時省略該priority或使用不責怪candidate的中性completion wording。

### Allowed files and blast radius

| Type | Allowed files |
| --- | --- |
| Production (2) | `backend/src/services/report/reportScoreService.js`; `frontend/src/utils/reportView/coaching.js` |
| Tests (2) | `backend/tests/robustness/report/reportFrameworkPipeline.test.js`; `frontend/src/utils/__tests__/crossRoleReportFallbacks.test.js` |
| Implementation docs (2) | F-34 + `repo-docs/change-log.md` |

Direct blast radius：legacy/fallback interview overall、derived score band、Improvement priorities。  
Permitted indirect radius：hero score band由corrected overall自然更新。  
Explicitly unaffected：framework formula、question planning、completion controller、analytics。  
Budget：2 production + 2 test + 2 docs files；≤220 incremental lines。  
Rollback：省略無證據advice；不得恢復錯誤因果或adjacent-as-direct。

## 9. Failure, compatibility and lifecycle

| Condition | Required behavior |
| --- | --- |
| Missing/duplicate identity | Quarantine model item；same-turn deterministic content + unavailable。 |
| Missing framework metadata | Direct/generic/not-evaluated；不能默認STARR。 |
| Unsafe rewrite | 不顯示rewrite正文；保留原answer與feedback。 |
| Legacy report | 不重算、不寫回；顯示既有regenerate/limitation path。 |
| Projection leak | Fail candidate publication test；不得以client hiding補救。 |
| Provider malformed/reordered output | No retry from page open；bounded current generation path only。 |

No retention/deletion change。No new concurrent writer or idempotency key。Existing report regeneration semantics保持不變。

## 10. BDD scenarios

```gherkin
Scenario: Unavailable rewrite never invents candidate facts
  Given a projected turn whose strongerAnswer status is unavailable
  When the candidate expands the report card
  Then the UI shows an unavailable message or no rewrite body
  And it does not add any school company role technology metric or outcome

Scenario: Reordered duplicate questions keep the correct answer rewrite
  Given two accepted turns with the same question and different answers
  And the model returns rewrites in a different order
  When candidate projection is built
  Then each rewrite is attached by the exact question and answer identity
  And an ambiguous item is unavailable rather than index-matched

Scenario: Omitted model feedback does not shift later cards
  Given three deterministic turns and model feedback for only turns one and three
  When feedback is merged
  Then turn three keeps its own feedback
  And turn two uses its own deterministic fallback

Scenario: Candidate question remains transcript-only
  Given a persisted candidate-question intent after an interviewer prompt
  When the report dataset is built
  Then it does not create a scored answer pair or report card

Scenario: Unknown direct question is not STARR
  Given a direct or unknown question without behavioural metadata
  When its rubric is inferred
  Then STARR is not selected
  And the selection reason remains conservative and traceable

Scenario: Long irrelevant answer receives no dimension credit
  Given a fifty-word answer with no validation or risk-control signal
  When role-specific dimensions are scored
  Then validation and risk-control remain missing with score zero

Scenario: Off-topic STAR structure is not a direct answer
  Given a detailed conflict story answering a technical validation question
  When answer assessment is calculated
  Then question alignment remains low
  And role-intent fit is not supplied by the question wording

Scenario: Adjacent evidence is not direct evidence
  Given one adjacent answer and no direct-past-experience answer
  When fallback interview score is calculated
  Then direct evidence ratio is not one hundred percent

Scenario: Question-count mismatch does not blame concision
  Given an interview ended manually with fewer questions than planned
  And there is no duration word-count or focus evidence
  When fallback improvement priorities are built
  Then Practise concise answers is not shown
```

## 11. Verification gates

Run only the current slice's focused commands from the affected package.

| Slice | Backend focused test | Frontend focused test |
| --- | --- | --- |
| S1 | `./node_modules/.bin/vitest run tests/robustness/report/reportQaRewriteCandidateProjection.test.js tests/robustness/contracts/reportPublicationSummary.test.js` | `./node_modules/.bin/vitest run src/components/report/__tests__/TurnBreakdownSection.test.jsx` |
| S2 | `./node_modules/.bin/vitest run tests/robustness/report/reportTurnDatasetRobustness.test.js tests/robustness/report/reportFrameworkPipeline.test.js tests/robustness/report/reportCoachingAndStarReview.test.js` | Not required unless frontend unexpectedly changes; such a change is a stop condition。 |
| S3 | `./node_modules/.bin/vitest run tests/robustness/report/roleSpecificFrameworkRobustness.test.js tests/robustness/report/reportFrameworkPipeline.test.js tests/robustness/report/answerAlignmentService.test.js` | Not required；existing component rendering contract由S1固定。 |
| S4 | `./node_modules/.bin/vitest run tests/robustness/report/reportFrameworkPipeline.test.js` | `./node_modules/.bin/vitest run src/utils/__tests__/crossRoleReportFallbacks.test.js` |

Affected backend slice跑`npm run lint` from `backend`；affected frontend slice跑`npm run lint` from `frontend`。每個slice另跑task-scoped `git diff --check`。

S1、S2、S3需要一個實際candidate Report HTML manual/browser check：確認card順序、framework、Answer result、unavailable state與mobile/desktop expansion。這是human/browser evidence，不能由component test替代。Real-provider eval、full suite與production smoke不是常規slice gate。

Cycle 3由同一個independent auditor返回final evidence matrix；matrix至少包含identity、candidate safety、semantic correctness、scope/file budget、tests與docs sync。Auditor前不得宣稱PASS。

## 12. Acceptance criteria and rollout

Milestone acceptance需要四個slices各自通過：

- 無candidate-visible fabricated stronger answer。
- 無candidate-question answer card或cross-turn feedback/rewrite。
- API projection實際提供UI所需safe framework contract且無internal leak。
- Unknown/direct question不誤用STARR；length不產生rubric evidence。
- Off-topic structure/question wording不製造positive answer result。
- Adjacent evidence與question-count mismatch不製造錯overall/advice。

Rollout限new/regenerated reports。每個slice保持獨立commit/PR/rollback boundary。不得自動close GitHub issue；issue closure需要current-main code、focused tests、auditor evidence與必要human/browser evidence。

## 13. Terra Extra High execution instructions

每次只給Terra Extra High一個slice identifier和本Spec：

1. 讀root instructions、current slice、allowed files與直接相關source/tests。
2. 記錄task-scoped dirty baseline；不得讀取或歸屬unrelated dirty files。
3. 先重現BDD negative case；不能重現時停止並報告evidence gap。
4. 只修改allowed files；不做adjacent cleanup、refactor、renaming或test weakening。
5. 遵守三cycles；使用`git diff`避免重讀unchanged files。
6. 完成focused tests、lint、diff check和同一auditor final matrix後停止。
7. 回報task-owned files、pre-existing dirty paths未觸碰、每檔原因、NOT RUN gates與下一個slice；不得自行開始下一slice。

## 14. Assumptions, hard stops and human approval

Approved assumptions：HTML first、no visual redesign、no legacy migration、no new provider request、server-owned allowlist、fail-safe unavailable。

Implementation hard stops：

- 超過slice file/diff budget或需要Spec未列出的production file。
- 需要persist新identity、schema/migration、endpoint、dependency或provider call。
- 需要修改Voice、Match、question selection、analytics、diagnostics或TXT/PDF layout。
- Candidate-safe mapping只能靠發布private ID/trace完成。
- 發現security/privacy exposure或owner mismatch。

Human approval：Goal/Spec drafting approved on 2026-08-02；runtime implementation、browser acceptance、release、push與deployment仍需各自明確授權。Spec validation只證明文件結構與可執行性，不證明runtime、browser、human、live-provider或production完成。
