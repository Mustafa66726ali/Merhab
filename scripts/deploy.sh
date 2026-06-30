#!/usr/bin/env bash
# نشر يدوي من السيرفر (بديل لـ GitHub Actions)
set -euo pipefail

APP_DIR="${DEPLOY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

echo "==> git pull"
git pull --ff-only

echo "==> docker compose up"
docker compose build
docker compose up -d --remove-orphans
docker image prune -f

docker compose ps
