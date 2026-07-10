# Report generation 与 QA

报告层把访谈结果变成 candidate-facing feedback，但它的设计重点是 grounding 和 visible status。报告不是把 transcript 喂给 LLM 后直接展示。

## 读者应该先记住什么

report generator 会建立 accepted-answer dataset、turn rubrics、scores、transcript risks、claim evidence references、coaching feedback 和 draft sections。对于 v3 Role-Fit question，它还会产生 Answer Alignment、role intent coverage、evidence usage 和 user-safe question reason。report QA agent 再检查质量和一致性。QA 失败时，report 可以 non-ready；bounded repair 只处理合格范围内的 wording 问题。

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
| Answer Alignment | [answer alignment service](../../backend/src/services/report/answerAlignmentService.js) | 只对 accepted pair 计算 0-100 breakdown、evidence use 和 coverage |
| QA agent | [report QA agent](../../backend/src/services/agents/reportQaAgent.js) | quality flags、consistency checks、blocking flags |
| Repair loop | [QA repair orchestrator](../../backend/src/services/report/reportQaRepairOrchestratorService.js) | bounded wording repair |
| UI/export | [Role-Fit report section](../../frontend/src/components/report/RoleFitReportSection.jsx)、[report components](../../frontend/src/components/report) | plain-language role focus、answer alignment、evidence、risks、turn breakdown、TXT/PDF |

## 怎么检查

报告测试集中在 `backend/tests/robustness/report` 和 frontend report view/API tests。它们测试的不是“报告看起来有文字”，而是 accepted-answer-only、alignment score、evidence IDs、must-cover coverage、QA blocking、turn export count、rewrite safety，以及 UI/TXT/PDF legacy/unavailable behavior。2026-07-10 的 browser screenshot gate 因执行环境权限待补，不把 component tests 冒充 pixel evidence。

继续读 [report generator agent](agent-report-generator.md) 和 [report QA agent](agent-report-qa.md)。

证据状态：除特别标注外，本页基于当前源码已确认。
