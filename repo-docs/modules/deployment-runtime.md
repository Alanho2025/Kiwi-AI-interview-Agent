# EC2 deployment runtime

這一層回答的是「frontend 流量如何到達 EC2 backend」，不是「有 Dockerfile 就代表已上線」。截至 2026-07-29，staging 已有一個完整的 `main` -> GitHub Actions -> AWS OIDC/SSM -> EC2 實例：[main CI run #30355476925](https://github.com/Alanho2025/Kiwi-AI-interview-Agent/actions/runs/30355476925) 的 CI gates 與 `Deploy EC2 staging` 都成功。Operator 也在 browser 實測 Vercel frontend 對 EC2 的 Match、Voice interview 與 Report output。這些是 staging flow 的實際證據；recording/retention worker cutover、rollback、backup/restore、instance recovery 與長期監控仍未驗證，不能宣稱 production release readiness。

## 流量與資料怎麼走

```text
Vercel frontend
  -> https://api.your-domain.com
  -> host Caddy
  -> 127.0.0.1:8080
  -> backend container
  -> PostgreSQL / MongoDB
  -> /srv/kiwi/uploads mounted at /app/uploads
```

Frontend 使用 build-time `VITE_API_BASE_URL` 建立 HTTP、SSE 與 WebSocket URL。兩份 Vercel config 都不再把 `/api/*` rewrite 到 Render，因此 cutover 會 fail closed：若 Vercel 沒有設定 external API origin，新 deployment 不會悄悄回到舊 Render backend。

## P0 邊界

| 邊界 | Local implementation | 仍需部署時確認 |
| --- | --- | --- |
| Container ingress | [Compose config](../../deploy/ec2/compose.yaml) 只發布 `127.0.0.1:8080` | EC2 Security Group 不可公開 `8080` |
| HTTPS 與 WebSocket | [Caddy config](../../deploy/ec2/Caddyfile) reverse proxy 到 loopback backend | staging HTTPS 與 browser Voice WebSocket 已驗證；certificate renewal、instance recovery 與長期連線行為仍待確認 |
| Browser CORS | [API composition](../../backend/src/api.js) 明確 allowlist origin 與 `X-Match-Request-Id` | staging live `OPTIONS /api/analyze/match/stream` 已對 Vercel origin 回傳該 header；其他 origin/header 組合未逐一驗證 |
| Secret | Compose 從 `/etc/kiwi/backend.env` 讀取，不把 secret 放進 repository | production values、file mode、operator access |
| Upload persistence | `/srv/kiwi/uploads` mount 到 `/app/uploads` | host UID/GID `1000` 可寫、backup 與 restore |
| Proxy client IP | [WebSocket security helper](../../backend/src/api/webSocketSecurity.js) 只在 `TRUST_PROXY_HOPS=1` 時讀 right-most valid `X-Forwarded-For` | backend 只能由 trusted local Caddy 進入 |
| Shutdown | [shutdown coordinator](../../backend/src/services/serverGracefulShutdownService.js) 停止 ingress、drain sockets/workers、關閉 databases，再 bounded exit | EC2 reboot、container update 與 active Voice session smoke |
| Worker cutover | recording/retention start helper 回傳可停止 instance，`stop()` 等待 active run | Shadow 時 recording worker off；Render worker 停止後才在 EC2 開啟 |
| Git push deployment | [CI workflow](../../.github/workflows/ci.yml) 只在 `main` 的 CI summary 成功後，以 GitHub OIDC 取得短期 role、用 SSM 指定 exact `github.sha` | 首次 successful main deploy 已完成；host 的 root SSH config 必須選用 read-only GitHub deploy key；rollback drill 仍未完成 |

## 一個代表 case

使用者透過 Vercel 開啟 Voice session 時，browser 會直接連到 `wss://api.your-domain.com`。Caddy 接收 upgrade、加入一層 forwarded client address，再把連線送到 loopback backend。當 `TRUST_PROXY_HOPS=1` 時，WebSocket limiter 以該 client address 分流；若同一個 spoofed header 直接送到未啟用 trusted proxy 的 backend，limiter 仍使用 socket address。部署更新送出 `SIGTERM` 後，backend 先停止新連線，再等待現有 WebSocket、recording/retention active run 與 database close；只有超過 timeout 才強制關閉。

## 本地驗證能證明什麼

[Server tests](../../backend/tests/robustness/server/serverGracefulShutdown.test.js) 覆蓋 clean shutdown、重複 signal 與 timeout force-close；[proxy tests](../../backend/tests/robustness/server/webSocketProxyAddress.test.js) 覆蓋 direct、trusted proxy、spoofed header 與 invalid forwarded value；recording/retention tests 覆蓋 worker instance 與 in-flight drain。

這些測試證明 local contract。外部證據再補上 [main CI run #30355476925](https://github.com/Alanho2025/Kiwi-AI-interview-Agent/actions/runs/30355476925) 的 exact-SHA SSM deploy、live Match preflight，以及 operator 的 Match、Voice interview、Report browser flow。這仍不證明 recording worker、retention worker、Render worker 停用、rollback、backup/restore 或 incident recovery。已取得 host 後的實際操作順序與 rollback 見 [EC2 第一版部署手冊](../../deploy/ec2/README.md)；要從 AWS Console 複製 VPC、EC2、EIP、SSM 與 GitHub OIDC，見 [可複製的 AWS Console 部署手冊](../../deploy/ec2/AWS_CONSOLE_SETUP.md)。

繼續讀 [驗證與保護層](validations-and-guards.md) 看入口安全門，或讀 [Voice recording](feature-recording.md) 看 recording worker 的資料生命週期。

证据状态：除特别标注外，本页基于当前源码已确认。
