# Feature RFC: F-72 Candidate Answer STT Calibration & Normalization Optimization

> **文件狀態**：Approved & Implemented  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/config/transcriptReplacements.js`, `backend/src/services/voice/speechPhraseHintService.js`, `backend/src/services/voice/transcriptCalibrationService.js`  
> **Git 演進 Commit 追蹤**：Commit `F-72`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-30  
> **嚴格邊界約束**：專注於回答側 (Candidate Answer Processing)，不修改出題側 (Questioning / Prompt Builder)  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像候選人在英語語音面試中快速說出技術專有名詞（如 "WebSocket" 或 "CI/CD"），但語音辨識器 (STT) 因為口音或語速將其聽錯成 "web sunkit" 或 "c oc id"。
> * **如果直接由 AI 評分**：AI 評分報告會誤以為候選人在胡言亂語，給予技術扣分（冤枉候選人）。
> * **如果用大模型自由重寫**：大模型可能會腦補作文，替候選人補全沒說過的技術細節（過度修改/造假）。
> * **本 Feature 的做法 (F-72)**：建立「聽覺偏置前置引導 (Phrase Hints) + 零延遲 N-Best 音近重排 + 邊界保護正則替換」。只修聽錯的單字，不改句型與語法，並保留 Raw/Calibrated 雙軌數據。

### 1.2 實測逐字稿痛點分析 (Live Transcript Evidence)
在實測對答 Transcript 中，發現 STT 對候選人關鍵回答產生重度音近誤判：
- `WebSocket` ➔ `web sunkit` / `web circuit` / `website kit`
- `TypeScript` ➔ `types javascript`
- `LangChain` ➔ `lan chen`
- `CI/CD` ➔ `c oc id`
- `npm run build` ➔ `mpn run build`
- `Secrets Manager` ➔ `sql manager`
- `EC2` ➔ `easy to add for`
- `merge to main` ➔ `merge to the man`

---

## 2. 架構與系統設計 (Architecture & Design)

```text
[候選人語音 Candidate Audio]
       │
       ▼
[1. Phrase List 前置注入 (speechPhraseHintService.js)]
   - 擴充 TECH_TOKEN_PATTERN 抽取斜線/連字符/字母數字縮寫 (CI/CD, EC2, RDS, WebSocket, TypeScript)
   - 動態注入 Azure STT Phrase List 預加載偏置 (Cap <= 120)
       │
       ▼
[2. N-Best 音近確定性重排 (transcriptCalibrationService.js)]
   - textContainsTerm 支援空間撕裂字母 (如 c oc id -> ci/cd) 匹配 Glossary
   - 0ms 延遲，純 Code 比對，不上 LLM
       │
       ▼
[3. 邊界保護靜態正則 (transcriptReplacements.js)]
   - 綁定完整片語與詞界 (\b)，進行安全靜態正則替換
       │
       ▼
[雙軌 Transcript 獨立存檔]
   ├── rawTranscript (100% 原始真跡，用於評估表達/流暢度)
   └── calibratedTranscript (技術校正，用於評估硬核技術實力)
```

---

## 3. 驗證與測試 (Verification)

- Vitest 測試套件：`tests/unit/transcriptNormalizer.test.js` & `tests/robustness/voice/voiceTranscriptCalibrationService.test.js` 24/24 PASS。
- Backend Lint：`npm run lint` 0 errors PASS。
