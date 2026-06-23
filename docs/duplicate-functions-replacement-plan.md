# 重複函數替換執行計劃

> 狀態：歷史重構計劃，不是目前執行清單。共享 helper 與後續檔案結構已變更，且 `reportGeneratorShared.js` 已不存在；任何新一輪替換前必須重新以 `rg` 盤點。

## 狀態：準備執行

共享模塊已創建並測試通過：
- ✅ `backend/src/utils/commonHelpers.js` (125 lines, 15 functions)
- ✅ `backend/tests/unit/commonHelpers.test.js` (207 lines, 35 tests)
- ✅ 所有測試通過

## 替換策略

### 階段 1: aiControl 目錄 (18 文件) - 最高優先級

**原因**: 最多重複，集中在一個目錄

**文件列表**:
1. voiceAgentDecisionService.js - ensureArray, normalizeText
2. evidenceBundleService.js - ensureArray
3. experienceMemoryService.js - ensureArray, normalizeText
4. userCoachingMemoryService.js - ensureArray, normalizeText
5. agentTraceService.js - ensureArray
6. starRubricService.js - normalizeText, tokenize
7. dynamicSlotService.js - normalizeText, tokenize
8. abductiveReasoningService.js - normalizeText, tokenize
9. interviewModeGuard.js - normalizeText, normalizeKey
10. interviewEvaluatorService.js - ensureArray, normalizeText, tokenize
11. reflectionWriterService.js - ensureArray, normalizeText
12. decisionContextBuilder.js - ensureArray, normalizeText, tokenize
13. interviewEnvironmentService.js - ensureArray, normalizeText, tokenize
14. modelActionSelectorService.js - ensureArray, normalizeText
15. compactInterviewContextService.js - ensureArray, normalizeText, truncateText
16. fastAnswerUnderstandingService.js - ensureArray, normalizeText, normalizeKey
17. actionPlanner.js - ensureArray, clampPriority
18. questionRanker.js - normalizeText, normalizeKey, ensureArray

**替換模式**:
```javascript
// 移除本地定義
- const ensureArray = (value) => (Array.isArray(value) ? value : []);
- const normalizeText = (value = '') => String(value || '').trim();
- const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// 添加導入
+ import { ensureArray, normalizeText, tokenize } from '../../utils/commonHelpers.js';
```

### 階段 2: cv 目錄 (8 文件)

**文件列表**:
1. cvEvidenceNormalizer.js - ensureArray, unique
2. cvSignalExtractor.js - ensureArray, unique
3. cvProfileContractBuilder.js - ensureArray, unique
4. cvAnalysisBuilderService.js - ensureArray, normalizeText, unique
5. cvReviewedProfileService.js - normalizeText
6. cvProfileBuilderService.js - normalizeText, normalizeLineBreaks

**注意**: `normalizeLineBreaks` 是特殊函數，保留在本地

### 階段 3: match 目錄 (4 文件)

**文件列表**:
1. matchAnalysisContractBuilder.js - ensureArray, unique
2. matchValidationTargetBuilder.js - ensureArray, unique
3. matchExplanationBuilder.js - ensureArray
4. matchShared.js - normalizeText, tokenize (exported functions)

**注意**: matchShared.js 導出這些函數供其他文件使用，需要改為 re-export

### 階段 4: report 目錄 (4 文件)

**文件列表**:
1. claimGroundingService.js - ensureArray, normalizeText, tokenize
2. turnRubricService.js - normalizeText, lower
3. reportRewriteService.js - ensureArray, normalizePrompt
4. reportCoachingService.js - ensureString, ensureArray, TRUST_LABELS

**注意**: `lower` 和 `normalizePrompt` 是特殊函數，保留在本地

### 階段 5: 其他目錄 (16 文件)

**agents/** (5 files):
- retrievalAgent.js - ensureArray, unique
- reportGeneratorShared.js - normalizeText, toWords (exported)
- interviewerAgentQuestionBuilder.js - normalizeText, tokenize (exported)
- interviewerAgent.js - normalizeText, tokenize
- reportDraftBuilder.js - ensureArray

**jobDescription/** (4 files):
- jobDescriptionContractBuilder.js - ensureArray, unique
- jobDescriptionSignals.js - ensureArray
- jobDescriptionNormalizer.js - ensureArray
- jobDescriptionSchemaValidator.js - ensureArray, ensureObject

**voice/** (3 files):
- transcriptUnderstandingSummary.js - normalizeText
- transcriptConfirmationReplyClassifier.js - normalizeText
- voiceDeliveryAnalyzerService.js - normalizeText, words

**interview/** (1 file):
- interviewTurnPolicy.js - ensureArray, normalizeText, buildRootQuestionKey

**company/** (1 file):
- companyMotivationFitService.js - ensureArray, ensureString, ensureNumber

**其他** (2 files):
- interviewStateService.js - normalizeText, normalizeKey
- opsLiteVoiceLatencyService.js - ensureArray, toNumber
- ragIndexService.js - hasContent
- retrieval/retrievalQualityAssessor.js - ensureArray
- agenticSafeguards/safeguardShared.js - ensureArray (exported)

## 執行步驟

### 步驟 1: 批量替換 aiControl 目錄

```bash
# 對每個文件執行：
# 1. 移除本地函數定義
# 2. 添加 commonHelpers 導入
# 3. 運行測試確保無破壞
```

### 步驟 2: 處理 exported 函數

某些文件導出這些函數供其他文件使用，需要改為 re-export：

```javascript
// matchShared.js, reportGeneratorShared.js 等
export { normalizeText, tokenize } from '../../utils/commonHelpers.js';
```

### 步驟 3: 處理特殊變體

保留特殊實現的函數：
- `normalizeLineBreaks` - CV 特定
- `normalizePrompt` - 有長度限制
- `lower` - 簡單包裝
- `buildRootQuestionKey` - 業務邏輯
- `truncateText` - 有特殊邏輯
- `clampPriority` - 特定範圍

### 步驟 4: 運行完整測試套件

每個階段完成後：
```bash
cd backend && npm run test:all
```

### 步驟 5: 更新文檔

更新完成報告，記錄：
- 替換的文件數
- 減少的代碼行數
- 測試通過狀態

## 預期結果

- **文件修改數**: 50+ 個
- **代碼減少**: 500-800 行
- **新增導入**: 50+ 行
- **淨減少**: 450-750 行
- **測試狀態**: 所有測試保持通過

## 風險緩解

1. **逐個目錄替換**: 不一次性修改所有文件
2. **每階段測試**: 確保每個階段後測試通過
3. **Git 提交**: 每個階段完成後提交
4. **回滾計劃**: 如有問題可快速回滾

## 時間估算

- 階段 1 (aiControl): ~30 分鐘
- 階段 2 (cv): ~15 分鐘
- 階段 3 (match): ~10 分鐘
- 階段 4 (report): ~10 分鐘
- 階段 5 (其他): ~20 分鐘
- 測試和驗證: ~15 分鐘

**總計**: ~100 分鐘

## 下一步

由於涉及大量文件修改，建議：
1. 先完成階段 1 (aiControl 目錄) 作為試點
2. 驗證方法和測試策略
3. 如果成功，繼續其他階段
4. 或者創建自動化腳本批量處理

---

**創建日期**: 2026-05-28  
**狀態**: 準備執行  
**共享模塊**: ✅ 已創建並測試  
**待替換文件**: 50+ 個
