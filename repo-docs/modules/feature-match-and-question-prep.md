# Match 与问题准备

match 层把 reviewed CV 和 reviewed JD 变成两类下游资产：可展示的 fit 分析，以及访谈控制器可以使用的问题材料。它不是只算一个分数。

## 读者应该先记住什么

`matchCV` 会调用 CV-JD match service，写入 match analysis record，然后尝试生成 JD question filter。`generateInterviewPlan` 会创建 session、恢复或生成 CV question seeds、准备 DB-backed question pool，并把 readiness 带回去。失败时系统偏向降级和记录 warning，而不是让用户看不到任何访谈路径。

## 一个代表 case

```text
输入: cvId + rawJD/jdRubric + settings
动作: runCvJdMatchAnalysis -> createMatchAnalysisRecord -> buildJdQuestionFilter
输出: matchAnalysisId + evidenceRefs + prepared question pool readiness
边界: JD question filter 或 pool composition 失败时，访谈可以继续，但问题特异性会下降
```

## 代码怎么追

| 机制 | 源码入口 | 下游影响 |
| --- | --- | --- |
| match API orchestration | [analyze controller](../../backend/src/controllers/analyzeController.js) | 连接 match、audit、usage、JD filter、plan |
| CV-JD comparison | [CV analysis service](../../backend/src/services/cv/cvAnalysisService.js) 和 [match services](../../backend/src/services/match) | 产出 strengths、gaps、score、evidence |
| match persistence | [match analysis record service](../../backend/src/services/cv/matchAnalysisRecordService.js) | 让 interview plan 使用稳定 `matchAnalysisId` |
| JD filter | [JD question filter service](../../backend/src/services/questions/jdQuestionFilterService.js) | 把 JD priority 和 gap 变成问题选择信号 |
| pool composition | [question pool composer](../../backend/src/services/questions/questionPoolComposerService.js) | 组合 opening、role requirement、gap、behavioural、wrap-up 等问题 |
| pool readiness | [question pool preparation](../../backend/src/services/questions/questionPoolPreparationService.js) | 去重、生成 reserves、标记 degraded readiness |

## 怎么检查

后端相关测试集中在 `backend/tests/robustness/match` 和 `backend/tests/robustness/questions`。尤其要看 question pool ranker、dedupe、prepared runtime selection，因为它们证明 prepared pool 是候选材料，不是固定脚本。

继续读 [interviewer agent](agent-interviewer.md)，看运行时如何从 prepared pool、follow-up 和 fallback 中选择下一问。

证据状态：除特别标注外，本页基于当前源码已确认。

