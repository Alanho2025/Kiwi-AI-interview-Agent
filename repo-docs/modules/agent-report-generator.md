# Report generator agent

report generator agent 把 completed session 变成报告草稿。它先做 deterministic dataset、score、rubric 和 evidence work，再调用 coaching/report builders，最后做 claim grounding 和 schema validation。

## 它在哪里被调用

实现位于 [report generator agent](../../backend/src/services/agents/reportGeneratorAgent.js)，由 `runTask({ taskType: 'generate_report' })` 调用。

## 一个代表 case

```text
输入: session + analysisResult + interviewPlan + retrievalBundle
动作: buildReportTurnDataset -> analyseCandidateAnswers -> buildReportScores -> groundCandidateFeedbackClaims -> validateReportOutput
输出: report draft with scores、sections、candidateFeedback、evidenceReferences、transcriptRisks
边界: non-countable turns 不应进入 scored answer dataset
```

## 它做什么决策

它决定哪些 turns 可计分、每个 answer 使用什么 rubric、如何组合 deterministic feedback 与 generated coaching、哪些 claims 有 evidence references、哪些 transcript risks 需要展示。

## 输出和持久化

agent 返回 validated report object；持久化由 [master AI service](../../backend/src/services/masterAiService.js) 的 report artifact flow 负责，写入 `SessionAnalysis` 和 `SessionReport`。

## 怎么检查

重点 tests 在 `backend/tests/robustness/report/reportTurnDatasetRobustness.test.js`、`reportGroundingRobustness.test.js`、`reportFrameworkPipeline.test.js`。继续读 [report QA agent](agent-report-qa.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

