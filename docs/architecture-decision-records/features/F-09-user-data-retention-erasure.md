# Feature RFC: F-09 用戶資料保留與到期清理

> **文件狀態**：Updated
> **系統成熟度 (Readiness Level)**：Partial — Saved JD 的讀取隔離與 schema TTL 已有本地測試；部署後 index 建立及實際 MongoDB 到期刪除仍須驗證。
> **核心模組路徑**：`backend/src/services/retention/retentionPolicy.js`、`backend/src/services/company/companyValuesRepository.js`、`backend/src/db/models/companyValuesProfileModel.js`
> **實作狀態 (Implementation Status)**：Partial
> **校驗測試路徑 (Verified by Tests)**：`backend/tests/robustness/jd/roleFitReviewRepositoryRobustness.test.js`、`backend/tests/robustness/retention/retentionModelIndexes.test.js`

---

## 1. 現行行為與問題背景

本功能目前可證明的是「Saved JD / CompanyValuesProfile 的七天保留規則」，不是帳號刪除或跨資料庫的合規保證。`DEFAULT_RETENTION_DAYS` 與 `RETENTION_DAYS` 都是 7；寫入或更新 profile 時會更新 `retentionUntil`，而 Mongo schema 以 `updatedAt` 設定 604800 秒 TTL。

先前 Saved JD 列表只以 `userId` 查詢，因此即使資料已超過七天，MongoDB 尚未清除前仍會被 UI 顯示。舊資料也可能沒有 `retentionUntil`，所以只依賴該欄位不能覆蓋歷史資料。現行修正採用所有 timestamp schema 都有的 `updatedAt`：讀取時立即隱藏到期資料；MongoDB TTL 則在已部署 index 後負責後續物理刪除。

## 2. 邊界與成功標準

| 項目 | 現在的行為 | 證據或驗證 |
| --- | --- | --- |
| Saved JD 顯示 | 只回傳同一 owner、`deletedAt: null` 且 `updatedAt` 在七天 cutoff 之後的 profile | repository robustness test |
| Saved JD 實體到期 | `CompanyValuesProfile` 宣告 `updatedAt` 的 604800 秒 TTL index | retention model index test |
| 新／舊資料一致性 | TTL 使用 `updatedAt`，不依賴舊資料是否有 `retentionUntil` | schema 與 policy source inspection |
| 手動跨 store cleanup | 保留 audit manifest、dry-run、backup 與 matching approval token 的既有流程 | 不由此功能繞過 |

不在本 RFC 宣稱的範圍：帳號級聯刪除、備份資料刪除、加密保證、法律或 GDPR/Privacy Act 合規認證。`RETENTION_WORKER_ENABLED` 的預設值仍是 `false`；這個 worker 與手動 cleanup 的安全流程沒有被改成自動刪除開關。

## 3. Saved JD 的資料流

1. 使用者在 JD 頁打開已儲存的職缺；frontend `AnalyzePage` 經 `getSavedJDs()` 呼叫 `GET /job-description/saved`。
2. controller 透過 `getCompanyValuesProfilesByUserId(user.id)` 讀取 profile。
3. repository 以 owner、未軟刪除與 `updatedAt > buildRetentionCutoff(now)` 組成 Mongo query；過期項目在 API 回應前就被排除。
4. `CompanyValuesProfileSchema` 對 `updatedAt` 宣告七天 TTL。部署後 MongoDB 會依此 index 進行到期刪除；TTL 的實際掃描時間不應被 UI 當成即時保證，因為讀取層已先隔離到期資料。

## 4. 關鍵原始碼

Saved JD repository 的共用讀取條件如下，來源為 [`companyValuesRepository.js`](../../../backend/src/services/company/companyValuesRepository.js)：

```javascript
const buildActiveCompanyValuesProfileFilter = (filter, now) => ({
  ...filter,
  deletedAt: null,
  updatedAt: { $gt: buildRetentionCutoff(now) },
});
```

`getCompanyValuesProfilesByUserId`、`getCompanyValuesProfile` 與 `getCompanyValuesProfileByFingerprint` 都使用這個條件，因此 saved list 和後續依 session/fingerprint 取用不會重新帶出超期 JD。

model 採用既有的 runtime TTL helper，來源為 [`companyValuesProfileModel.js`](../../../backend/src/db/models/companyValuesProfileModel.js)：

```javascript
CompanyValuesProfileSchema.index({ userId: 1, jdFingerprint: 1 }, { unique: true });
CompanyValuesProfileSchema.index({ sessionId: 1 }, { sparse: true });
applyRuntimeRetentionIndex(CompanyValuesProfileSchema);
```

helper 由 [`runtimeRetentionIndex.js`](../../../backend/src/db/runtimeRetentionIndex.js) 以 `RETENTION_DAYS * 24 * 60 * 60` 建立 `{ updatedAt: 1 }` TTL index。保留 cutoff 的計算則在 [`retentionPolicy.js`](../../../backend/src/services/retention/retentionPolicy.js)；手動 cleanup 的 approval gate 仍在 [`runRetentionCleanup.js`](../../../backend/src/scripts/runRetentionCleanup.js)。

## 5. 失敗模式與處理方式

| 情境 | 表現 | 處理 |
| --- | --- | --- |
| 過期 JD 尚未被 Mongo TTL monitor 實體移除 | 列表與 repository 讀取已排除，不應再次在產品流程使用 | 確認部署的 collection 已建立 TTL index；不要以 UI 日期判斷 index 是否存在 |
| 舊資料沒有 `retentionUntil` | 不再使 TTL 失效，因為依 `updatedAt` 判定 | 不需對既有資料做手動 backfill |
| 需要刪除其他 store 的資料 | 不能跳過 manifest、dry-run、backup 或 approval token | 使用既有 retention audit/cleanup 流程並由操作人批准 |
| MongoDB 未連線或未完成 index 建立 | 無法聲稱已物理清除任何 live 資料 | 以部署後 index 檢查與實際資料觀察驗證 |

## 6. 驗證與部署檢查

本地 deterministic 驗證：

```bash
cd backend
NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run \
  tests/robustness/jd/roleFitReviewRepositoryRobustness.test.js \
  tests/robustness/retention/retentionModelIndexes.test.js
```

部署後需要由真人確認 MongoDB 的 `companyvaluesprofiles` collection 已有 `ttl_runtime_updated_at`，且到期 profile 在 TTL monitor 執行後被移除。這是外部資料庫狀態，未以本地單元測試宣稱為已完成。

## 7. 面試問答口述講稿

> **問題**：為什麼同時做讀取過濾與 TTL？
>
> **回答**：TTL 是資料庫層的最終實體清理，但其掃描不是畫面即時更新機制。repository 先以同一個七天 cutoff 排除到期資料，使用者不會在 TTL 尚未掃描的窗口看到舊 JD；TTL 再處理實體資料。這也避免舊資料缺少 `retentionUntil` 時被保留規則漏掉。
