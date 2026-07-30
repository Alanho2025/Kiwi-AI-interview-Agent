# Kiwi AI Interview Agent - 71 Feature RFC 獨立文件全景索引

> 本目錄包含 Kiwi AI Interview Agent 全專案 **71 個 Feature** 的獨立 Feature RFC 文件（一 Feature 一獨立檔），全部遵循標準 RFC 7 大章節規範。
> 
> 💡 **高階導覽指南**：若要了解系統 **5 層 Agent 架構** 如何與這 71 個 Feature RFC 進行高階 Mapping 對照，請參閱：[HIGH_LEVEL_AGENT_ARCHITECTURE_MAPPING.md](../HIGH_LEVEL_AGENT_ARCHITECTURE_MAPPING.md)

---

## 📚 全專案 71 個獨立 Feature RFC 完整清單

### 🟢 領域一：門戶、行銷與用戶導覽 (Product & Onboarding)
* 📄 [F-01-landing-page-hero.md](./F-01-landing-page-hero.md) - F-01 品牌 Landing Page 與 Hero 展演
* 📄 [F-02-global-user-tour.md](./F-02-global-user-tour.md) - F-02 全局新手指引與互動式 Tour 導覽
* 📄 [F-03-pricing-tier-comparison.md](./F-03-pricing-tier-comparison.md) - F-03 商業定價方案與 Token 配額比較
* 📄 [F-04-contact-sales-form.md](./F-04-contact-sales-form.md) - F-04 企業銷售諮詢前端原型

### 🟢 領域二：用戶身份驗證、隱私條款與安全 (Auth, Privacy & Security)
* 📄 [F-05-google-oauth-login.md](./F-05-google-oauth-login.md) - F-05 Google OAuth 2.0 登入與帳號自動連動
* 📄 [F-06-privacy-act-consent-tracking.md](./F-06-privacy-act-consent-tracking.md) - F-06 紐西蘭 Privacy Act 2020 隱私條款同意追蹤
* 📄 [F-07-jwt-bearer-token-auth.md](./F-07-jwt-bearer-token-auth.md) - F-07 JWT Bearer Token 簽發與 Express 權限中間件
* 📄 [F-08-privacy-pii-redaction.md](./F-08-privacy-pii-redaction.md) - F-08 數據隱私 Redaction 與 PII 自動脫敏
* 📄 [F-09-user-data-retention-erasure.md](./F-09-user-data-retention-erasure.md) - F-09 用戶資料保留與過期時間計算

### 🟢 領域三：文檔解析與雙向匹配 (CV/JD & Matching Pipeline)
* 📄 [F-10-cv-upload-parsing-pipeline.md](./F-10-cv-upload-parsing-pipeline.md) - F-10 多格式 CV (PDF 與 DOCX) 上傳與解析
* 📄 [F-11-python-nlp-cv-entity-extraction.md](./F-11-python-nlp-cv-entity-extraction.md) - F-11 本地 Python NLP 輔助解析與結構化提取
* 📄 [F-12-jd-parse-critic-reparse-agent.md](./F-12-jd-parse-critic-reparse-agent.md) - F-12 目標 JD 需求挖礦與內容修復 Agent
* 📄 [F-13-file-repository-sha256-dedup.md](./F-13-file-repository-sha256-dedup.md) - F-13 檔案持久化 Repository 與去重防護
* 📄 [F-14-cv-jd-weighted-match-engine.md](./F-14-cv-jd-weighted-match-engine.md) - F-14 多維度 CV-JD 權重匹配引擎
* 📄 [F-15-skill-gap-and-risk-analysis.md](./F-15-skill-gap-and-risk-analysis.md) - F-15 技能缺口與風險分析

### 🟢 領域四：能力 Taxonomy 與題庫智能 (Question Intelligence)
* 📄 [F-16-nz-workplace-fit-taxonomy.md](./F-16-nz-workplace-fit-taxonomy.md) - F-16 紐西蘭職場適應性 Taxonomy 評分助手
* 📄 [F-17-question-pool-composer.md](./F-17-question-pool-composer.md) - F-17 候選題庫動態組成引擎
* 📄 [F-18-question-cosine-deduplication-ranker.md](./F-18-question-cosine-deduplication-ranker.md) - F-18 題目語意去重與 Cosine 動態排序
* 📄 [F-19-question-catalog-coverage-policy.md](./F-19-question-catalog-coverage-policy.md) - F-19 題庫 Catalog 策略審核與覆蓋率稽核

