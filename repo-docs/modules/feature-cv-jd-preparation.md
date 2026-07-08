# CV/JD 准备机制

CV/JD 准备层的职责是把松散输入变成可确认的候选人证据和岗位证据。这里的重点不是“AI 已经解析”，而是用户能看到、修正并确认下游 match 会使用的字段。

## 读者应该先记住什么

CV 侧接收上传或 recent CV selection，抽取文本，构建 profile，并生成 CV question seeds。JD 侧接收 pasted JD，先走 structured rubric builder，再用 critic/gate/reparse safeguard 给结果打上可用性和 review 信息。二者都服务于同一个目的：不要让 match 基于未确认或明显错位的输入继续运行。

## 一个代表 case

```text
输入: 用户上传 CV，并粘贴一段 JD
动作: CV service 提取 profile；JD service 生成 rubric 和 safeguard metadata
输出: frontend 展示 reviewable CV fields 与 structured JD rubric
边界: raw JD 改变后，旧 structured summary/review 状态不能继续代表当前 JD
```

## 代码怎么追

| 读者问题 | 源码入口 | 说明 |
| --- | --- | --- |
| CV 从哪里进入 | [upload controller](../../backend/src/controllers/uploadController.js) | 接收文件、保存 file record、委托 CV services |
| JD 从哪里进入 | [JD controller](../../backend/src/controllers/jobDescriptionController.js) | 处理 paraphrase/structured JD 请求 |
| JD safeguard 怎么跑 | [guarded JD service](../../backend/src/services/jobDescription/guardedJobDescriptionService.js) | first parse、critic review、gate、可选 reparse |
| review 后 CV seed 怎么更新 | [CV seed service](../../backend/src/services/questions/cvQuestionSeedService.js) | 生成后续问题准备材料 |
| 前端 review state 在哪里 | [Analyze page](../../frontend/src/pages/AnalyzePage.jsx) 和 [CV review view model](../../frontend/src/utils/cvReviewViewModel.js) | 页面组合 review UI 与状态 |

## 容易误读的边界

JD file upload 不是当前主产品路径；当前实现围绕 pasted JD。Company values enrichment 是 supportive path，不是开始访谈的硬前提。CV question seeds 也不是最终问题，只是问题准备材料。

继续读 [match 与问题准备](feature-match-and-question-prep.md)，看 reviewed evidence 如何进入 match record 和 question pool。

证据状态：除特别标注外，本页基于当前源码已确认。

