# Kiwi AI Interview Agent - 68 Feature RFC 獨立文件全景索引

> 本目錄包含 Kiwi AI Interview Agent 全專案 **68 個 Feature** 的獨立 Feature RFC 文件（一 Feature 一獨立檔），全部遵循標準 RFC 7 大章節規範。

---

## 📚 全專案 68 個獨立 Feature RFC 完整清單

### 🟢 領域一：門戶、行銷、定價與用戶導覽 (Landing, Portal, Onboarding & Pricing)
* 📄 [F-01-landing-page-hero.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-01-landing-page-hero.md) - F-01 品牌 Landing Page 與 Hero 展演
* 📄 [F-02-global-user-tour.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-02-global-user-tour.md) - F-02 全局新手指引與互動式 Tour 導覽
* 📄 [F-03-pricing-tier-comparison.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-03-pricing-tier-comparison.md) - F-03 商業定價方案與 Token 配額比較
* 📄 [F-04-contact-sales-form.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-04-contact-sales-form.md) - F-04 企業銷售諮詢與 Form 提交

### 🟢 領域二：用戶身份驗證、隱私條款與權限管理 (Auth, Security & Compliance)
* 📄 [F-05-google-oauth-login.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-05-google-oauth-login.md) - F-05 Google OAuth 2.0 登入與帳號自動連動
* 📄 [F-06-privacy-act-consent-tracking.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-06-privacy-act-consent-tracking.md) - F-06 紐西蘭 Privacy Act 2020 隱私條款同意追蹤
* 📄 [F-07-jwt-bearer-token-auth.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-07-jwt-bearer-token-auth.md) - F-07 JWT Bearer Token 簽發與 Express 權限中間件
* 📄 [F-08-privacy-pii-redaction.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-08-privacy-pii-redaction.md) - F-08 數據隱私 Redaction 與 PII 自動脫敏
* 📄 [F-09-user-data-retention-erasure.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-09-user-data-retention-erasure.md) - F-09 用戶資料保留與 GDPR/Privacy 刪除條例引擎

### 🟢 領域三：文檔解析、職缺分析與隱私管線 (CV & JD Processing Pipeline)
* 📄 [F-10-cv-upload-parsing-pipeline.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-10-cv-upload-parsing-pipeline.md) - F-10 多格式 CV (PDF/Word/Text) 上傳與解析
* 📄 [F-11-python-nlp-cv-entity-extraction.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-11-python-nlp-cv-entity-extraction.md) - F-11 本地 Python NLP 輔助解析與結構化提取
* 📄 [F-12-jd-parse-critic-reparse-agent.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-12-jd-parse-critic-reparse-agent.md) - F-12 目標 JD 需求挖礦與內容修復 Agent
* 📄 [F-13-file-repository-sha256-dedup.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-13-file-repository-sha256-dedup.md) - F-13 檔案持久化 Repository 與去重防護

### 🟢 領域四：雙向匹配、能力模型與題庫生成 (Match & Question Intelligence)
* 📄 [F-14-cv-jd-weighted-match-engine.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-14-cv-jd-weighted-match-engine.md) - F-14 多維度 CV-JD 權重匹配引擎
* 📄 [F-15-skill-gap-and-risk-analysis.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-15-skill-gap-and-risk-analysis.md) - F-15 技能缺口與風險分析 (Gap & Risk Analysis)
* 📄 [F-16-nz-workplace-fit-taxonomy.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-16-nz-workplace-fit-taxonomy.md) - F-16 紐西蘭職場適應性與能力 Taxonomy 引擎
* 📄 [F-17-question-pool-composer.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-17-question-pool-composer.md) - F-17 候選題庫組成與種子提詞生成
* 📄 [F-18-question-cosine-deduplication-ranker.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-18-question-cosine-deduplication-ranker.md) - F-18 題目語意去重與 Cosine 動態排序
* 📄 [F-19-question-catalog-coverage-policy.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-19-question-catalog-coverage-policy.md) - F-19 題庫 Catalog 策略審核與覆蓋率稽核

