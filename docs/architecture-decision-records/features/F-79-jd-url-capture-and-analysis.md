# Feature RFC: F-79 JD URL Capture and Analysis

> **文件狀態**：Updated
> **系統成熟度 (Readiness Level)**：Partial — URL validation, SSRF checks, bounded fetch, visible-text extraction and JD preparation are covered by local source/tests; redirect edge cases, live sites and browser flow are not verified here.
> **核心模組路徑**：`backend/src/services/jobDescription/urlCaptureService.js`、`backend/src/services/jobDescription/jobDescriptionPreparationService.js`、`backend/src/api/routes/jobDescriptionRoutes.js`、`backend/src/controllers/jobDescriptionController.js`
> **Git 演進 Commit 追蹤**：Current source snapshot `a89e6eba` (2026-08-02)
> **主要負責人 / 日期**：Kiwi engineering / 2026-08-02
> **實作狀態 (Implementation Status)**：Partial
> **校驗測試路徑 (Verified by Tests)**：`backend/tests/unit/urlCaptureService.test.js`、`backend/tests/robustness/jd/roleFitJdContextRobustness.test.js`

## 1. 目標與邊界

讓 JD 輸入同時接受貼上的文字與 `http://` / `https://` URL。URL 內容先被安全抓取與清洗，再送入既有 guarded JD parser、Role-Fit draft 與 fingerprint pipeline。此 RFC 不宣稱登入牆、JavaScript-rendered page、所有 redirect chain 或 live provider 成功。

## 2. Feature Definition & Code Blueprint

### 2.1 Entry point / objects

| 項目 | 定義 |
| --- | --- |
| Preparation entry | `prepareJobDescriptionForReview({ rawJD, userId, companyWebsiteUrl, userCompanyContext })` |
| URL detector | `getJobDescriptionText`：`/^https?:\/\//i` 命中才走 capture |
| Capture entry | `captureUrlContent(urlString)` → `{ visibleText, finalUrl }` |
| Controller output | `POST /job-description/paraphrase` 回傳 `structuredJD`, `structuredJDRubric`, `rawJD`, `sourceUrl` (`jobDescriptionController.js:45-51`) |
| Persisted source | `saveCompanyRoleFitDraft` 保存 `rawJD`、`sourceUrl` 與 role-fit draft |

### 2.2 Input, helpers, and transformation

```js
// URL input
const input = 'https://public.example/jobs/data-engineer';
// capture result
const captured = { visibleText: string, finalUrl: string };
// prepare result
const prepared = { structuredJD, structuredJDRubric, roleFit, rawJD, sourceUrl };
```

| Helper | Input → output | 行為 |
| --- | --- | --- |
| `validateUrlForCapture` | URL string → normalized URL | 只允許 HTTP(S)，拒絕 localhost/private DNS resolution |
| `extractTargetedContainer` | HTML → job-specific container | 優先抓 SEEK/Indeed/LinkedIn-like selectors，含 nested div handling；否則 main/article/full HTML |
| `extractVisibleText` | HTML → plain visible text | 移除 script/style/nav/footer/noscript、decode entities、normalize whitespace |
| `captureUrlContent` | URL → visible text + final URL | 5 秒 timeout、HTTP status/content-type/empty-text guards |
| `buildGuardedStructuredJobDescriptionRubric` | text → guarded rubric | existing parser boundary; not URL-specific |
| `buildRoleFitProfile` | rubric + company context → reviewable Role-Fit | source labels, diagnostics, unreviewed status |

### 2.3 Implementation algorithm (規格；不是現行程式碼)

```text
function prepareJd(rawJD):
  const target = trim(rawJD)
  if target starts with http(s):
    const url = validateUrlForCapture(target)
    const { visibleText, finalUrl } = captureUrlContent(url)
    normalizedText = visibleText; sourceUrl = finalUrl
  else:
    normalizedText = target; sourceUrl = ''
  const rubric = buildGuardedStructuredJobDescriptionRubric(normalizedText)
  const roleFit = buildRoleFitProfile(rubric + company context)
  if roleFit.companyContext.status != ready: return 400 Missing company context
  const jdFingerprint = hash(normalizedText + reviewed overview fields)
  persist draft with sourceUrl
  return formatted rubric + rawJD normalizedText + sourceUrl
```

### 2.4 Branch / error contract

| Condition | Result |
| --- | --- |
| Non-URL text | bypass network capture; use trimmed text and `sourceUrl: ''` |
| Invalid scheme or malformed URL | 400 `Invalid URL` / `Unsupported Scheme` |
| Local/private host or DNS resolving to private IP | 400 `Blocked Source`; no fetch |
| HTTP error or unsupported content type | 400 `Fetch Failed` / `Unsupported Content Type` |
| Empty visible text | 400 `Extraction Failed` |
| Timeout/network exception | 400 `Fetch Failed`; no fake JD is produced |
| Company context missing after parsing | 400 `Missing company context`; Role-Fit review cannot start |

## 3. Data flow

```mermaid
flowchart LR
  A[Text or JD URL] --> B{HTTP(S) URL?}
  B -- no --> C[Trim raw text]
  B -- yes --> D[Validate scheme + DNS]
  D --> E[Fetch <= 5s]
  E --> F[Target selector + visible text]
  C --> G[Guarded JD parser]
  F --> G
  G --> H[Role-Fit draft + fingerprint]
  H --> I[Persist sourceUrl and review draft]
```

## 4. Evidence matrix

| Claim | Source | Test | Boundary / status |
| --- | --- | --- | --- |
| HTTP(S) detection and returned `sourceUrl` | `jobDescriptionPreparationService.js:13-23,26-102` | role-fit context tests | local source / Verified |
| Selector extraction and nested container handling | `urlCaptureService.js:89-138` | `urlCaptureService.test.js:4-23` | local deterministic / Verified |
| Visible text removes non-content and decodes entities | `urlCaptureService.js:141-169` | `urlCaptureService.test.js:57-73` | local deterministic / Verified |
| SSRF checks cover scheme, localhost and private DNS | `urlCaptureService.js:50-87` | `urlCaptureService.test.js:76-86` | local / Partial (DNS/live network not exercised) |
| Same-host redirect policy for JD capture | `urlCaptureService.js:177-208` | no dedicated redirect test | source shows `response.url`; policy not verified / Not verified |
| Browser paste-and-submit flow and live job pages | frontend/controller | no browser/live run here | browser/provider / Not verified |

## 5. Operations and interview explanation

When a URL fails, start with the error code, hostname validation, content type, and extracted text length. Do not silently fall back to the URL string as JD content. In plain language: the system first checks whether the input is a URL, safely downloads only public text, strips page chrome, then runs the same JD parser as pasted text.
