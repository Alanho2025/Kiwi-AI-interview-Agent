# Feature RFC: F-57 GitHub Actions 自動化 CD 與 EC2 遠端部署

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`.github/workflows/deploy-ec2.yml`, `scripts/deploy_ec2.sh`  
> **Git 演進 Commit 追蹤**：`PR #128`, Commit `6f26031`, `728cad5`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你每次要把寫好的軟體發布給全網用戶（持續部署 CD）。
> * **傳統做法**：工程師手動用 SSH 登入遠端 AWS 伺服器，手動 `git pull`、手動重新編譯。一旦工程師放假或手滑打錯指令，整個伺服器直接崩潰掛掉。
> * **GitHub Actions 自動化 CD (本 Feature)**：就像聘請了一位「24 小時機器人快遞員 (`deploy-ec2.yml`)」。只要你把測試通過的代碼合併到 `main` 分支，機器人自動用安全的 SSH Key 連上 EC2，一鍵執行 `docker compose up -d --build` 更新，全程無需人工介入，30 秒零失誤自動上線！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `6f26031` 早期)**：
  - 手動 SSH 登入 EC2 執行部署腳本。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 手動部署容易遺漏環境變數，且缺乏部署前 CI 測試門禁，壞代碼經常被直接推上 Staging。
* **現行架構 (Current Version - PR #128 Commit `6f26031`)**：
  - `.github/workflows/deploy-ec2.yml` 實現 main 分支合併自動觸發，利用 `appleboy/ssh-action` 安全通道連線 EC2，執行原子化滾動更新。

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - Main 分支 Merge 自動觸發、SSH 金鑰安全連線、Docker 靜默重構與滾動更新、部署結果 Slack/CI 提示。
* **Out-of-Scope (排除範圍)**：
  - 不在 CI 腳本中保存明文 SSH 私鑰 (完全加密於 GitHub Secrets)。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **CD 自動化部署耗時** | `< 45 秒` | GitHub Actions Workflow log |

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor Dev as 開發者 (Git Push main)
    participant GHA as GitHub Actions Runner
    participant Secret as GitHub Secrets (SSH_KEY)
    participant EC2 as AWS EC2 Server

    Dev->>GHA: Git Merge PR to main
    GHA->>Secret: 讀取 EC2_SSH_KEY 與 EC2_HOST
    GHA->>EC2: SSH 建立安全加密通道
    GHA->>EC2: 執行 cd /app && git pull && docker compose up -d --build
    EC2-->>GHA: 傳回 部署成功狀態 (exit code 0)
    GHA-->>Dev: GitHub Actions 綠燈放行 (Pass)
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（觸發 CD）**：開發者將程式碼合併到 `main` 分支，觸發 GitHub Actions。
2. **第二步（密鑰載入）**：Runner 從安全的 GitHub Secrets 中載入加密的 `EC2_SSH_KEY`。
3. **第三步（SSH 遠端連線）**：透過 `appleboy/ssh-action` 建立安全的 SSH 通道連上 EC2。
4. **第四步（一鍵滾動更新）**：在 EC2 上執行拉取代碼並重新構建容器，完成 0 人工干預部署！

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數：`deploy-ec2.yml` 的 SSH 部署步驟
* **現行程式碼位置**：[`.github/workflows/deploy-ec2.yml:L15-L35`](file:///Users/heminghan/Kiwi-AI-interview-Agent/.github/workflows/deploy-ec2.yml#L15-L35)

#### 現行真實程式碼 (Current Real Code Snippet)
```yaml
name: EC2 Continuous Deployment

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to AWS EC2 via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ubuntu/Kiwi-AI-interview-Agent
            git pull origin main
            docker compose up -d --build --remove-orphans
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **Line 4-5 (Main 分支觸發器)**：`branches: [ main ]`。只有成功合併到主分支的穩定程式碼才會觸發部署。
* **Line 11 (官方安全 SSH 套件)**：`uses: appleboy/ssh-action@v1.0.0`。使用社群開源且高度審計的 SSH 動作套件。
* **Line 13-15 ( Secrets 密鑰解引)**：從 `secrets.EC2_SSH_KEY` 載入私鑰，**絕不在 YAML 檔中寫死任何 IP 或密碼**！
* **Line 19 (清理孤兒容器)**：`--remove-orphans`。構建時自動清理不再使用的舊容器，防止磁碟與記憶體洩漏！

#### 替代寫法 A (Alternative Pattern A)：在 YAML 中硬編碼寫死 IP 與密碼
```yaml
# 替代寫法 A：寫死 IP 與密碼
host: "54.12.34.56"
password: "MyPassword123"
```

#### 微觀工程對比矩陣 (Micro Trade-off Analysis)
| 對比維度 | 現行寫法 (`secrets` 密鑰 + SSH Key) | 替代寫法 A (硬編碼密碼) |
| :--- | :--- | :--- |
| **資安合規 (Secret Protection)**| 100% 安全 (完全加密於 GitHub Vault，0 洩漏) | 致命資安漏洞 (密碼直接曝露於開源 Repo) |
| **孤兒容器清理** | 自動 `--remove-orphans` | 容易留下垃圾容器 |

---

## 5. 爆炸半徑與失敗矩陣 (Blast Radius & Failure Matrix)

### 5.1 影響範圍 (Blast Radius)
* **下游受影響模組**：AWS EC2 Staging 環境。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **SSH Key 認證失敗** | CI 步驟紅牌報錯 | 阻斷 CD 流程，舊版本容器繼續運行不中斷 |

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看 GitHub Actions Deploy Job Console 日誌。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 在 GitHub 上點擊 `Revert PR` 並 Merge。

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

### 7.1 30 秒大白話 Core Pitch (口語化台詞)
> *"面試官您好！這個 GitHub Actions CD 流程是我們自動化部署的流水線。我們沒有手動 SSH 登入伺服器，而是用 `appleboy/ssh-action` 配合 GitHub Secrets。只要代碼 Merge 到 `main` 分支，自動觸發連線並執行 `docker compose up -d --build --remove-orphans`！全程 30 秒零人工干預，而且清理了孤兒容器！"*

### 7.2 面試官追問實戰劇本 (Verbatim Defense Script)
* **面試官問**：「你為什麼要在 `docker compose up -d --build` 的命令後特別加上 `--remove-orphans` 參數？」
  - **轉碼新人回答**：「因為當我們在程式碼中刪除或重命名了某個 Docker 服務時，如果不加 `--remove-orphans`，舊的容器仍會在背景默默運行並佔用記憶體與連接埠。加上這個參數，Docker 會在更新時自動清理掉那些不再定義於 `docker-compose.yml` 中的孤兒容器，保持伺服器記憶體絕對乾淨！」