### 🟢 領域五：動態面試控制器與 AI 決策層 (Interview Controller & AI Control)
* 📄 [F-20-deterministic-interview-state-machine.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-20-deterministic-interview-state-machine.md) - F-20 確定性面試輪次狀態機 (Turn-taking Engine)
* 📄 [F-21-abductive-action-planner.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-21-abductive-action-planner.md) - F-21 溯因推理與動態 Action 規劃器
* 📄 [F-22-context-token-compaction-memory.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-22-context-token-compaction-memory.md) - F-22 上下文 Token 壓縮與跨輪次記憶
* 📄 [F-23-fast-answer-understanding.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-23-fast-answer-understanding.md) - F-23 快速意圖理解與低置信度轉錄確認
* 📄 [F-24-question-scope-clarification.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-24-question-scope-clarification.md) - F-24 問題範疇澄清與非考題對話攔截
* 📄 [F-25-star-rubric-evidence-bundling.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-25-star-rubric-evidence-bundling.md) - F-25 STAR 法則規準打分與原文 Evidence 打包

### 🟢 領域六：媒體硬體檢查、全雙工語音與訊號處理 (Hardware & Realtime Duplex Voice)
* 📄 [F-26-model-action-selection-audit-log.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-26-model-action-selection-audit-log.md) - F-26 模型 Action 決策與 Auditing 日誌鏈
* 📄 [F-27-text-interview-chat-workspace.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-27-text-interview-chat-workspace.md) - F-27 純文字面試模式與 Workspace 互動介面
* 📄 [F-28-duplex-websocket-turn-coordinator.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-28-duplex-websocket-turn-coordinator.md) - F-28 雙工 Turn 協調器與 WebSocket 狀態機
* 📄 [F-29-azure-speech-stt-tts-integration.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-29-azure-speech-stt-tts-integration.md) - F-29 Azure Speech Service (STT/TTS) 整合與串流管道
* 📄 [F-30-browser-mic-vad-silence-detection.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-30-browser-mic-vad-silence-detection.md) - F-30 瀏覽器端麥克風 VAD 與靜音檢測
* 📄 [F-31-voice-barge-in-interruption.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-31-voice-barge-in-interruption.md) - F-31 語音打斷 (Barge-in) 零卡頓中斷與狀態洗淨
* 📄 [F-32-repair-prompt-system-notification.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-32-repair-prompt-system-notification.md) - F-32 修復提示與系統通知隔離保護
* 📄 [F-33-voice-audio-buffer-latency.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-33-voice-audio-buffer-latency.md) - F-33 語音首包音訊 Buffer 與 3s 延遲優化
* 📄 [F-34-report-generation-pipeline.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-34-report-generation-pipeline.md) - F-34 面試評估報告非同步生成管線
* 📄 [F-35-overall-score-radar-breakdown.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-35-overall-score-radar-breakdown.md) - F-35 總分算式與五維雷達圖 Breakdown

### 🟢 領域七：RAG 混合檢索與證據鏈引擎 (RAG & Knowledge Retrieval)
* 📄 [F-36-question-by-question-star-transcript-review.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-36-question-by-question-star-transcript-review.md) - F-36 逐題 STAR 復盤與對話逐字稿核對
* 📄 [F-37-communication-authenticity-evidence-visualization.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-37-communication-authenticity-evidence-visualization.md) - F-37 溝通真實性指標與 Evidence Snippet 視覺化

### 🟢 領域八：面試報告、逐字稿匯出與 Agent QA 稽核 (Report, Export & QA)
* 📄 [F-38-report-coaching-actionable-improvement.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-38-report-coaching-actionable-improvement.md) - F-38 可落地 Actionable coaching 指導與學習清單
* 📄 [F-39-report-export-pdf-download.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-39-report-export-pdf-download.md) - F-39 報告匯出 PDF 下載與排版轉譯
* 📄 [F-40-eval-framework-google-cli-harness.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-40-eval-framework-google-cli-harness.md) - F-40 AI 評測 Eval 框架與 CLI Harness
* 📄 [F-41-vitest-frontend-unit-test-suite.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-41-vitest-frontend-unit-test-suite.md) - F-41 Vitest 前端單元測試與 Quality Gate

### 🟢 領域九：雙資料庫 Data Pipeline 與領域模型 (Dual-DB Data Pipeline & Persistence)
* 📄 [F-42-jest-backend-robustness-suite.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-42-jest-backend-robustness-suite.md) - F-42 后端 API 健壯性測試與 Mock 控制器
* 📄 [F-43-playwright-e2e-ui-check-framework.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-43-playwright-e2e-ui-check-framework.md) - F-43 Playwright 端到端 (E2E) UI 自檢與 `data-qa` 審計框架
* 📄 [F-44-role-fit-refine-release-gate-ci.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-44-role-fit-refine-release-gate-ci.md) - F-44 Role-fit Refine 發佈品質門禁 (Release Gate)

