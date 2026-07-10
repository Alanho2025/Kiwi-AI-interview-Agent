# CV/JD 准备机制

CV/JD 准备层的职责是把松散输入变成可确认的候选人证据和岗位证据。这里的重点不是“AI 已经解析”，而是用户能看到、修正并确认下游 match 会使用的字段。

## 读者应该先记住什么

CV 侧接收上传或 recent CV selection，抽取文本并构建 private `cv_evidence_profile_v2`。每个 evidence node 使用内容稳定 ID，保留 source section、chunk、raw snippet、normalized summary 和 ownership/outcome/specificity signals。JD 侧除了 pasted JD，还要求 company website 或人工 company context 至少一项；parser 在现有 rubric 内生成带来源、置信度和不确定性的 company understanding 与 role intent。二者都服务于同一个目的：不要让 match 基于未确认、不可追溯或明显错位的输入继续运行。

## 一个代表 case

```text
输入: 用户上传 CV，粘贴 JD，并提供 company website 或人工 company context
动作: CV service 建立 source-linked evidence；JD service 生成 rubric、company understanding、role intent 与 safeguard metadata
输出: frontend 展示可编辑的 CV fields、company understanding、role intents 与 structured JD rubric
边界: raw JD 或 company context 改变后，旧 summary/review 状态失效；stale review version 返回 409
```

## 代码怎么追

| 读者问题 | 源码入口 | 说明 |
| --- | --- | --- |
| CV 从哪里进入 | [upload controller](../../backend/src/controllers/uploadController.js) | 接收文件、保存 file record、委托 CV services |
| JD 从哪里进入 | [JD controller](../../backend/src/controllers/jobDescriptionController.js) | 处理 paraphrase/structured JD 请求 |
| JD safeguard 怎么跑 | [guarded JD service](../../backend/src/services/jobDescription/guardedJobDescriptionService.js) | first parse、critic review、gate、可选 reparse |
| company/role 理解怎么生成 | [role-fit profile builder](../../backend/src/services/jobDescription/roleFitProfileBuilder.js) | 清理不可信输入，生成 source-labelled company facts 与 role intents |
| review 怎么保存 | [company values repository](../../backend/src/services/company/companyValuesRepository.js) | 以 owner + `jdFingerprint` 保存 draft，并用 optimistic version 原子确认 |
| review 后 CV seed 怎么更新 | [CV seed service](../../backend/src/services/questions/cvQuestionSeedService.js) | 生成后续问题准备材料 |
| 前端 review state 在哪里 | [Analyze page](../../frontend/src/pages/AnalyzePage.jsx) 和 [CV review view model](../../frontend/src/utils/cvReviewViewModel.js) | 页面组合 review UI 与状态 |

## 容易误读的边界

JD file upload 不是当前主产品路径；当前实现围绕 pasted JD。显式 company context 已是 JD summarise/match 的硬前提，但 background company values enrichment 仍是 supportive path，不是 match 的同步依赖。CV question seeds 也不是最终问题，只是问题准备材料。

继续读 [match 与问题准备](feature-match-and-question-prep.md)，看 reviewed evidence 如何进入 match record 和 question pool。

证据状态：除特别标注外，本页基于当前源码已确认。
