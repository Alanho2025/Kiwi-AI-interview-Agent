# Report generation 与 QA

报告层把访谈结果变成 candidate-facing feedback，但它的设计重点是 grounding 和 visible status。报告不是把 transcript 喂给 LLM 后直接展示。

## 读者应该先记住什么

report generator 会建立 accepted-answer dataset、turn rubrics、scores、transcript risks、claim evidence references、coaching feedback 和 draft sections。report QA agent 再检查质量和一致性。QA 失败时，report 可以 non-ready；bounded repair 只处理合格范围内的 wording 问题。

## 一个代表 case

```text
输入: completed session + analysisResult + interviewPlan + retrievalBundle
动作: buildReportTurnDataset -> runReportGeneratorAgent -> runReportQaAgent -> persistReportArtifact
输出: SessionReport.latestStatus
边界: rubric_question_mismatch、score_metric_mismatch、invalid_answer_rewrite 等 blocking flags 不应被 repair 隐藏
```

## 代码怎么追

| 阶段 | 源码入口 | 说明 |
| --- | --- | --- |
| API | [report controller](../../backend/src/controllers/reportController.js) | 生成、QA、读取、导出报告 |
| Task runner | [master AI service](../../backend/src/services/masterAiService.js) | 执行 `generate_report`、`qa_report`、persist status |
| Report agent | [report generator agent](../../backend/src/services/agents/reportGeneratorAgent.js) | 构建 draft、scores、grounded claims |
| Turn dataset | [report turn dataset](../../backend/src/services/report/reportTurnDatasetService.js) | 只收集可计分 question/answer pairs |
| QA agent | [report QA agent](../../backend/src/services/agents/reportQaAgent.js) | quality flags、consistency checks、blocking flags |
| Repair loop | [QA repair orchestrator](../../backend/src/services/report/reportQaRepairOrchestratorService.js) | bounded wording repair |
| UI | [report components](../../frontend/src/components/report) | evidence、risks、turn breakdown、recording status |

## 怎么检查

报告测试集中在 `backend/tests/robustness/report` 和 frontend report view/API tests。它们测试的不是“报告看起来有文字”，而是 evidence totals、rubric alignment、turn export count、rewrite safety、transcript risks 和 score consistency。

继续读 [report generator agent](agent-report-generator.md) 和 [report QA agent](agent-report-qa.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

