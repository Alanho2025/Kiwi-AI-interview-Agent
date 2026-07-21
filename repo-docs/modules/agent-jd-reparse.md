# JD reparse agent

JD reparse agent 只在 critic/gate 要求时运行。它的任务不是自由生成新 JD，而是根据 critic feedback 生成 section-level overrides，再让原 parser 在受控模式下重跑。

## 它在哪里被调用

实现位于 [JD parse reparse agent](../../backend/src/services/jobDescription/jdParseReparseAgent.js)，由 [guarded JD service](../../backend/src/services/jobDescription/guardedJobDescriptionService.js) 在 second pass 调用。

## 一个代表 case

```text
输入: rawJD + previousParsedJD + criticFeedback
动作: buildJdReparseOverridesWithDeepSeek -> buildStructuredJobDescriptionRubric(reparseMode)
输出: secondParsed rubric + second critic review
边界: max reparse attempts 控制为 bounded loop，不能无限自修复
```

## 它做什么决策

它决定哪些 sections 需要 override 或重新聚焦。最终 schema 和 validation 仍由 original rubric builder 与 validator 控制。

## 输出和持久化

输出会被装入 final rubric safeguard：`parseAttempts`、`repairApplied`、`firstReview`、`sectionOverrides`、`finalStatus`、`blockMatch`。

## 怎么检查

看 `backend/tests/robustness/jd` 中 safeguard、budget、SEEK regression 相关测试。继续读 [CV/JD 准备机制](feature-cv-jd-preparation.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

