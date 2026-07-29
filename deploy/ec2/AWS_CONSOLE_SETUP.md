# 可複製的 AWS Console → EC2 → GitHub Actions 部署

這份手冊把 Kiwi staging 已實際跑通的單台 EC2 架構整理成可重用的操作順序。它的目標是讓另一個 repository 也能做到：本機 push 到 `main`，GitHub Actions 先通過 CI，再以 OIDC + SSM 讓 EC2 checkout 同一個 commit 並更新 Docker Compose。

它不包含任何 access key、database URL、provider token 或 deploy key 私鑰。所有 `<...>` 都必須替換成新專案自己的值。

## 適用範圍與邊界

這是一個成本較低、容易操作的 **single-EC2 staging / 小型服務** 拓撲：一台公開子網中的 EC2 綁定 Elastic IP（EIP），Caddy 提供 HTTPS，再反向代理到只監聽 loopback 的 Docker container。

```text
browser / Vercel
  -> https://<API_DOMAIN>
  -> Elastic IP
  -> EC2 public subnet
  -> Caddy :443
  -> 127.0.0.1:<APP_PORT>
  -> Docker Compose application

GitHub push to main
  -> CI gates
  -> GitHub OIDC short-lived AWS role
  -> SSM Run Command
  -> exact commit checkout + Compose reload
```

不要把這份手冊當成 multi-AZ production 架構。它沒有 ALB、Auto Scaling、跨 AZ failover、backup/restore drill、已驗證 rollback、自動 instance recovery 或長期監控。需要高可用或私有資料庫時，應另行設計，而不是把本手冊的單台 EC2 放大宣稱成 production-ready。

## 先填這張部署卡

先在本機或 password manager 以外的安全筆記填好，接下來每個 Console 欄位都從這裡取值。不要把 real secret 寫進本檔或 repository。

| 欄位 | 範例形狀 | 用途 |
| --- | --- | --- |
| `PROJECT` | `my-app` | 名稱與 tag 前綴 |
| `ENV` | `stg` | staging / production 等環境名稱 |
| `AWS_REGION` | `ap-southeast-6` | VPC、EC2、EIP、SSM 與 Actions 必須相同 region |
| `VPC_CIDR` | `10.30.0.0/16` | 選未與公司 VPN、家用網路或其他 VPC 衝突的 RFC1918 範圍 |
| `PUBLIC_SUBNET_CIDR` | `10.30.0.0/20` | 放這台 EC2 的 public subnet |
| `API_DOMAIN` | `my-app-api.duckdns.org` | Caddy TLS 與 Vercel API base URL |
| `GITHUB_OWNER` / `GITHUB_REPO` | `owner` / `repo` | OIDC trust policy 的精準限制 |
| `DEPLOY_BRANCH` | `main` | 允許自動部署的唯一 branch |
| `APP_ROOT` | `/opt/my-app` | host checkout 路徑；要與 deploy script 一致 |
| `APP_PORT` | `8080` | 僅 host loopback publish；不可放進 public Security Group |

建議每個 AWS resource 加上 `Project=<PROJECT>`、`Environment=<ENV>`、`ManagedBy=manual-console` tags，方便之後找成本與清理資源。

## 1. 選定 region，建立最小 VPC 網路

1. 在 AWS Console 右上角選定 `AWS_REGION`。之後建立的 VPC、EC2、EIP、SSM role policy ARN 都必須使用同一個 region。
2. 開啟 **VPC** → **Your VPCs** → **Create VPC**。
3. 選 **VPC only**，名稱填 `<PROJECT>-<ENV>-vpc`，IPv4 CIDR 填 `VPC_CIDR`，建立。
4. 到 **Subnets** → **Create subnet**，選剛建立的 VPC，建立 `<PROJECT>-<ENV>-subnet-public1-<AZ>`。選一個可用 AZ，CIDR 填 `PUBLIC_SUBNET_CIDR`。
5. 選取該 subnet → **Actions** → **Edit subnet settings** → 啟用 **Auto-assign public IPv4 address**。EIP 會在後面取代暫時 public IP；這個設定仍可讓 host 在最初安裝套件、SSM 連線與拉取 image 時有 IPv4 出網能力。
6. 到 **Internet gateways** → **Create internet gateway**，名稱填 `<PROJECT>-<ENV>-igw`；建立後選它 → **Actions** → **Attach to VPC**。
7. 到 **Route tables** → **Create route table**，名稱填 `<PROJECT>-<ENV>-rtb-public`，選此 VPC。建立後：
   - **Routes** → **Edit routes** → 新增 `0.0.0.0/0`，target 選剛才的 Internet Gateway。
   - **Subnet associations** → **Edit subnet associations** → 勾選 public subnet。

