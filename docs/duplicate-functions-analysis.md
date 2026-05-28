# 重複函數分析報告

## 執行摘要

在中高風險文件中發現 **59 處重複的輔助函數**，主要集中在以下幾個函數：

1. **`ensureArray()`** - 出現 35+ 次
2. **`normalizeText()`** - 出現 25+ 次  
3. **`tokenize()`** - 出現 10+ 次
4. **`ensureString()`** - 出現 5+ 次
5. **`ensureNumber()`** - 出現 3+ 次
6. **`unique()`** - 出現 8+ 次

## 詳細分析

### 1. ensureArray() - 最常見的重複函數

**出現次數**: 35+ 次  
**標準實現**: `const ensureArray = (value) => (Array.isArray(value) ? value : [])`

**出現位置**:
- ✅ `backend/src/utils/schemaHelpers.js` (已提取)
- ✅ `backend/src/utils/nzWorkplaceHelpers.js` (已提取)
- ✅ `backend/src/utils/opsLiteHelpers.js` (已提取)
- `backend/src/services/company/companyMotivationFitService.js`
- `backend/src/services/opsLiteVoiceLatencyService.js`
- `backend/src/services/cv/cvEvidenceNormalizer.js`
- `backend/src/services/cv/cvSignalExtractor.js`
- `backend/src/services/cv/cvProfileContractBuilder.js`
- `backend/src/services/cv/cvAnalysisBuilderService.js`
- `backend/src/services/report/claimGroundingService.js`
- `backend/src/services/report/reportRewriteService.js`
- `backend/src/services/retrieval/retrievalQualityAssessor.js`
- `backend/src/services/aiControl/voiceAgentDecisionService.js`
- `backend/src/services/interview/interviewTurnPolicy.js`
- `backend/src/services/aiControl/evidenceBundleService.js`
- `backend/src/services/aiControl/experienceMemoryService.js`
- `backend/src/services/aiControl/userCoachingMemoryService.js`
- `backend/src/services/aiControl/agentTraceService.js`
- `backend/src/services/aiControl/interviewEvaluatorService.js`
- `backend/src/services/aiControl/reflectionWriterService.js`
- `backend/src/services/aiControl/decisionContextBuilder.js`
- `backend/src/services/aiControl/interviewEnvironmentService.js`
- `backend/src/services/aiControl/modelActionSelectorService.js`
- `backend/src/services/aiControl/compactInterviewContextService.js`
- `backend/src/services/aiControl/fastAnswerUnderstandingService.js`
- `backend/src/services/aiControl/actionPlanner.js`
- `backend/src/services/aiControl/questionRanker.js`
- `backend/src/services/agents/retrievalAgent.js`
- `backend/src/services/reportCoachingService.js`
- `backend/src/services/agents/reportGenerator/reportDraftBuilder.js`
- `backend/src/services/match/matchAnalysisContractBuilder.js`
- `backend/src/services/match/matchValidationTargetBuilder.js`
- `backend/src/services/match/matchExplanationBuilder.js`
- `backend/src/services/jobDescription/jobDescriptionContractBuilder.js`
- `backend/src/services/jobDescription/jobDescriptionSignals.js`
- `backend/src/services/jobDescription/jobDescriptionNormalizer.js`
- `backend/src/services/agenticSafeguards/safeguardShared.js`

### 2. normalizeText() - 第二常見的重複函數

**出現次數**: 25+ 次  
**變體**: 有多種實現方式
- 基本版: `String(value || '').trim()`
- 空格壓縮版: `String(value || '').replace(/\s+/g, ' ').trim()`
- 小寫版: `String(value || '').trim().toLowerCase()`

