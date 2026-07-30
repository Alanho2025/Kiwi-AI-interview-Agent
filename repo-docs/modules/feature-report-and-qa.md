# Report generation 与 QA

报告层把访谈结果变成 candidate-facing feedback，但它的设计重点是 grounding 和 visible status。报告不是把 transcript 喂给 LLM 后直接展示。

## 读者应该先记住什么

report generator 会建立 accepted-answer dataset、turn rubrics、scores、transcript risks、claim evidence references、coaching feedback 和 draft sections。对于 Role-Fit question，它会产生 `answer_alignment_v2`、role intent coverage、evidence usage、user-safe question reason、`role_fit_diagnostics_v1` 和 `role_fit_coaching_progress_v1`。Answer Alignment v2 使用六个分项：question alignment、evidence fit、evidence clarity、role intent fit、naturalness 和 concision，并记录 recommended evidence 是否真的被使用。Clarification / AI judgement coaching 只引用 allowlisted 的 accepted-answer、scope event 或 question-type source，且不能改分。Role-Fit diagnostics 与 QA 结果仍会在 server 侧生成，但候选人读取报告时会经过独立 allowlist；Role-Fit breakdown/coaching 不发布给候选人。Candidate 只看到可信状态、三个主要分数、简短说明、最多三个改善重点、正式逐题反馈、answer rewrite、legacy limitation 和 material transcript risk。

## 一个代表 case

```text
输入: completed session + analysisResult + interviewPlan + retrievalBundle
动作: buildReportTurnDataset -> runReportGeneratorAgent -> runReportQaAgent -> persistReportArtifact
输出: SessionReport.latestStatus + report.roleFit
边界: rubric/score/rewrite 与 Role-Fit grounding/ownership/coverage blocking flags 不应被 repair 隐藏
```

## 代码怎么追

| 阶段 | 源码入口 | 说明 |
| --- | --- | --- |
| API | [report controller](../../backend/src/controllers/reportController.js) | 生成、QA、读取、导出报告；generate/read/QA rewrite、JSON/TXT export 都先做 candidate-safe projection；reflection 可独立保存，但不进入 candidate report 或评分 |
| Task runner | [master AI service](../../backend/src/services/masterAiService.js) | 执行 `generate_report`、`qa_report`、persist status |
| Report agent | [report generator agent](../../backend/src/services/agents/reportGeneratorAgent.js) | 构建 draft、scores、grounded claims |
| Turn dataset | [report turn dataset](../../backend/src/services/report/reportTurnDatasetService.js) | 只收集可计分 question/answer pairs |
| Answer Alignment | [answer alignment service](../../backend/src/services/report/answerAlignmentService.js) | 只对 accepted pair 计算 v2 六分项、0-100 breakdown、evidence-use diagnosis、clarification/AI judgement coaching 和 progress hypothesis |
| Role-Fit diagnostics | [Role-Fit diagnostics service](../../backend/src/services/roleFit/roleFitDiagnosticsService.js) | 把 evidence map、proof strategy 和 answer alignment 状态压缩成 report-safe diagnostics |
| QA agent | [report QA agent](../../backend/src/services/agents/reportQaAgent.js) | quality flags、consistency checks、blocking flags；阻挡 coaching 无来源、泄漏、改分或无效 progress |
| Repair loop | [QA repair orchestrator](../../backend/src/services/report/reportQaRepairOrchestratorService.js) | bounded wording repair |
| M4 report harness | [report workflow harness](../../backend/src/services/harness/reportWorkflowHarness.js)、[publication policy](../../backend/src/services/harness/reportPublicationPolicy.js) | 记录 refs-only run、QA gate、failure 和 repair lineage；目前 observe only |
| Candidate status API | [publication summary service](../../backend/src/services/report/reportPublicationSummaryService.js)、[report controller](../../backend/src/controllers/reportController.js) | server-owned allowlist 保留 candidate 可操作内容；排除 Role-Fit、QA prompt/flags、formula、cost/token、commercial stress、raw evidence/trace、internal IDs 与 reflection，并递归遮蔽 email、phone、street address |
| Developer diagnostics | [report diagnostics controller](../../backend/src/controllers/reportDiagnosticsController.js)、[developer diagnostics component](../../frontend/src/components/report/DeveloperReportDiagnostics.jsx) | 分离 API、lazy load、authenticated owner scope、non-production only；包含 question selection/match-gap refs、turn eligibility、QA、cost 和 harness timeline；production backend fail closed，PII 仍遮蔽 |
| UI/export | [candidate summary](../../frontend/src/components/report/CandidateReportSummary.jsx)、[report page](../../frontend/src/pages/ReportPage.jsx)、[PDF template](../../frontend/src/utils/reportPdf/reportPdfTemplate.js) | 精简 reading order；HTML/JSON/TXT/PDF 不显示 Role-Fit、Commercial Stress、Evidence Sources、QA controls、optional reflection form、重复详情或 developer diagnostics；legacy/transcript risk 在各格式保留 |

## Publication harness 当前边界

`generate_report` 和 `qa_report` 现在都会产生正式 harness run，并把现有 QA 结果映射成 `report_publication_allowed` gate。critical flag 是 observed `block`，其他 failed QA 是 `review`，pass 才是 `ready` / `ready_after_repair`。这个 gate 目前 `enforced=false`，current controller 的 status 和 candidate visibility 仍是产品 authority。

`qa_report` 只验证和持久化 QA，不会 silent rewrite。现有 `generate_report` 仍包含 bounded inline wording repair；harness 会记录 `legacyInlineRepairObserved=true` 和 `explicitChildRunsComplete=false`。在 repair 变成 explicit action/child run、完成 false-block 人工校准并决定 visibility/download/export policy 前，不能进入 enforcement。

Candidate 现在会在报告页看到安全的 trust/summary 状态。`ready`、`ready_after_repair`、`needs_review`、`repair_failed` 分别映射为已检查、修复后已检查、需要复核、验证未完成的说明；需要时可重新生成。API 不回传 raw QA flags、prompt、candidate evidence text、cost/token 或 internal trace。Developer 若在非 production 环境主动打开诊断 toggle，才会从分离的 owner-scoped endpoint 读取内部数据。

旧 session 若把明显的 clarification 错记为 `user_answer`，读取或导出时会显示 `legacy_clarification_may_have_been_scored` 与 regenerate 提示。系统不会静默改写原 transcript，也不会声称旧分数已经自动修复。

M6 同时记录 report write decision，但目前会诚实标示 `sideEffectStatus=completed_before_observe_gate`：现有 controller 先持久化，harness 再观察。该 decision 仍是 `enforced=false`，因此不能用来宣称 publication 已被 pre-write gate 阻挡。

## 怎么检查

报告测试集中在 `backend/tests/robustness/report`、`backend/tests/robustness/contracts/reportPublicationPolicy.test.js`、`reportWorkflowHarness.test.js`、`reportPublicationSummary.test.js`、`reportDiagnosticsController.test.js` 和 frontend report view/API/PDF tests。它们覆盖 accepted-answer-only、candidate projection allowlist、nested PII redaction、legacy warning、owner scope、production deny，以及 UI/TXT/PDF 不出现 Role-Fit、QA/cost/evidence/reflection 噪音。2026-07-30 local verification 为 backend report robustness group 100 tests、frontend complete quality gate 335 tests 与 production build；desktop/mobile 人工视觉、PDF 人工搜索和 Product Owner 报告复核仍未执行。

继续读 [report generator agent](agent-report-generator.md) 和 [report QA agent](agent-report-qa.md)。

证据状态：除特别标注外，本页基于当前源码已确认。
