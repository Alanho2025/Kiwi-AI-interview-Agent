# Frontend 測試計劃

## 概述

本文檔定義 Kiwi AI Interview Agent 前端的完整測試策略，涵蓋 hooks、components、pages、utils 的測試範圍和優先級。

## 測試技術棧

- **測試框架**: Vitest
- **React 測試**: @testing-library/react
- **Hook 測試**: @testing-library/react (`renderHook`)
- **DOM 環境**: jsdom
- **Mock 工具**: Vitest (`vi.mock`, `vi.fn`)

## 當前測試覆蓋率

### Hooks (4/18 已測試, 22%)
- ✅ `useMicrophonePermission` - 3 tests
- ✅ `useReportData` - 2 tests (不完整)
- ✅ `useVoiceInterviewSession` - 5 tests
- ✅ `useRealtimeSpeechSocket` - 3 tests
- ❌ 其他 14 個 hooks 無測試

### Components (3 已測試)
- ✅ `TokenUsageSummary` - 基礎測試
- ✅ `VoiceInterviewPanel` - 基礎測試
- ✅ `CommercialStressTestSection` - 基礎測試
- ✅ `NZWorkplaceFitSection` - 基礎測試

### Pages (1 已測試)
- ✅ `InterviewPage.voiceMode` - 基礎測試

### Utils (9 已測試)
- ✅ Voice 相關 utils 有較好覆蓋
- ✅ ViewModel utils 有部分覆蓋

---

## 測試計劃

### 階段 1: 核心 Hooks 測試 (高優先級)

#### 1.1 `useInterviewSession` (最高優先級)
**檔案**: `frontend/src/hooks/__tests__/useInterviewSession.test.jsx`

**測試範圍**:
- ✅ 初始化狀態
- ✅ 開始面試流程 (`handleStart`)
- ✅ 提交答案 (`handleSubmit`)
- ✅ 暫停/恢復面試 (`handlePause`, `handleResume`)
- ✅ 結束面試 (`handleEnd`)
- ✅ 重複問題 (`handleRepeat`)
- ✅ 匯出逐字稿 (`handleExportTranscript`)
- ✅ 計時器邏輯 (elapsed time tracking)
- ✅ 錯誤處理
- ✅ Loading 狀態管理
- ✅ Session 狀態同步

**預估測試數量**: 15-20 tests

#### 1.2 `useCvUpload`
**檔案**: `frontend/src/hooks/__tests__/useCvUpload.test.jsx`

**測試範圍**:
- ✅ 拖放上傳 (drag & drop)
- ✅ 檔案選擇上傳
- ✅ 檔案類型驗證 (PDF, DOCX only)
- ✅ 上傳進度狀態
- ✅ 上傳成功/失敗處理
- ✅ 錯誤訊息顯示

**預估測試數量**: 8-10 tests

#### 1.3 `useTheme`
**檔案**: `frontend/src/hooks/__tests__/useTheme.test.jsx`

**測試範圍**:
- ✅ 初始主題載入 (localStorage)
- ✅ 切換主題 (`toggleTheme`)
- ✅ DOM class 更新 (`dark` class)
- ✅ localStorage 持久化

**預估測試數量**: 4-5 tests

#### 1.4 `useVoiceDeviceCheck`
**檔案**: `frontend/src/hooks/__tests__/useVoiceDeviceCheck.test.jsx`

**測試範圍**:
- ✅ 麥克風權限檢查
- ✅ 音訊裝置列舉
- ✅ 裝置可用性檢測
- ✅ 錯誤處理

**預估測試數量**: 6-8 tests

#### 1.5 `useDirectWavRecorder`
**檔案**: `frontend/src/hooks/__tests__/useDirectWavRecorder.test.jsx`

**測試範圍**:
- ✅ 開始錄音
- ✅ 停止錄音
- ✅ WAV 檔案生成
- ✅ 錄音時長追蹤
- ✅ 錯誤處理

**預估測試數量**: 6-8 tests

---

### 階段 2: Voice Hooks 測試 (高優先級)

#### 2.1 `useRealtimeMicStream` (補完)
**檔案**: `frontend/src/hooks/voice/__tests__/useRealtimeMicStream.test.jsx`

**當前狀態**: 只有 helper function 測試，缺少 hook 行為測試

