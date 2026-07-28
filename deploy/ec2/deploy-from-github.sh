#!/usr/bin/env bash

set -euo pipefail

readonly APP_ROOT=/opt/kiwi
readonly COMPOSE_FILE="$APP_ROOT/deploy/ec2/compose.yaml"
readonly ENV_FILE=/etc/kiwi/backend.env
readonly SERVICE_NAME=kiwi-compose.service
readonly READINESS_URL=http://127.0.0.1:8080/api/health
readonly DEPLOYED_SHA="${1:?Usage: deploy-from-github.sh <commit-sha>}"

if ! [[ "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Deployment commit must be a 40-character SHA." >&2
  exit 1
fi

cd "$APP_ROOT"

if [ "$(git branch --show-current)" != "main" ]; then
  echo "Refusing deployment because /opt/kiwi is not on main." >&2
  exit 1
fi

if [ "$(git rev-parse HEAD)" != "$DEPLOYED_SHA" ]; then
  echo "Refusing deployment because the checked-out commit does not match the requested SHA." >&2
  exit 1
fi

if grep -qE 'postgres-host|mongo-host|your-frontend|replace-with|user:password' "$ENV_FILE"; then
  echo "Refusing deployment because $ENV_FILE still contains example values." >&2
  exit 1
fi

export KIWI_BACKEND_ENV_FILE="$ENV_FILE"

docker compose -f "$COMPOSE_FILE" config --quiet
install -m 0644 "$APP_ROOT/deploy/ec2/kiwi-compose.service" "/etc/systemd/system/$SERVICE_NAME"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

if systemctl is-active --quiet "$SERVICE_NAME"; then
  systemctl reload "$SERVICE_NAME"
else
  systemctl start "$SERVICE_NAME"
fi

for attempt in {1..30}; do
  if curl --fail --silent --show-error "$READINESS_URL"; then
    echo "EC2 deployment is ready at commit $DEPLOYED_SHA."
    exit 0
  fi

  sleep 2
done

echo "EC2 deployment did not become ready within 60 seconds." >&2
systemctl status "$SERVICE_NAME" --no-pager --full >&2 || true
exit 1
