# 語音面試回答側轉寫校準與精準度優化計畫 (Candidate Answer STT Plan)

本文件定義了 Kiwi AI Interview Agent 在 **候選人回答側 (Candidate Answer Side)** 的語音轉文字（STT / ASR）校準與正則優化計畫。

> **嚴格邊界約束**：本計畫與相應實作僅限於 **回答側 (Candidate Answer Processing)**，包含 Phrase Hint 抽取、ASR 靜態正則校正、N-Best 音近重排與音訊試驗。出題側 (Questioning / Prompt Builder) 已經完成修改，不納入本計畫變更範圍。

---

## 1. 系統現狀與回答側問題診斷 (Candidate Answer STT Issues)

根據實測對答 Transcript，候選人（Alan）在回答時提出的關鍵技術名詞與實操經驗，受到 Azure STT 辨識器嚴重的音近誤判：

| 候選人真實口述內容 | STT 實際輸出錯誤逐字稿 | 影響層面 |
| :--- | :--- | :--- |
| **WebSocket / WebSockets** | `web sunkit` / `web circuit` / `website kit` | 核心實作技術被誤判為不存在的詞彙 |
| **TypeScript** | `types javascript` | 被拆成兩個常用字，失真 |
| **LangChain** | `LAN Chen` | 專有名詞未命中詞庫，誤判成人名 |
| **CI/CD** | `C OC ID` | 字母縮寫被硬切碎成獨立單字 |
| **npm run build** | `MPN run build` | 命令行首字母誤聽 |
| **Secrets Manager** | `SQL Manager` | AWS 安全組件被誤聽成 SQL 組件 |
| **EC2** | `easy to add for` / `easy tool` | 縮寫聽成日常短語 |
| **merge to main** | `merge to the man` | Git 分支名聽錯 |

---

## 2. 三階防禦與回答側細化方案 (Candidate Answer Defense Architecture)

```text
[候選人語音輸入 Candidate Audio]
       │
       ▼
[1. 第一防線: Dynamic Phrase Hint 增強] ── 擴充 TECH_TOKEN_PATTERN，將 CI/CD, EC2, WebSocket, TypeScript 優先注入 Azure STT
       │
       ▼
[2. 第二防線: N-Best 音近確定性重排] ── 讀取 NBest 音節組合 (如 c oc id -> CI/CD)，零延遲匹配 Glossary
       │
       ▼
[3. 第三防線: Domain Safe Replacements 靜態正則] ── 擴充 SAFE_REPLACEMENTS 針對 verified 音近誤辨詞微調
       │
       ▼
[輸出 Raw & Calibrated Transcript] ── 技術看 Calibrated，流暢度看 Raw，雙軌獨立存檔
```

---

## 3. 具體修訂範圍 (Scoped Execution Plan)

### 3.1 靜態正則對齊 (`backend/src/config/transcriptReplacements.js`)
新增 verified 音近誤辨正則替換對，包含：
- `web sunkit` / `web circuit` / `website kit` ➔ `WebSocket`
- `types javascript` ➔ `TypeScript`
- `lan chen` ➔ `LangChain`
- `hardness engines` ➔ `harness engines`
- `non type people` ➔ `non-tech people`
- `mpn run build` ➔ `npm run build`
- `sql manager` ➔ `Secrets Manager`
- `c oc id` / `ci cd` ➔ `CI/CD`
- `easy to add for` ➔ `EC2`
- `merge to the man` ➔ `merge to main`

### 3.2 短語提示抽取優化 (`backend/src/services/voice/speechPhraseHintService.js`)
- 升級 `TECH_TOKEN_PATTERN` 正則，精準捕獲帶有連字符/斜線的縮寫（如 `CI/CD`）、字母數字混合詞（如 `EC2`, `RDS`, `S3`, `VAD`）及常用命令（如 `npm run`）。
- 確保在 120 個 Phrase Hint 限制內，將目前問題焦點相關的技能優先注入。

### 3.3 音近重排算法平滑 (`backend/src/services/voice/transcriptCalibrationService.js`)
- 優化 N-Best 的搜尋與比對邏輯，支援分拆字母（如 `c o c i d`）對齊縮寫 `CI/CD`。
- 保留完全確定性、零 LLM 呼叫、零 Latency 增加的極致效能。

### 3.4 測試覆蓋 (`backend/tests/`)
- 在 `transcriptNormalizer.test.js` 與 `voiceTranscriptCalibrationService.test.js` 中補充針對上述回答側關鍵字替換與 N-Best 比對的單元/健壯性測試。

---

## 4. 防護邊界 (Guardrails)

1. **嚴禁修改出題側 (No Questioning Code Edits)**：`interviewerAgent.js`, `questionPoolComposerService.js`, `questionScopeControllerService.js` 等出題邏輯一律不動。
2. **嚴禁 LLM 轉寫重寫 (No LLM Transcript Rewrite)**：回答側校準保持純 Code/正則與 N-Best 比對，不呼叫 LLM 進行作文重寫。
3. **數據誠信 (Transcript Integrity)**：永遠同時保留 `rawText` 與 `normalizedText/calibratedText`。
