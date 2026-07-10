# Match 与问题准备

match 层把 reviewed CV 和 reviewed JD 变成两类下游资产：可展示的 fit 分析，以及访谈控制器可以使用的问题材料。它不是只算一个分数。

## 读者应该先记住什么

`matchCV` 先核对 persisted role-fit review 的 owner、fingerprint、profile ID 和 version，再调用现有 CV-JD match service。Matcher 为每个 role intent 生成 grounded Role Evidence Map，按 `direct`、`adjacent`、`weak`、`gap` 分级；没有明确 CV source trace 的语义相似结果不能进入 direct/adjacent。结果写入 match analysis record 后，系统再尝试生成 JD question filter。

## 一个代表 case

```text
输入: cvId + rawJD/jdRubric + settings
动作: runCvJdMatchAnalysis -> createMatchAnalysisRecord -> buildJdQuestionFilter
输出: matchAnalysisId + source-linked evidenceRefs + roleEvidenceMap + prepared question pool readiness
边界: 新 match 未带 owner-scoped persisted Role-Fit review 时直接阻挡；旧 `humanReviewStatus` client marker 不再能开启新 match
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

## Phase 3 当前行为

2026-07-10 的 Phase 3 checkpoint 已完成 proof strategy、role-fit question metadata、must-cover reconciliation、coverage/gap ranking 和 evidence overuse penalty。新 question item explicit write 与 model default 都是 v3；pre-cutover 的 v2/无版本 snapshot 仍通过 bounded reader 完成旧 session。新 match/result/RAG/report 主路徑優先使用 `roleEvidenceMap`，不再把 legacy match evidence summary 當第二份資料來源。

| 验收项 | 当前状态 | 主要边界 |
| --- | --- | --- |
| 每个 must-cover 有问题或显式降级 | 已通过 | `roleFitQuestionCoverageService` 检查实际 pool；缺题时建立 bounded deterministic v3 fallback，仍无法表示时标记 degraded |
| v2/v3 session 并行 | 已通过 | 新 item 写 v3；v2/无版本 snapshot 由现有 validator/preparation defaults 读取，targeted compatibility tests 已覆盖 |
| live payload 不含 evidence hints | 已通过 | HTTP、SSE 与 WebSocket 使用 allowlisted session/turn view；proof/evidence/rank/ReAct private fields 不进入 client payload |

Analyze 页面只取得 focus area、gap 和题数的安全摘要，并以非技术使用者能理解的英文说明是否可开始练习或需要检查输入；不会显示 schema、coverage ID、proof point 或 ranking 术语。

## 怎么检查

后端相关测试集中在 `backend/tests/robustness/match`、`questions`、`server` 和 `voice`。Role Evidence Map 的 source-trace gate、分级和 schema preservation 在 `roleEvidenceMapRobustness.test.js`；Phase 3 的 completeness、v2/v3 compatibility、session payload sanitization、真实 transcript ledger shape 和 rank adjustment 分别由 question/server/voice targeted tests 覆盖。前端 plain-language review 由 `ProofStrategyReviewPanel.test.jsx` 覆盖。

继续读 [interviewer agent](agent-interviewer.md)，看运行时如何从 prepared pool、follow-up 和 fallback 中选择下一问。

证据状态：除特别标注外，本页基于当前源码已确认。
