# Report QA agent

report QA agent 是报告状态的守门器。它不是润色器；它检查 report 是否有缺段、错配、证据空洞、分数不一致、rewrite 无效、transcript risk 未展示等问题。

## 它在哪里被调用

实现位于 [report QA agent](../../backend/src/services/agents/reportQaAgent.js)，由 `runTask({ taskType: 'qa_report' })` 或 report generation flow 调用。repair 编排在 [QA repair orchestrator](../../backend/src/services/report/reportQaRepairOrchestratorService.js)。

## 一个代表 case

```text
输入: report + analysisResult + retrievalBundle
动作: collect qualityFlags -> run consistencyChecks -> validateReportQaOutput
输出: passed、coverageScore、hallucinationRisk、blocking flags、diagnostics
边界: BLOCKING_REPORT_FLAGS 命中时，报告不能被简单 wording repair 洗成 ready
```

## 它做什么决策

它决定 report 是否可发布为 ready。blocking flags 包含 `rubric_question_mismatch`、`evidence_total_mismatch`、`score_metric_mismatch`、`invalid_answer_rewrite`、`uninformative_evidence_references`、`turn_export_count_mismatch` 和 transcript conflict。

## 输出和持久化

QA result 会被 task runner 与 report 一起写入 `SessionReport.latestStatus`、`qaAttemptCount`、`repairHistory` 和 `reportVersions`。

## 怎么检查

相关 tests 在 `backend/tests/robustness/report/reportFrameworkQa.test.js`、`reportContentQualityRobustness.test.js`、`promptInjectionReportRobustness.test.js`。

继续读 [报告与 QA](feature-report-and-qa.md)，看 QA 如何影响用户可见报告状态。

证据状态：除特别标注外，本页基于当前源码已确认。