### 🟢 領域五：動態面試控制器與 AI 決策 (Interview Controller & AI Logic)
* 📄 [F-20-deterministic-interview-state-machine.md](./F-20-deterministic-interview-state-machine.md) - F-20 確定性面試輪次狀態機
* 📄 [F-21-abductive-action-planner.md](./F-21-abductive-action-planner.md) - F-21 溯因推理與動態 Action 規劃器
* 📄 [F-22-context-token-compaction-memory.md](./F-22-context-token-compaction-memory.md) - F-22 上下文 Token 壓縮與跨輪次記憶
* 📄 [F-23-fast-answer-understanding.md](./F-23-fast-answer-understanding.md) - F-23 快速意圖理解與低置信度轉錄確認
* 📄 [F-24-question-scope-clarification.md](./F-24-question-scope-clarification.md) - F-24 問題範疇澄清與非考題對話攔截
* 📄 [F-25-star-rubric-evidence-bundling.md](./F-25-star-rubric-evidence-bundling.md) - F-25 STAR 法則規準打分與原文 Evidence 打包
* 📄 [F-26-model-action-selection-audit-log.md](./F-26-model-action-selection-audit-log.md) - F-26 模型 Action 決策與 Auditing 日誌鏈
* 📄 [F-63-master-ai-controller-agent.md](./F-63-master-ai-controller-agent.md) - F-63 Master AI 控制器 Agent
* 📄 [F-73-interview-stress-level-mode.md](./F-73-interview-stress-level-mode.md) - F-73 面試壓力模式 (Supportive vs Standard vs High-Pressure)
* 📄 [F-74-context-aware-interviewer-dialogue-and-tradeoff-probing.md](./F-74-context-aware-interviewer-dialogue-and-tradeoff-probing.md) - F-74 語境自然化對白、紐西蘭團隊文化追問與情境式有機 Trade-off 追問

### 🟢 領域六：語音、多模態與全雙工 (Voice & Audio Processing)
* 📄 [F-27-text-interview-chat-workspace.md](./F-27-text-interview-chat-workspace.md) - F-27 純文字面試模式與 Workspace 互動介面
* 📄 [F-28-duplex-websocket-turn-coordinator.md](./F-28-duplex-websocket-turn-coordinator.md) - F-28 雙工 Turn 協調器與 WebSocket 狀態機
* 📄 [F-29-azure-speech-stt-tts-integration.md](./F-29-azure-speech-stt-tts-integration.md) - F-29 Azure Speech Service 整合與串流管道
* 📄 [F-30-browser-mic-vad-silence-detection.md](./F-30-browser-mic-vad-silence-detection.md) - F-30 瀏覽器端麥克風 VAD 與靜音檢測
* 📄 [F-31-voice-barge-in-interruption.md](./F-31-voice-barge-in-interruption.md) - F-31 語音打斷 (Barge-in) 零卡頓中斷與狀態洗淨
* 📄 [F-32-repair-prompt-system-notification.md](./F-32-repair-prompt-system-notification.md) - F-32 修復提示與系統通知隔離保護
* 📄 [F-33-voice-audio-buffer-latency.md](./F-33-voice-audio-buffer-latency.md) - F-33 語音首包音訊 Buffer 與 3s 延遲優化
* 📄 [F-61-realtime-voice-duplex-agent.md](./F-61-realtime-voice-duplex-agent.md) - F-61 全雙工語音 Agent
* 📄 [F-72-candidate-answer-stt-calibration.md](./F-72-candidate-answer-stt-calibration.md) - F-72 候選人回答側轉寫校準與精準度優化

### 🟢 領域七：報告、評估與復盤 (Reports & Coaching)
* 📄 [F-34-report-generation-pipeline.md](./F-34-report-generation-pipeline.md) - F-34 面試評估報告與輔導生成管線
* 📄 [F-35-overall-score-radar-breakdown.md](./F-35-overall-score-radar-breakdown.md) - F-35 總分算式與五維雷達圖 Breakdown
* 📄 [F-36-question-by-question-star-transcript-review.md](./F-36-question-by-question-star-transcript-review.md) - F-36 逐題 STAR 復盤與對話逐字稿核對
* 📄 [F-37-communication-authenticity-evidence-visualization.md](./F-37-communication-authenticity-evidence-visualization.md) - F-37 溝通真實性指標與 Evidence Visualizer
* 📄 [F-38-report-coaching-actionable-improvement.md](./F-38-report-coaching-actionable-improvement.md) - F-38 報告輔導與可落地改善建議
* 📄 [F-39-report-export-pdf-download.md](./F-39-report-export-pdf-download.md) - F-39 對話逐字稿匯出服務

### 🟢 領域八：RAG 與 AI 基建 (RAG & AI Infrastructure)
* 📄 [F-48-etl-cv-jd-feature-vectorization.md](./F-48-etl-cv-jd-feature-vectorization.md) - F-48 CV/JD 向量嵌入與 RAG 檢索管道
* 📄 [F-62-deepseek-llm-orchestrator.md](./F-62-deepseek-llm-orchestrator.md) - F-62 DeepSeek / LLM 編排服務
* 📄 [F-64-structured-prompt-engineering.md](./F-64-structured-prompt-engineering.md) - F-64 結構化 Prompt 工程
* 📄 [F-70-hybrid-rag-linear-score-fusion.md](./F-70-hybrid-rag-linear-score-fusion.md) - F-70 混合檢索與分數線性融合