完成後，public subnet 的 route table 應該同時有 VPC 的 `local` route 與 `0.0.0.0/0 -> igw-...`。有 EIP 但沒有這條 route，外部流量仍到不了 instance。

### 什麼時候不要建立 NAT / private subnet

這個簡化拓撲的 application 在 public subnet，資料庫由 Neon、MongoDB Atlas 或其他外部 managed provider 提供，因此不需要 NAT gateway、private subnet 或 S3 endpoint 才能讓 EC2 運作。AWS 的 VPC wizard 會提供這些選項，但 NAT gateway 會產生額外費用；除非新專案確實有私有 subnet 的 outbound requirement，否則不要照預設多建。

若未來要放 private RDS、兩台以上 application host、ALB 或 cross-AZ failover，請為該架構另做 VPC / NAT / route 設計。

## 2. 建立 EC2 Security Group

到 **EC2** → **Network & Security** → **Security Groups** → **Create security group**：

- Name：`<PROJECT>-<ENV>-ec2-sg`
- Description：`Public HTTPS access for <PROJECT> <ENV> EC2 via Caddy`
- VPC：選剛建立的 VPC

設定 inbound rules：

| Type | Protocol / port | Source | 為什麼 |
| --- | --- | --- | --- |
| HTTPS | TCP 443 | `0.0.0.0/0` | Caddy 的公開 TLS API 與 WebSocket |
| HTTP | TCP 80 | `0.0.0.0/0` | Let’s Encrypt HTTP challenge 與 HTTP → HTTPS redirect |
| SSH（可選） | TCP 22 | **My IP** / 固定管理 CIDR | 只在真的需要 break-glass SSH 時保留 |

保持預設 outbound `All traffic -> 0.0.0.0/0`，讓 EC2 可連 GitHub、Docker registry、外部資料庫與 provider API。**不要新增 `8080`、資料庫 port、Docker port 或任意管理 port 的 public inbound rule。** Compose 必須只 publish `127.0.0.1:<APP_PORT>`，由 Caddy 反向代理。

若已能用 SSM Session Manager 管理 host，`22` 可以移除；這是比長期公開 SSH 更小的入口面。

## 3. 建立 EC2 的 SSM instance role

這個 role 讓 EC2 出現在 Systems Manager，能以 browser shell 或 GitHub Actions 的 SSM Run Command 管理，而不需要把 SSH key 放到 CI。

1. 開啟 **IAM** → **Roles** → **Create role**。
2. Trusted entity 選 **AWS service**，use case 選 **EC2**。
3. 在 permissions 搜尋並勾選 AWS managed policy `AmazonSSMManagedInstanceCore`。
4. Role name 填 `<PROJECT>-<ENV>-ec2-ssm-role`，建立。

instance profile 是 EC2 取得 role 的容器；launch instance 時會選這個 role。不要把 GitHub Actions 的 deploy role 附給 EC2，兩者職責相反：EC2 只需要向 SSM 回報，GitHub role 才能對指定 instance 發 command。

## 4. Launch EC2 instance

到 **EC2** → **Instances** → **Launch instances**：

| Launch 欄位 | 建議值 |
| --- | --- |
| Name | `<PROJECT>-<ENV>-api-1` |
| AMI | Amazon Linux 2023（或你的 deploy script 已支援的 Linux） |
| Instance type | 依負載與預算選；Kiwi staging 的 `m7i-flex.large` 是當時的實例，不是其他專案的預設推薦 |
| Key pair | 若只用 SSM，選 **Proceed without a key pair**；若保留 SSH，才建立並妥善保存 key pair |
| Network | 剛建立的 VPC、public subnet、Auto-assign public IP **Enable** |
| Firewall | 選既有 `<PROJECT>-<ENV>-ec2-sg` |
| Configure storage | `gp3`、encrypted；容量依 Docker image、logs 與 uploads 決定，30 GiB 是可起步的範例而非固定值 |
| Advanced details → IAM instance profile | `<PROJECT>-<ENV>-ec2-ssm-role` |
| Shutdown behavior | `Stop`，避免 Console 誤按 stop 直接 terminate host |

