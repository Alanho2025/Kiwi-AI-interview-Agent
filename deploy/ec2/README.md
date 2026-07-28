# EC2 第一版部署

這個部署包把 backend container 限制在 EC2 loopback，由 host 上的 Caddy 提供公開 HTTPS 與 WebSocket reverse proxy。第一版繼續使用 `/app/uploads`，透過 host bind mount 保留 CV、legacy recording 與 resumable recording。

## 上線前準備

- EC2 已安裝 Docker Engine、Docker Compose plugin 與 Caddy。
- `api.your-domain.com` 的 DNS 已指向 EC2 public IP。
- Security Group 對公網只開放 `80`、`443` 與受限管理來源的 `22`；不要開放 `8080`。
- PostgreSQL 與 MongoDB 已完成備份、連線白名單與 EC2 reachability 驗證。
- repository 位於 `/opt/kiwi`。若使用其他路徑，先修改 `kiwi-compose.service` 的 `WorkingDirectory`。

## 建立資料與 secret 目錄

Container 使用 image 內建的 `node` user。host uploads 目錄必須允許 UID/GID `1000` 寫入：

```bash
sudo install -d -m 0750 -o 1000 -g 1000 /srv/kiwi/uploads
sudo install -d -m 0750 /etc/kiwi
sudo install -m 0640 deploy/ec2/backend.env.example /etc/kiwi/backend.env
sudoedit /etc/kiwi/backend.env
```

`/etc/kiwi/backend.env` 不可加入 repository。將所有 `replace-with-...` 與 database URL 換成 production value。Shadow validation 期間保留：

```text
RECORDING_WORKER_ENABLED=false
RETENTION_WORKER_ENABLED=false
```

## 啟動 backend

先驗證 Compose 可以解析設定，再安裝 systemd unit：

```bash
cd /opt/kiwi
sudo KIWI_BACKEND_ENV_FILE=/etc/kiwi/backend.env docker compose -f deploy/ec2/compose.yaml config --quiet
sudo docker compose -f deploy/ec2/compose.yaml build
sudo install -m 0644 deploy/ec2/kiwi-compose.service /etc/systemd/system/kiwi-compose.service
sudo systemctl daemon-reload
sudo systemctl enable --now kiwi-compose.service
```

Container 只發布到 `127.0.0.1:8080`。先從 EC2 本機確認 liveness 與 database readiness：

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/health
curl --fail --silent --show-error http://127.0.0.1:8080/api/health
```

## GitHub push 自動更新 EC2

`main` 的 CI 全數通過後，[CI workflow](../../.github/workflows/ci.yml) 的 `Deploy EC2 staging` job 才會執行。它使用 GitHub OIDC 換取短期 AWS credentials，透過 SSM Run Command 在指定 host 執行下列邊界內的工作：

1. 拒絕 `/opt/kiwi` 有未提交變更的 host，避免覆蓋人工修改。
2. 精準 checkout CI 已驗證的 `github.sha`，不是部署執行當下可能已更新的 branch head。
3. 重新解析 Compose、reload `kiwi-compose.service`，再以 `/api/health` 檢查 PostgreSQL 與 MongoDB readiness。

首次啟用前，operator 必須完成下列外部設定；repository 不保存 AWS access key：

- IAM OIDC provider：`https://token.actions.githubusercontent.com`，audience 為 `sts.amazonaws.com`。
- deploy role 的 trust policy 只允許 `repo:Alanho2025/Kiwi-AI-interview-Agent:ref:refs/heads/main`。
- deploy role 只允許對指定 EC2 instance 使用 `ssm:SendCommand` 的 `AWS-RunShellScript` document，以及讀取該 command 的結果。
- GitHub Actions repository variables：`AWS_EC2_DEPLOY_ROLE_ARN`、`AWS_EC2_DEPLOY_INSTANCE_ID`。

Host 端腳本是 [deploy-from-github.sh](deploy-from-github.sh)。它不讀取或列印 `/etc/kiwi/backend.env` 的內容；若發現範例值會直接拒絕部署。SSM deploy 失敗時 GitHub Actions job 會失敗，現有 container 不應被宣稱為已更新。Rollback 仍需由 operator 選擇已知可用的 commit 並重新部署；這個第一版未自動回退。

## 啟用 Caddy

先把 `Caddyfile` 的 `api.your-domain.com` 換成正式 API domain：

```bash
sudo install -m 0644 deploy/ec2/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl --fail --silent --show-error https://api.your-domain.com/health
```

Caddy 的 `reverse_proxy` 會處理 WebSocket upgrade。Backend 只有在 `TRUST_PROXY_HOPS=1` 時讀取 `X-Forwarded-For`；因為 port `8080` 沒有對公網開放，該 header 的可信邊界是本機 Caddy。

## Vercel 切流

Vercel build environment 必須設定：

```text
VITE_USE_EXTERNAL_API_BASE_URL=true
VITE_API_BASE_URL=https://api.your-domain.com
```

這些是 Vite build-time values，設定後必須重新部署 frontend。切流前依序驗證登入、HTTP API、SSE、realtime Voice WebSocket、duplex Voice WebSocket 與 recording upload。

Shadow validation 完成後：

1. 停止 Render 上的 recording worker。
2. 把 `/etc/kiwi/backend.env` 的 `RECORDING_WORKER_ENABLED` 改成 `true`。
3. 執行 `sudo systemctl reload kiwi-compose.service`。
4. 確認新 recording job 只被 EC2 worker 處理。

## Rollback

若 EC2 readiness、登入、Voice 或 recording 驗證失敗，先把 Vercel 的 `VITE_API_BASE_URL` 改回可用的舊 backend origin 並重新部署。不要同時啟用 Render 與 EC2 的 recording worker。保留 `/srv/kiwi/uploads` 與 database backup，直到切流與 rollback window 都完成。
