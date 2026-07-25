# Report generation 与 QA

报告层把访谈结果变成 candidate-facing feedback，但它的设计重点是 grounding 和 visible status。报告不是把 transcript 喂给 LLM 后直接展示。

## 读者应该先记住什么

report generator 会建立 accepted-answer dataset、turn rubrics、scores、transcript risks、claim evidence references、coaching feedback 和 draft sections。对于 v3 Role-Fit question，它还会产生 `answer_alignment_v2`、role intent coverage、evidence usage、user-safe question reason 和 `role_fit_diagnostics_v1` compact diagnostics。Answer Alignment v2 使用六个分项：question alignment、evidence fit、evidence clarity、role intent fit、naturalness 和 concision，并记录 recommended evidence 是否真的被使用。Role-Fit diagnostics 则记录 report 侧看到的 proof strategy / answer alignment readiness、coverage count 和 degraded reasons，不复制原始 CV/JD 证据。report QA agent 再检查质量和一致性。QA 失败时，report 可以 non-ready；bounded repair 只处理合格范围内的 wording 问题。

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
| API | [report controller](../../backend/src/controllers/reportController.js) | 生成、QA、读取、导出报告 |
| Task runner | [master AI service](../../backend/src/services/masterAiService.js) | 执行 `generate_report`、`qa_report`、persist status |
| Report agent | [report generator agent](../../backend/src/services/agents/reportGeneratorAgent.js) | 构建 draft、scores、grounded claims |
| Turn dataset | [report turn dataset](../../backend/src/services/report/reportTurnDatasetService.js) | 只收集可计分 question/answer pairs |
| Answer Alignment | [answer alignment service](../../backend/src/services/report/answerAlignmentService.js) | 只对 accepted pair 计算 v2 六分项、0-100 breakdown、evidence-use diagnosis 和 coverage |
| Role-Fit diagnostics | [Role-Fit diagnostics service](../../backend/src/services/roleFit/roleFitDiagnosticsService.js) | 把 evidence map、proof strategy 和 answer alignment 状态压缩成 report-safe diagnostics |
| QA agent | [report QA agent](../../backend/src/services/agents/reportQaAgent.js) | quality flags、consistency checks、blocking flags |
| Repair loop | [QA repair orchestrator](../../backend/src/services/report/reportQaRepairOrchestratorService.js) | bounded wording repair |
| M4 report harness | [report workflow harness](../../backend/src/services/harness/reportWorkflowHarness.js)、[publication policy](../../backend/src/services/harness/reportPublicationPolicy.js) | 记录 refs-only run、QA gate、failure 和 repair lineage；目前 observe only |
| Candidate status API | [publication summary service](../../backend/src/services/report/reportPublicationSummaryService.js)、[report controller](../../backend/src/controllers/reportController.js) | 把 persisted report status 映射为 allowlisted `report_publication_summary_v1`，不复制 QA flags 或内部推理 |
| UI/export | [Report Trust Status](../../frontend/src/components/report/ReportTrustStatusCard.jsx)、[Role-Fit report section](../../frontend/src/components/report/RoleFitReportSection.jsx)、[report components](../../frontend/src/components/report) | 显示安全的 verification explanation、recheck/regenerate action、role focus、evidence、risks、turn breakdown；TXT/PDF 行为不变 |

## Publication harness 当前边界

`generate_report` 和 `qa_report` 现在都会产生正式 harness run，并把现有 QA 结果映射成 `report_publication_allowed` gate。critical flag 是 observed `block`，其他 failed QA 是 `review`，pass 才是 `ready` / `ready_after_repair`。这个 gate 目前 `enforced=false`，current controller 的 status 和 candidate visibility 仍是产品 authority。

`qa_report` 只验证和持久化 QA，不会 silent rewrite。现有 `generate_report` 仍包含 bounded inline wording repair；harness 会记录 `legacyInlineRepairObserved=true` 和 `explicitChildRunsComplete=false`。在 repair 变成 explicit action/child run、完成 false-block 人工校准并决定 visibility/download/export policy 前，不能进入 enforcement。

Candidate 现在会在报告页看到独立的 Report Trust Status。`ready`、`ready_after_repair`、`needs_review`、`repair_failed` 分别映射为已检查、修复后已检查、需要复核、验证未完成的安全说明；需要时可重新检查或重新生成。API 只回传 allowlisted summary，不回传 raw QA flags、prompt、candidate evidence text 或 internal trace。这个 UI 没有改变 persisted status authority，也没有改变下载、TXT/PDF export 或 candidate visibility。

M6 同时记录 report write decision，但目前会诚实标示 `sideEffectStatus=completed_before_observe_gate`：现有 controller 先持久化，harness 再观察。该 decision 仍是 `enforced=false`，因此不能用来宣称 publication 已被 pre-write gate 阻挡。

## 怎么检查

报告测试集中在 `backend/tests/robustness/report`、`backend/tests/robustness/contracts/reportPublicationPolicy.test.js`、`reportWorkflowHarness.test.js`、`reportPublicationSummary.test.js` 和 frontend report view/API tests。它们测试的不是“报告看起来有文字”，而是 accepted-answer-only、Answer Alignment v2 六分项、alignment score 0-100、evidence-use diagnosis、Role-Fit diagnostics、evidence IDs、must-cover coverage、QA blocking、candidate-safe status、turn export count、rewrite safety，以及 UI/TXT/PDF legacy/unavailable behavior。M4 eval 覆盖现有 17 个 critical flags，false negative 为 0；unsupported noncritical claim 仍会进入 review，不会标成 publishable。`npm run test:e2e:role-fit-visual` 现在会同时截取 Role-Fit 和 Report Trust Status 的 desktop/mobile screenshots；component tests 和 visual gate 分开记录。

继续读 [report generator agent](agent-report-generator.md) 和 [report QA agent](agent-report-qa.md)。

证据状态：除特别标注外，本页基于当前源码已确认。
