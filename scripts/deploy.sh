#!/usr/bin/env bash
# نشر يدوي من السيرفر (بديل لـ GitHub Actions)
set -euo pipefail

APP_DIR="${DEPLOY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
mkdir -p "$BACKUP_DIR"

echo "==> نسخة احتياطية لقاعدة البيانات"
docker compose exec -T db pg_dump -U merhab merhab > \
  "$BACKUP_DIR/backup_$(date +%F_%H-%M).sql"

echo "==> git pull"
git fetch origin
git reset --hard origin/main

echo "==> docker compose build & up"
docker compose build
docker compose up -d --remove-orphans

echo "==> migrations & static"
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py check

docker image prune -f
docker compose ps

echo "==> تم النشر بنجاح"