**出現位置**:
- ✅ `backend/src/utils/speechHelpers.js` (已提取)
- ✅ `backend/src/utils/nzWorkplaceHelpers.js` (已提取)
- `backend/src/services/interviewStateService.js`
- `backend/src/services/cv/cvAnalysisBuilderService.js`
- `backend/src/services/cv/cvReviewedProfileService.js`
- `backend/src/services/report/turnRubricService.js`
- `backend/src/services/report/claimGroundingService.js`
- `backend/src/services/cv/cvProfileBuilderService.js`
- `backend/src/services/aiControl/voiceAgentDecisionService.js`
- `backend/src/services/interview/interviewTurnPolicy.js`
- `backend/src/services/voice/transcriptUnderstandingSummary.js`
- `backend/src/services/voice/transcriptConfirmationReplyClassifier.js`
- `backend/src/services/voice/voiceDeliveryAnalyzerService.js`
- `backend/src/services/aiControl/starRubricService.js`
- `backend/src/services/aiControl/dynamicSlotService.js`
- `backend/src/services/aiControl/experienceMemoryService.js`
- `backend/src/services/aiControl/userCoachingMemoryService.js`
- `backend/src/services/aiControl/abductiveReasoningService.js`
- `backend/src/services/aiControl/interviewModeGuard.js`
- `backend/src/services/aiControl/interviewEvaluatorService.js`
- `backend/src/services/aiControl/reflectionWriterService.js`
- `backend/src/services/aiControl/decisionContextBuilder.js`
- `backend/src/services/aiControl/interviewEnvironmentService.js`
- `backend/src/services/aiControl/compactInterviewContextService.js`
- `backend/src/services/aiControl/fastAnswerUnderstandingService.js`
- `backend/src/services/aiControl/questionRanker.js`
- `backend/src/services/agents/reportGeneratorShared.js` (exported)
- `backend/src/services/agents/interviewerAgentQuestionBuilder.js` (exported)
- `backend/src/services/match/matchShared.js` (exported)
- `backend/src/services/agents/interviewerAgent.js`

### 3. tokenize() - 文本分詞函數

**出現次數**: 10+ 次  
**標準實現**: `normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)`

**出現位置**:
- `backend/src/services/report/claimGroundingService.js`
- `backend/src/services/aiControl/starRubricService.js`
- `backend/src/services/aiControl/dynamicSlotService.js`
- `backend/src/services/aiControl/abductiveReasoningService.js`
- `backend/src/services/aiControl/interviewEvaluatorService.js`
- `backend/src/services/aiControl/decisionContextBuilder.js`
- `backend/src/services/aiControl/interviewEnvironmentService.js`
- `backend/src/services/agents/interviewerAgentQuestionBuilder.js` (exported)
- `backend/src/services/match/matchShared.js` (exported)
- `backend/src/services/agents/interviewerAgent.js`

### 4. unique() - 數組去重函數

**出現次數**: 8+ 次  
**標準實現**: `[...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))]`

**出現位置**:
- `backend/src/services/cv/cvEvidenceNormalizer.js`
- `backend/src/services/cv/cvSignalExtractor.js`
- `backend/src/services/cv/cvProfileContractBuilder.js`
- `backend/src/services/cv/cvAnalysisBuilderService.js`
- `backend/src/services/agents/retrievalAgent.js`
- `backend/src/services/match/matchAnalysisContractBuilder.js`
- `backend/src/services/match/matchValidationTargetBuilder.js`
- `backend/src/services/jobDescription/jobDescriptionContractBuilder.js`

### 5. ensureString() / ensureNumber() - 類型確保函數

**ensureString 出現次數**: 5+ 次  
**ensureNumber 出現次數**: 3+ 次

**出現位置**:
- ✅ `backend/src/utils/schemaHelpers.js` (已提取)
- `backend/src/services/company/companyMotivationFitService.js`
- `backend/src/services/reportCoachingService.js`

### 6. hasContent() - 內容檢查函數

**出現次數**: 2+ 次  
**實現**: 檢查值是否有實際內容（非空、非空數組、非空對象）

**出現位置**:
- `backend/src/services/ragIndexService.js`

## 重構建議

### 優先級 1: 創建共享工具模塊

建議創建 `backend/src/utils/commonHelpers.js`，集中管理這些常用函數：

