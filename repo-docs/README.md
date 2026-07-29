# Kiwi AI Interview Agent 项目理解指南

Kiwi AI Interview Agent 是一个把 CV、目标 JD、访谈答案和报告检查串在一起的面试练习系统。读这个指南时，先把它理解成一条受控流水线：用户先确认输入证据，系统再生成匹配和问题材料，访谈控制器选择下一问，最后报告层只用可追踪的答案和证据给反馈。

本指南不从目录树开始。第一条阅读路径会跟随一个低依赖真实流程：CV/JD 准备 -> CV-JD match -> text interview -> report QA。难点是系统不能把 LLM 输出直接当真；每一步都要保留输入门槛、用户确认、fallback、证据索引、问题去重、报告 QA 和可验证测试。

## 阅读路径

| 讀者目標 | 從這裡開始 | 讀完後獲得什麼 |
| --- | --- | --- |
| 理解系統 5 層 Agent 架構與 68 Feature 對照 | [高階 Agent 架構與 RFC 全景導航](../docs/architecture-decision-records/HIGH_LEVEL_AGENT_ARCHITECTURE_MAPPING.md) | 知道 5 層 Agent 架構、Interview Agent、Report Agent 與 Harness 觀測層如何對應 68 個 RFC |
| 查閱全專案 68 個獨立 Feature RFC 目錄 | [68 Feature RFC 獨立全景索引](../docs/architecture-decision-records/features/README.md) | 一 Feature 一獨立檔，完整 7 章節包含白話比喻、Git 追蹤、真實代碼與面試對攻劇本 |
| 快速理解一个真实运行 | [跟随一次从准备到报告的主流程](walkthroughs/one-real-run.md) | 知道用户输入如何变成访谈问题和报告状态 |
| 按 feature 理解代码 | [看多条产品流程之间的关系](flows.md) | 知道 CV/JD、match、interview、voice、report、recording、RAG 各自在哪里接力 |
| 了解用戶層 JD 解析與 CV-JD 匹配行為 | [用戶層 JD 解析與 CV-JD 匹配指南](modules/user-facing-cv-jd-behavior.md) | 知道用戶能看到、編輯和對比的 JD/Match 具體欄位與介面資訊 |
| 從非技術利害關係人視角理解專案關注重點 | [非技術利害關係人視角指南](modules/non-tech-stakeholder-view.md) | 了解 HR、法務合規與產品決策者在意的安全、合規、體驗及 Playwright 測試價值 |
| 理解所有 agent | [从 agent registry 和 task runner 开始](modules/agent-registry-and-task-runner.md) | 知道正式 agent、功能内 critic、voice agent 与 memory/trace 怎么分工 |
| 理解现在的 RAG | [看当前检索层如何建索引和取证据](modules/rag-retrieval.md) | 知道 `weighted_hash_ngram_v2`、`document_chunks`、fusion score 和 corrective retry 的边界 |
| 理解已有验证和测试 | [看验证与保护层](modules/validations-and-guards.md) 和 [测试/eval 版图](modules/testing-and-evaluation.md) | 知道哪些行为被守住、哪些测试为什么存在、哪些 real provider 路径需要批准 |
| 檢查 EC2 第一版部署邊界 | [看 EC2 deployment runtime](modules/deployment-runtime.md) | 知道 Vercel、Caddy、container、uploads、workers 與 shutdown 如何接力，以及哪些仍待 live 驗證 |
| 從 AWS Console 複製一個 single-EC2 staging | [看 AWS Console 部署手冊](../deploy/ec2/AWS_CONSOLE_SETUP.md) | 依序建立 VPC、Security Group、SSM role、EC2、EIP、DNS、GitHub OIDC 與 repository variables，並知道哪些值必須換成新專案的值 |
| 审计文件是否有源码证据 | [查 evidence ledger](references/source-evidence.md) | 能把主要说法追到源码、测试、配置或产品契约 |

覆盖范围：本次文档覆盖当前产品主链路、voice contract、RAG、正式 agent、关键功能内 critic、验证、测试、持久化、保留與 EC2 local deployment candidate。它不逐档导览 uploads、backup folders、historical generated eval results，也不把部署設定或舊计划文件里的 proposal 当作 live production 證據。

证据状态：除特别标注外，本页基于当前源码已确认。
