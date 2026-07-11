# Role-Fit 人工校準指南 v1

## 目的

人工校準用來確認自動 retrieval、grounding 與 trajectory judge 的分數是否符合產品判斷。這不是功能測試，也不能由實作者假裝成人工 reviewer 自行填滿。

## Review 流程

1. 開啟 case 指向的 latest JSON result，核對輸入、ranked chunks、claims 或 trajectory record。
2. 以 0 到 1 評分；`1` 代表完全符合該 case 的證據、來源政策與狀態安全要求。
3. 在 `humanReview` 填入 `status=completed`、數值 `score`、可追責的 `reviewerId`、ISO `reviewedAt` 與具體 `rationale`。
4. 不要只看總分。高風險 case 必須檢查 forbidden evidence、JD/CV source class、misunderstanding repair 與 terminal state。
5. 執行 `npm run eval:calibration`，查看每個 domain/risk slice 的 disagreement。

## Threshold 規則

- 任一 case 未完成 review 時，`thresholdDecision.status` 必須維持 `not_set`。
- 全部 case 完成後，先處理 absolute difference 大於 `0.15` 的 disagreement。
- 要設定數值 release threshold，至少兩個 reviewer ID 必須共同留下 decision、日期與理由。
- 未達上述條件時，報告中的 benchmark 分數只能做診斷，不能宣稱為 release gate。

## 舊筆記限制

`manual-calibration-notes.md` 缺少 reviewer 身分、review 日期與逐 case 自動結果 locator，只能當歷史參考，不能用來把本資料集標記為已校準。