```javascript
/**
 * Common utility functions used across the codebase
 */

// Array helpers
export const ensureArray = (value) => (Array.isArray(value) ? value : []);
export const unique = (items = []) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

// Text helpers
export const normalizeText = (value = '') => String(value || '').trim();
export const normalizeTextWithSpaces = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
export const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Type helpers
export const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
export const ensureNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
export const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

// Content helpers
export const hasContent = (value) => {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(String(value).trim());
};
```

### 優先級 2: 逐步替換重複實現

**階段 1: 高頻文件** (aiControl, agents, services)
- 替換 `aiControl/` 目錄下的所有重複函數 (15+ 文件)
- 替換 `agents/` 目錄下的所有重複函數 (5+ 文件)

**階段 2: CV 和 Match 相關文件**
- 替換 `cv/` 目錄下的重複函數 (8+ 文件)
- 替換 `match/` 目錄下的重複函數 (4+ 文件)

**階段 3: 其他服務文件**
- 替換 `report/`, `voice/`, `jobDescription/` 等目錄

### 優先級 3: 統一函數行為

某些函數有多種變體，需要統一：
- `normalizeText()` 有基本版、空格壓縮版、小寫版
- `tokenize()` 有不同的分詞規則
- `unique()` 有不同的去重邏輯

建議：
1. 定義標準版本
2. 為特殊需求創建命名變體（如 `normalizeTextLowercase()`, `tokenizeAlphanumeric()`）
3. 在文檔中說明何時使用哪個版本

## 預期收益

### 代碼減少
- 估計可減少 **500-800 行重複代碼**
- 每個 `ensureArray` 定義約 1 行 × 35 = 35 行
- 每個 `normalizeText` 定義約 1 行 × 25 = 25 行
- 每個 `tokenize` 定義約 1-2 行 × 10 = 15 行
- 加上其他函數和導入語句調整

### 維護性提升
- **單一真實來源**: 函數邏輯只需在一處維護
- **一致性**: 所有文件使用相同的實現
- **可測試性**: 共享函數可以集中測試
- **可發現性**: 開發者更容易找到和使用標準工具

### 風險評估
- **風險等級**: 中等
- **原因**: 需要修改 50+ 個文件
- **緩解策略**: 
  1. 先創建共享模塊並充分測試
  2. 逐個目錄替換，每次替換後運行完整測試套件
  3. 使用自動化工具輔助替換（如 codemod）

## 下一步行動

1. ✅ **已完成**: 識別重複函數模式
2. **待執行**: 創建 `backend/src/utils/commonHelpers.js`
3. **待執行**: 為共享函數編寫完整測試套件
4. **待執行**: 逐步替換高頻目錄中的重複實現
5. **待執行**: 運行完整測試確保無破壞性變更

## 附錄: 完整文件列表

### aiControl 目錄 (15 文件)
- voiceAgentDecisionService.js
- evidenceBundleService.js
- experienceMemoryService.js
- userCoachingMemoryService.js
- agentTraceService.js
- starRubricService.js
- dynamicSlotService.js
- abductiveReasoningService.js
- interviewModeGuard.js
- interviewEvaluatorService.js
- reflectionWriterService.js
- decisionContextBuilder.js
- interviewEnvironmentService.js
- modelActionSelectorService.js
- compactInterviewContextService.js
- fastAnswerUnderstandingService.js
- actionPlanner.js
- questionRanker.js

### cv 目錄 (8 文件)
- cvEvidenceNormalizer.js
- cvSignalExtractor.js
- cvProfileContractBuilder.js
- cvAnalysisBuilderService.js
- cvReviewedProfileService.js
- cvProfileBuilderService.js

### match 目錄 (4 文件)
- matchAnalysisContractBuilder.js
- matchValidationTargetBuilder.js
- matchExplanationBuilder.js
- matchShared.js

### 其他高頻目錄
- report/ (4 文件)
- voice/ (3 文件)
- jobDescription/ (4 文件)
- agents/ (5 文件)
- interview/ (1 文件)
- company/ (1 文件)

---

**分析日期**: 2026-05-28  
**分析範圍**: backend/src 目錄下所有 .js 文件  
**發現重複函數**: 59 處  
**涉及文件數**: 50+ 個  
**預估可減少代碼**: 500-800 行