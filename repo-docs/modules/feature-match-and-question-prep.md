# Match 与问题准备

match 层把 reviewed CV 和 reviewed JD 变成两类下游资产：可展示的 fit 分析，以及访谈控制器可以使用的问题材料。它不是只算一个分数。

## 读者应该先记住什么

`matchCV` 先核对 persisted role-fit review 的 owner、fingerprint、profile ID 和 version，再调用现有 CV-JD match service。Matcher 为每个 role intent 生成 grounded Role Evidence Map，按 `direct`、`adjacent`、`weak`、`gap` 分级；没有明确 CV source trace 的语义相似结果不能进入 direct/adjacent。结果写入 match analysis record 后，系统再尝试生成 JD question filter。

## 一个代表 case

```text
输入: cvId + rawJD/jdRubric + settings
动作: runCvJdMatchAnalysis -> createMatchAnalysisRecord -> buildJdQuestionFilter
输出: matchAnalysisId + source-linked evidenceRefs + roleEvidenceMap + prepared question pool readiness
边界: 新 role-fit request 未持久化确认时 match 返回 review conflict；pre-cutover reviewed JD 暂时带 `legacy_reviewed_jd` 标记继续运行
```

## 代码怎么追

| 机制 | 源码入口 | 下游影响 |
| --- | --- | --- |
| match API orchestration | [analyze controller](../../backend/src/controllers/analyzeController.js) | 连接 match、audit、usage、JD filter、plan |
| CV-JD comparison | [CV analysis service](../../backend/src/services/cv/cvAnalysisService.js) 和 [match services](../../backend/src/services/match) | 产出 strengths、gaps、score、evidence |
| grounded evidence 分级 | [Role Evidence Map service](../../backend/src/services/match/roleEvidenceMapService.js) | 使用 semantic relevance、requirement/intent fit、specificity、ownership 与 outcome signals 分级 |
| match persistence | [match analysis record service](../../backend/src/services/cv/matchAnalysisRecordService.js) | 让 interview plan 使用稳定 `matchAnalysisId` |
| JD filter | [JD question filter service](../../backend/src/services/questions/jdQuestionFilterService.js) | 把 JD priority 和 gap 变成问题选择信号 |
| pool composition | [question pool composer](../../backend/src/services/questions/questionPoolComposerService.js) | 组合 opening、role requirement、gap、behavioural、wrap-up 等问题 |
| pool readiness | [question pool preparation](../../backend/src/services/questions/questionPoolPreparationService.js) | 去重、生成 reserves、标记 degraded readiness |

## 怎么检查

后端相关测试集中在 `backend/tests/robustness/match` 和 `backend/tests/robustness/questions`。Role Evidence Map 的 source-trace gate、分级和 schema preservation 在 `roleEvidenceMapRobustness.test.js`；question pool ranker、dedupe 与 prepared runtime selection 仍证明 prepared pool 是候选材料，不是固定脚本。

继续读 [interviewer agent](agent-interviewer.md)，看运行时如何从 prepared pool、follow-up 和 fallback 中选择下一问。

证据状态：除特别标注外，本页基于当前源码已确认。