### 🟢 領域九：持久化與資料庫 (Persistence & Storage)
* 📄 [F-45-postgres-prisma-type-safe-orm.md](./F-45-postgres-prisma-type-safe-orm.md) - F-45 PostgreSQL 與結構化數據 Store
* 📄 [F-46-mongodb-mongoose-unstructured-store.md](./F-46-mongodb-mongoose-unstructured-store.md) - F-46 MongoDB / Mongoose 非結構化 Store
* 📄 [F-47-multi-cloud-storage-s3-local-abstraction.md](./F-47-multi-cloud-storage-s3-local-abstraction.md) - F-47 本地檔案持久化與儲存服務
* 📄 [F-49-cross-db-transaction-coordinator.md](./F-49-cross-db-transaction-coordinator.md) - F-49 PostgreSQL 單庫交易與雙庫資料一致性
* 📄 [F-50-data-sanitization-pipeline.md](./F-50-data-sanitization-pipeline.md) - F-50 數據清洗管線
* 📄 [F-67-docker-volume-data-persistence-backup.md](./F-67-docker-volume-data-persistence-backup.md) - F-67 Docker Named Volume 資料持久化

### 🟢 領域十：測試、評測與治理 (Testing, Harness & Governance)
* 📄 [F-40-eval-framework-google-cli-harness.md](./F-40-eval-framework-google-cli-harness.md) - F-40 Eval 評測框架與 Google CLI Harness
* 📄 [F-41-vitest-frontend-unit-test-suite.md](./F-41-vitest-frontend-unit-test-suite.md) - F-41 Vitest 前端單元測試套件
* 📄 [F-42-jest-backend-robustness-suite.md](./F-42-jest-backend-robustness-suite.md) - F-42 Jest 後端健壯性測試套件
* 📄 [F-43-playwright-e2e-ui-check-framework.md](./F-43-playwright-e2e-ui-check-framework.md) - F-43 Playwright E2E 測試框架
* 📄 [F-44-role-fit-refine-release-gate-ci.md](./F-44-role-fit-refine-release-gate-ci.md) - F-44 Release Gate CI 管道
* 📄 [F-65-ai-governance-eval-runner.md](./F-65-ai-governance-eval-runner.md) - F-65 AI Governance 評測 Runner
* 📄 [F-71-ai-telemetry-token-usage-rollup.md](./F-71-ai-telemetry-token-usage-rollup.md) - F-71 異步遙測、Token 追蹤與定時數據聚合

### 🟢 領域十一：部署、安全與運維 (Deployment, Security & Operations)
* 📄 [F-51-rate-limiting-ip-redis-guard.md](./F-51-rate-limiting-ip-redis-guard.md) - F-51 In-Memory HTTP 限流過濾防衛
* 📄 [F-52-helmet-cors-security-headers.md](./F-52-helmet-cors-security-headers.md) - F-52 Helmet & CORS 安全 Header
* 📄 [F-53-websocket-authenticated-handshake.md](./F-53-websocket-authenticated-handshake.md) - F-53 WebSocket 身份驗證 Handshake
* 📄 [F-54-device-fingerprint-concurrency-check.md](./F-54-device-fingerprint-concurrency-check.md) - F-54 Session 查詢與權限隔離
* 📄 [F-55-data-encryption-at-rest-in-transit.md](./F-55-data-encryption-at-rest-in-transit.md) - F-55 敏感數據 Redaction 與傳輸安全邊界
* 📄 [F-56-ec2-docker-compose-staging-runtime.md](./F-56-ec2-docker-compose-staging-runtime.md) - F-56 EC2 Docker Compose Runtime
* 📄 [F-57-github-actions-cd-ec2-deploy.md](./F-57-github-actions-cd-ec2-deploy.md) - F-57 GitHub Actions OIDC 與 AWS SSM 自動部署
* 📄 [F-58-nginx-reverse-proxy-ssl.md](./F-58-nginx-reverse-proxy-ssl.md) - F-58 Caddy 反向代理與 Transport TLS 保護
* 📄 [F-59-dockerfile-multi-stage-build.md](./F-59-dockerfile-multi-stage-build.md) - F-59 Dockerfile 多階段建置
* 📄 [F-60-environment-variable-secret-guard.md](./F-60-environment-variable-secret-guard.md) - F-60 環境變數 Guard
* 📄 [F-66-reproducible-staging-environment-setup.md](./F-66-reproducible-staging-environment-setup.md) - F-66 Staging 環境建置
* 📄 [F-68-static-asset-hosting-service.md](./F-68-static-asset-hosting-service.md) - F-68 靜態資源託管
* 📄 [F-69-server-graceful-shutdown-lifecycle.md](./F-69-server-graceful-shutdown-lifecycle.md) - F-69 服務器優雅關閉與資源週期管理