**新增測試範圍**:
- ✅ Hook 初始化
- ✅ `startStream` 行為
- ✅ `stopStream` 行為
- ✅ Audio processing pipeline
- ✅ RMS level 計算
- ✅ Stream 狀態管理
- ✅ 錯誤處理

**預估測試數量**: 10-12 tests

#### 2.2 `useAssistantAudioQueue`
**檔案**: `frontend/src/hooks/voice/__tests__/useAssistantAudioQueue.test.jsx`

**測試範圍**:
- ✅ Audio queue 初始化
- ✅ `enqueueAudioChunk` 行為
- ✅ `clearQueue` 行為
- ✅ `unlockAudio` (user interaction requirement)
- ✅ Playback 狀態管理
- ✅ Queue 順序保證
- ✅ 錯誤處理

**預估測試數量**: 10-12 tests

#### 2.3 `useVoiceActivityDetection`
**檔案**: `frontend/src/hooks/voice/__tests__/useVoiceActivityDetection.test.jsx`

**測試範圍**:
- ✅ VAD 初始化
- ✅ `startVad` 行為
- ✅ `stopVad` 行為
- ✅ Speech start detection
- ✅ Speech end detection
- ✅ VAD frame callbacks
- ✅ Threshold 配置
- ✅ Metrics 追蹤

**預估測試數量**: 12-15 tests

#### 2.4 `useDuplexVoiceSocket`
**檔案**: `frontend/src/hooks/voice/__tests__/useDuplexVoiceSocket.test.jsx`

**測試範圍**:
- ✅ WebSocket 連接
- ✅ 訊息發送 (audio, control messages)
- ✅ 訊息接收 (transcript, audio, events)
- ✅ 連接狀態管理
- ✅ 錯誤處理
- ✅ 重連邏輯
- ✅ Latency tracking

**預估測試數量**: 15-18 tests

#### 2.5 `useAssistantPlaybackController`
**檔案**: `frontend/src/hooks/voice/__tests__/useAssistantPlaybackController.test.jsx`

**測試範圍**:
- ✅ Playback 控制
- ✅ 音量控制
- ✅ Playback 狀態追蹤
- ✅ 事件回調

**預估測試數量**: 8-10 tests

#### 2.6 `useDuplexSocketController`
**檔案**: `frontend/src/hooks/voice/__tests__/useDuplexSocketController.test.jsx`

**測試範圍**:
- ✅ Socket 生命週期管理
- ✅ 訊息路由
- ✅ 狀態同步
- ✅ 錯誤處理

**預估測試數量**: 10-12 tests

#### 2.7 `useSessionAudioRecorder`
**檔案**: `frontend/src/hooks/voice/__tests__/useSessionAudioRecorder.test.jsx`

**測試範圍**:
- ✅ 錄音開始/停止
- ✅ 音訊資料收集
- ✅ 檔案生成
- ✅ 上傳整合

**預估測試數量**: 8-10 tests

#### 2.8 `useVoiceLatencyController`
**檔案**: `frontend/src/hooks/voice/__tests__/useVoiceLatencyController.test.jsx`

**測試範圍**:
- ✅ Latency 追蹤
- ✅ Metrics 收集
- ✅ Performance 分析
- ✅ 報告生成

**預估測試數量**: 8-10 tests

#### 2.9 `useVoiceSessionLifecycleController`
**檔案**: `frontend/src/hooks/voice/__tests__/useVoiceSessionLifecycleController.test.jsx`

**測試範圍**:
- ✅ Session 生命週期管理
- ✅ 狀態轉換
- ✅ 清理邏輯
- ✅ 錯誤恢復

**預估測試數量**: 10-12 tests

#### 2.10 `useVoiceSessionRefs`
**檔案**: `frontend/src/hooks/voice/__tests__/useVoiceSessionRefs.test.jsx`

**測試範圍**:
- ✅ Ref 初始化
- ✅ Ref 更新
- ✅ Ref 清理

**預估測試數量**: 4-6 tests

#### 2.11 `useVoiceVadTurnController`
**檔案**: `frontend/src/hooks/voice/__tests__/useVoiceVadTurnController.test.jsx`

**測試範圍**:
- ✅ Turn 控制邏輯
- ✅ VAD 整合
- ✅ Barge-in 處理
- ✅ Turn 狀態管理

**預估測試數量**: 10-12 tests

---

### 階段 3: 補完現有測試

#### 3.1 `useReportData` (補完)
**檔案**: `frontend/src/hooks/__tests__/useReportData.test.jsx`