Launch 後等 instance state 為 `Running`。到 instance 詳情確認 **VPC ID**、**Subnet ID**、**Security groups** 與 **IAM role** 都是本次建立的資源。

### 先驗證 SSM，而不是先開 SSH

在 instance 詳情按 **Connect** → **Session Manager** → **Connect**。若不能連：

1. 到 instance 詳情確認 IAM role 真的已附上 `AmazonSSMManagedInstanceCore`。
2. 到 **Systems Manager** → **Fleet Manager / Managed nodes** 確認 instance 出現且是 online。
3. 確認 instance 在 public subnet、route table 有 Internet Gateway route，且 OS 有可運作的 SSM Agent。

先修好 SSM 再繼續；後續 GitHub 自動部署依賴它。

## 5. 配置並綁定 Elastic IP

EC2 的 auto-assigned public IPv4 在 stop/start 後會改變；API DNS 與 external database IP allowlist 都需要穩定的出口 / 入口位址，因此要用 EIP。

1. **EC2** → **Network & Security** → **Elastic IPs** → **Allocate Elastic IP address**。
2. 加上 `<PROJECT>` / `<ENV>` tags，建立。
3. 選取 EIP → **Actions** → **Associate Elastic IP address**。
4. Resource type 選 **Instance**，選剛建立的 instance，Private IP 選它的 primary private IPv4，按 **Associate**。
5. 回到 instance 詳情，確認 **Elastic IP addresses** 出現該 EIP。

EIP 必須與 instance 位於相容的 network border group，且 instance 必須在可經 Internet Gateway 出入的 public subnet。EIP 不論是否關聯都可能產生成本；不再使用時應先確認 DNS / allowlist 已移走，再 release address。

## 6. 建立 DNS 與 Caddy HTTPS

使用自己的 domain 或 DuckDNS 都可。沒有付費 domain 時，DuckDNS 的 subdomain 也能讓 Caddy 取得公開 TLS certificate。

1. 在 DNS provider 建立 `<API_DOMAIN>` 的 A record，指向 EIP 的 public IPv4。
2. 等待 DNS 生效，再從本機確認：

   ```bash
   dig +short <API_DOMAIN>
   ```

   輸出必須是 EIP；不是 EC2 暫時 public IPv4。