### 🟢 領域十：運維監控、安全防禦、測試、Eval 與 CI/CD 雲端部署 (Ops, Security, Testing & DevOps)
* 📄 [F-45-postgres-prisma-type-safe-orm.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-45-postgres-prisma-type-safe-orm.md) - F-45 PostgreSQL 資料庫與幾何 Type-Safe 存取
* 📄 [F-46-mongodb-mongoose-unstructured-store.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-46-mongodb-mongoose-unstructured-store.md) - F-46 MongoDB / Mongoose 非結構化文檔存取
* 📄 [F-47-multi-cloud-storage-s3-local-abstraction.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-47-multi-cloud-storage-s3-local-abstraction.md) - F-47 跨雲 / 本地多媒介 Storage 抽象適配器
* 📄 [F-48-etl-cv-jd-feature-vectorization.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-48-etl-cv-jd-feature-vectorization.md) - F-48 CV / JD 特徵向量化與 ETL 數據管線
* 📄 [F-49-cross-db-transaction-coordinator.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-49-cross-db-transaction-coordinator.md) - F-49 雙資料庫 (Postgres + Mongo) 跨庫交易協調器
* 📄 [F-50-data-sanitization-pipeline.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-50-data-sanitization-pipeline.md) - F-50 數據 Sanitization 管線與防 XSS 入口
* 📄 [F-51-rate-limiting-ip-redis-guard.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-51-rate-limiting-ip-redis-guard.md) - F-51 速率限制 Rate-limiting與 API 限流防護
* 📄 [F-52-helmet-cors-security-headers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-52-helmet-cors-security-headers.md) - F-52 Helmet 安全標頭與 CORS 跨域白名單
* 📄 [F-53-websocket-authenticated-handshake.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-53-websocket-authenticated-handshake.md) - F-53 WebSocket 帶權驗證握手與通道保護
* 📄 [F-54-device-fingerprint-concurrency-check.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-54-device-fingerprint-concurrency-check.md) - F-54 設備 Fingerprint 指紋與併發 Sessions 檢查
* 📄 [F-55-data-encryption-at-rest-in-transit.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-55-data-encryption-at-rest-in-transit.md) - F-55 數據傳輸 TLS 加密與靜態雙重保護
* 📄 [F-56-ec2-docker-compose-staging-runtime.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-56-ec2-docker-compose-staging-runtime.md) - F-56 AWS EC2 與 Docker Compose 單機 Staging 運行環境
* 📄 [F-57-github-actions-cd-ec2-deploy.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-57-github-actions-cd-ec2-deploy.md) - F-57 GitHub Actions 自動化 CD 與 EC2 遠端部署
* 📄 [F-58-nginx-reverse-proxy-ssl.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-58-nginx-reverse-proxy-ssl.md) - F-58 Nginx 反向代理與 SSL / TLS 憑證自動卸載
* 📄 [F-59-dockerfile-multi-stage-build.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-59-dockerfile-multi-stage-build.md) - F-59 Dockerfile 多階段構建 (Multi-Stage Build)
* 📄 [F-60-environment-variable-secret-guard.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-60-environment-variable-secret-guard.md) - F-60 環境變數 `.env.example` 範本與 Secret 衛語檢查
* 📄 [F-61-realtime-voice-duplex-agent.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-61-realtime-voice-duplex-agent.md) - F-61 雙工語音 Agent 串流發聲與多模態整合
* 📄 [F-62-deepseek-llm-orchestrator.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-62-deepseek-llm-orchestrator.md) - F-62 DeepSeek API 整合與低成本 LLM 算力編排
* 📄 [F-63-master-ai-controller-agent.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-63-master-ai-controller-agent.md) - F-63 Master AI 控制器與子 Agent 派發調度
* 📄 [F-64-structured-prompt-engineering.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-64-structured-prompt-engineering.md) - F-64 結構化 Prompt 工程與 System Persona 注入
* 📄 [F-65-ai-governance-eval-runner.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-65-ai-governance-eval-runner.md) - F-65 AI 治理與 Eval 自動化測試 Runner
* 📄 [F-66-reproducible-staging-environment-setup.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-66-reproducible-staging-environment-setup.md) - F-66 可重複 Staging 環境搭建指南與啟動驗證
* 📄 [F-67-docker-volume-data-persistence-backup.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-67-docker-volume-data-persistence-backup.md) - F-67 Docker Volume 資料持久化與冷備份策略
* 📄 [F-68-static-asset-hosting-service.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/architecture-decision-records/features/F-68-static-asset-hosting-service.md) - F-68 靜態資源（前端 Build 產物）託管服務
