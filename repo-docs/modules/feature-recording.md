# Voice recording

recording 路径保存整段面试音频，但它不应该阻塞 live STT 或下一题生成。产品规则是：报告导航等待本地最后一块录音 durable，不等待远端上传或 MP3 conversion 完成。

## 读者应该先记住什么

前端用 IndexedDB 保存 chunk，再用 upload manager 做低优先级、single-flight、可恢复上传。后端用 manifest、sequence、checksum、idempotent chunk storage 和 conversion worker 处理最终 MP3。

## 一个代表 case

```text
输入: MediaRecorder 产生 audio/webm chunks
动作: IndexedDB enqueue -> initialize upload -> PUT chunk -> finalize -> worker converts MP3
输出: report page 显示 uploading/processing/ready/retryable failure
边界: 关闭原浏览器 profile 会延迟恢复，直到同一 profile 再打开应用
```

## 代码怎么追

| 层 | 源码入口 | 说明 |
| --- | --- | --- |
| Backend routes | [recording routes](../../backend/src/api/routes/recordingRoutes.js) | file type、chunk size、session-audio endpoints |
| Controller | [recording controller](../../backend/src/controllers/recordingController.js) | initialize、chunk upload、finalize、retry、status、download |
| Upload service | [recording upload service](../../backend/src/services/recording/recordingUploadService.js) | ownership、idempotency、checksum、missing chunk handling |
| Worker | [recording conversion worker](../../backend/src/services/recording/recordingConversionWorker.js) | async MP3 conversion |
| Frontend runtime | [recording upload manager](../../frontend/src/runtime/recording/recordingUploadManager.js) | background upload/recovery |
| Recorder hook | [session audio recorder](../../frontend/src/hooks/voice/useSessionAudioRecorder.js) | voice session recording lifecycle |

## 怎么检查

后端重点测试在 `backend/tests/robustness/recording`，前端 runtime tests 在 `frontend/src/runtime/recording/__tests__`，浏览器恢复路径由 `frontend/e2e/recording-recovery.playwright.mjs` 覆盖。

继续读 [数据持久化与保留](data-persistence-retention.md)，看 recording 与 PostgreSQL、MongoDB、local files 的关系。

证据状态：除特别标注外，本页基于当前源码已确认。