**當前狀態**: 只有 2 個基礎測試

**新增測試範圍**:
- ✅ 手動生成報告 (`handleGenerate`)
- ✅ QA 檢查 (`handleQa`)
- ✅ 匯出功能 (JSON, TXT, PDF)
- ✅ 錄音下載 (`handleDownloadRecording`)
- ✅ 錯誤處理
- ✅ Loading 狀態

**預估新增測試數量**: 10-12 tests

---

### 階段 4: Component 測試 (中優先級)

#### 4.1 核心 Components

**優先測試清單**:
1. `InterviewChatPanel` - 面試對話核心
2. `VoiceInterviewPanel` - 語音面試核心 (補完)
3. `TranscriptPanel` - 逐字稿顯示
4. `InterviewStatusBanner` - 狀態提示
5. `SessionInfoCard` - Session 資訊
6. `ReportHeroCard` - 報告摘要
7. `ReportDetailSections` - 報告詳情
8. `AnalysisWorkflowShell` - 分析流程
9. `CVReviewComponents` - CV 審查
10. `StartSessionCard` - 開始 Session

**每個 Component 測試範圍**:
- ✅ 渲染測試
- ✅ Props 傳遞
- ✅ 事件處理
- ✅ 條件渲染
- ✅ 錯誤邊界

**預估每個 Component**: 6-10 tests

---

### 階段 5: Page 測試 (中優先級)

#### 5.1 核心 Pages

**優先測試清單**:
1. `InterviewPage` - 面試頁面 (補完)
2. `ReportPage` - 報告頁面
3. `AnalyzePage` - 分析頁面
4. `HomePage` - 首頁

**每個 Page 測試範圍**:
- ✅ 頁面渲染
- ✅ 路由整合
- ✅ 資料載入
- ✅ 使用者互動流程
- ✅ 錯誤處理

**預估每個 Page**: 10-15 tests

---

### 階段 6: Utils 測試補完 (低優先級)

**需要補完的 Utils**:
- `analyzePageBuilder.js`
- `buildInterviewDisplayModel.js`
- `formatters.js`
- `sessionSettings.js`
- `voiceStatus.js`
- `voiceLatencyAcknowledgement.js`

---

## 測試執行策略

### 測試命令
```bash
# 執行所有測試
npm run test:all

# 執行特定類別測試
npm run test:hooks
npm run test:components
npm run test:pages
npm run test:utils
npm run test:voice

# 執行單一測試檔案
npm run test -- path/to/test.jsx

# Watch mode
npm run test -- --watch
```

### 測試覆蓋率目標

- **Hooks**: 90%+ 覆蓋率
- **Components**: 80%+ 覆蓋率
- **Pages**: 70%+ 覆蓋率
- **Utils**: 85%+ 覆蓋率

---

## 測試最佳實踐

### 1. Hook 測試模式
```javascript
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useMyHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.state).toBe('initial');
  });

  it('should handle async actions', async () => {
    const { result } = renderHook(() => useMyHook());
    
    await act(async () => {
      await result.current.doSomething();
    });

    expect(result.current.state).toBe('done');
  });
});
```

### 2. Component 測試模式
```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const onSubmit = vi.fn();
    render(<MyComponent onSubmit={onSubmit} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });
});
```

### 3. Mock 策略
- API calls: Mock at module level
- WebSocket: Use mock class
- Browser APIs: Mock with `vi.stubGlobal`
- LocalStorage: Mock or use real jsdom storage

### 4. 測試隔離
- 每個測試獨立
- 使用 `beforeEach` 清理
- 避免測試間依賴

---

## 成功指標

1. ✅ 所有核心 hooks 有完整測試
2. ✅ Voice 系統有完整測試覆蓋
3. ✅ 測試覆蓋率達標
4. ✅ CI/CD 整合測試通過
5. ✅ 無 flaky tests
6. ✅ 測試執行時間 < 30 秒

---

## 維護策略

1. **新功能必須有測試**: 任何新 hook/component 必須同時提交測試
2. **Bug 修復必須有測試**: 每個 bug 修復必須有對應的回歸測試
3. **定期審查**: 每月審查測試覆蓋率和測試品質
4. **重構時更新測試**: 重構時同步更新測試

---

## 附錄: 測試工具參考

- [Vitest 文檔](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Hooks](https://react-hooks-testing-library.com/)
- [Vitest Mock 指南](https://vitest.dev/guide/mocking.html)