3. 依 [EC2 第一版部署手冊](README.md#啟用-caddy) 將 [Caddyfile](Caddyfile) 的 `api.your-domain.com` 換成 `<API_DOMAIN>`，再 validate、reload 並檢查：

   ```bash
   curl --fail --silent --show-error https://<API_DOMAIN>/health
   ```

在 Caddy 首次啟動前，Security Group 的 `80` 與 `443` 必須已開放，DNS 必須已指向 EIP；否則 certificate issuance 常會失敗。不要以 EC2 的 `*.compute.amazonaws.com` host name 當公開 TLS domain。

## 7. 在 host 建立 application runtime

這一步不再是 AWS Console 設定，但它是可複製流程的一部分。用 Session Manager 在 host 執行，並以現有 [EC2 第一版部署手冊](README.md) 為 source of truth：

1. 安裝 Docker Engine、Docker Compose plugin、Git、curl 與 Caddy。
2. 在 `APP_ROOT` clone repository。
3. 建立 `/srv/<PROJECT>/uploads`，讓 container 的 non-root UID 可以寫入；建立 `/etc/<PROJECT>/backend.env`，只在 host 填 real env values。
4. install `compose.yaml` 對應的 systemd service，讓 Docker Compose 開機自啟。
5. 本機先驗證 `http://127.0.0.1:<APP_PORT>/health` 與 `/api/health`，再驗證公開 `https://<API_DOMAIN>/health`。

為了方便其他專案複製，請把 `APP_ROOT`、env file 路徑、uploads mount、Compose file、systemd service name 和 health endpoint 集中在新專案自己的 deploy script；不要在 GitHub Actions inline command 裡散落這些值。

### 新 repository 至少要有的四個 deployment assets

AWS Console 設定本身不會自動產生 Docker deployment。每個新 repository 至少要擁有並自行核對下列內容：

| Asset | 必須保留的責任 | Kiwi 參考 |
| --- | --- | --- |
| Compose config | 只將 app port publish 到 `127.0.0.1`、掛載持久資料、讀取 host env file | [compose.yaml](compose.yaml) |
| Reverse proxy config | `<API_DOMAIN>` 的 TLS 與 WebSocket reverse proxy 到 loopback port | [Caddyfile](Caddyfile) |
| Host deploy script | 驗證 requested SHA、env 不是 example、reload service、檢查 readiness | [deploy-from-github.sh](deploy-from-github.sh) |
| CI deploy job | 只在 protected deploy branch 的 CI 成功後，透過 OIDC + SSM 發送 exact `github.sha` | [ci.yml](../../.github/workflows/ci.yml#L334-L438) |

Kiwi 的 `deploy-from-github.sh` 有 `/opt/kiwi`、`/etc/kiwi/backend.env`、`kiwi-compose.service` 與 `/api/health` 等固定值。新 repository 要保留「exact SHA + clean host + readiness」這個安全契約，但必須替換自己的路徑、service name、env file 與 health endpoint；不可原封不動複製後期待它部署另一個專案。

## 8. 設定 GitHub read-only deploy key（host → GitHub）

SSM Run Command 在這個模式會以 root 執行 `git fetch`，所以 **EC2 host 本身** 必須能讀取 private repository。這與下一節的 GitHub → AWS OIDC 是兩個不同方向的權限。

1. 在 host 生成專用 read-only public key；不要使用個人 SSH key。
2. GitHub repository → **Settings** → **Deploy keys** → **Add deploy key**，貼上 public key，**不要勾 Allow write access**。
3. 把 private key 留在 `/root/.ssh/<PROJECT>-github`，設定 root 的 `/root/.ssh/config` 明確選用它。
4. 不輸出 private key 的驗證：

   ```bash
   sudo ssh -T git@github.com || true
   sudo git -C <APP_ROOT> fetch --prune origin <DEPLOY_BRANCH>
   ```

Kiwi 的 root SSH config 形狀與權限模式見 [Host 的 GitHub read access](README.md#host-的-github-read-access)。

## 9. 設定 GitHub Actions → AWS 的 OIDC + SSM

### 9.1 建立 IAM OIDC provider

在 **IAM** → **Identity providers** → **Add provider**：

- Provider type：`OpenID Connect`
- Provider URL：`https://token.actions.githubusercontent.com`
- Audience：`sts.amazonaws.com`

同一 AWS account 的 GitHub provider 通常只需要建立一次；之後每個 repository 建自己的受限 deploy role。不要把 AWS access key 放進 GitHub Secrets，這個流程使用的是每次 workflow 取得的短期 OIDC credentials。

### 9.2 建立受限 deploy role

1. **IAM** → **Roles** → **Create role**。
2. Trusted entity 選 **Web identity**。
3. Identity provider 選 `token.actions.githubusercontent.com`，Audience 選 `sts.amazonaws.com`。
4. GitHub organization 填 `<GITHUB_OWNER>`，repository 填 `<GITHUB_REPO>`，branch 填 `<DEPLOY_BRANCH>`。
5. Role name 填 `<PROJECT>-<ENV>-actions-deploy-role`。
6. 建立後到 **Trust relationships** 檢查 policy 至少等價於下列 template：

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
             "token.actions.githubusercontent.com:sub": "repo:<GITHUB_OWNER>/<GITHUB_REPO>:ref:refs/heads/<DEPLOY_BRANCH>"
           }
         }
       }
     ]
   }
   ```

`sub` 必須精準限制 repository 與 branch；不要用 `repo:<GITHUB_OWNER>/*` 或 `*` 當作快速通過設定。

### 9.3 附上最小 SSM policy

在 deploy role 的 **Permissions** → **Add permissions** → **Create inline policy** → JSON，使用下列 template。它只允許 `AWS-RunShellScript` 對一台指定 EC2 發 command，並讀取 command 結果：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendDeployCommandOnlyToTargetInstance",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:<AWS_REGION>::document/AWS-RunShellScript",
        "arn:aws:ec2:<AWS_REGION>:<AWS_ACCOUNT_ID>:instance/<EC2_INSTANCE_ID>"
      ]
    },
    {
      "Sid": "ReadRunCommandResult",
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*"
    }
  ]
}
```

若 workflow 之後新增 `ListCommandInvocations`、CloudWatch Logs、S3 output 或 tag-based target，必須重新收斂 policy；不要為了省事附 `AdministratorAccess`。把 role ARN 記下來。

### 9.4 在 GitHub 放「非 secret」repository variables

GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **Variables**，新增：

| Variable | Value |
| --- | --- |
| `AWS_EC2_DEPLOY_ROLE_ARN` | 剛建立 deploy role 的 ARN |
| `AWS_EC2_DEPLOY_INSTANCE_ID` | 這台 EC2 的 instance ID，例如 `i-...` |

它們不是 secret；真實 database URL、OAuth secret、API key 仍只放 EC2 的 `/etc/<PROJECT>/backend.env` 或新專案明確採用的 secret store。Kiwi workflow 需要 job-level `id-token: write`，並使用 `aws-actions/configure-aws-credentials`；可對照 [CI workflow](../../.github/workflows/ci.yml#L334-L438)。

## 10. 首次部署與驗證順序

按這個順序驗證，失敗時不要先改大範圍 Security Group：

1. **AWS Console**：instance `Running`，EIP 已關聯，SSM managed node online，Security Group 沒有 public `APP_PORT`。
2. **Host（Session Manager）**：`docker compose ps` 顯示 backend running，loopback `/health` 與 `/api/health` 皆成功。
3. **Internet**：`curl https://<API_DOMAIN>/health` 成功，Caddy certificate 沒有 error。
4. **GitHub host read access**：root 的 `git fetch` 成功。
5. **GitHub Actions**：一個送往 `<DEPLOY_BRANCH>` 的 commit 先跑完 CI，再出現並成功完成 deploy job。
6. **Browser**：frontend 的 external API base URL 指向 `https://<API_DOMAIN>`；驗證登入、主要 HTTP API、SSE、WebSocket、upload 與該專案真正依賴的 provider flow。

Kiwi 已有一條 staging 實例，CI exact-SHA SSM deployment、Match、Voice interview、Report output 都已實測；這是本手冊的參考證據，不會自動替新專案證明它的 env、database、OAuth、provider 或 browser flow 正常。

## 新專案複製時，哪些可以沿用、哪些一定要換

| 可沿用的模式 | 新專案一定要替換 |
| --- | --- |
| public subnet + IGW + EIP + Caddy + loopback Compose | project / environment 名稱、CIDR、domain、repo、branch、instance ID、role ARN |
| `AmazonSSMManagedInstanceCore` instance role | instance type、disk size、health endpoint、container port、systemd / Compose path |
| GitHub OIDC short-lived credentials | trust policy 的 repository / branch、SSM policy 的 region / account / instance ARN |
| host read-only deploy key | 每個 private repo 各自的 deploy key；不可跨專案共用 private key |
| CI success → exact SHA → SSM deploy | GitHub workflow、deploy script、env file checks、rollback strategy |

## 官方參考與已知成本

- AWS VPC 的 public subnet 需要 Internet Gateway 與 route table 的 `0.0.0.0/0` route：[Add internet access to a subnet](https://docs.aws.amazon.com/vpc/latest/userguide/working-with-igw.html)。
- EIP 的 allocate / associate 操作、public subnet 前提與費用提醒：[Associate an Elastic IP address with an instance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/working-with-eips.html)。
- Session Manager 的 EC2 instance profile 與 `AmazonSSMManagedInstanceCore`：[Verify or add instance permissions](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-instance-profile.html)。
- GitHub OIDC trust policy 的 `sub` branch 限制：[AWS IAM OIDC role guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html) 與 [GitHub OIDC in AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)。
- SSM `SendCommand` 可同時以 document 與指定 EC2 instance ARN 收斂資源範圍：[Systems Manager authorization reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_ssm.html)。

部署前先查看你選的 region / instance type、EIP、EBS、NAT gateway（若有）與資料傳輸成本。此手冊特意不預設 NAT gateway，因為它不是本拓撲的功能前提且會增加固定成本。

证据状态：Kiwi 的 single-EC2 staging flow 已有 CI、AWS provider 與 browser evidence；本手冊的可複製步驟對其他專案仍需各自完成驗證。
