# Kiwi AI Interview Agent 项目理解指南

Kiwi AI Interview Agent 是一个把 CV、目标 JD、访谈答案和报告检查串在一起的面试练习系统。读这个指南时，先把它理解成一条受控流水线：用户先确认输入证据，系统再生成匹配和问题材料，访谈控制器选择下一问，最后报告层只用可追踪的答案和证据给反馈。

本指南不从目录树开始。第一条阅读路径会跟随一个低依赖真实流程：CV/JD 准备 -> CV-JD match -> text interview -> report QA。难点是系统不能把 LLM 输出直接当真；每一步都要保留输入门槛、用户确认、fallback、证据索引、问题去重、报告 QA 和可验证测试。

## 阅读路径

| 读者目标 | 从这里开始 | 读完后获得什么 |
| --- | --- | --- |
| 快速理解一个真实运行 | [跟随一次从准备到报告的主流程](walkthroughs/one-real-run.md) | 知道用户输入如何变成访谈问题和报告状态 |
| 按 feature 理解代码 | [看多条产品流程之间的关系](flows.md) | 知道 CV/JD、match、interview、voice、report、recording、RAG 各自在哪里接力 |
| 理解所有 agent | [从 agent registry 和 task runner 开始](modules/agent-registry-and-task-runner.md) | 知道正式 agent、功能内 critic、voice agent 与 memory/trace 怎么分工 |
| 理解现在的 RAG | [看当前检索层如何建索引和取证据](modules/rag-retrieval.md) | 知道 `weighted_hash_ngram_v2`、`document_chunks`、fusion score 和 corrective retry 的边界 |
| 理解已有验证和测试 | [看验证与保护层](modules/validations-and-guards.md) 和 [测试/eval 版图](modules/testing-and-evaluation.md) | 知道哪些行为被守住、哪些测试为什么存在、哪些 real provider 路径需要批准 |
| 审计文件是否有源码证据 | [查 evidence ledger](references/source-evidence.md) | 能把主要说法追到源码、测试、配置或产品契约 |

覆盖范围：本次文档覆盖当前产品主链路、voice contract、RAG、正式 agent、关键功能内 critic、验证、测试、持久化与保留。它不逐档导览 uploads、backup folders、historical generated eval results，也不把旧计划文件里的 proposal 当作已实现功能。

证据状态：除特别标注外，本页基于当前源码已确认。

