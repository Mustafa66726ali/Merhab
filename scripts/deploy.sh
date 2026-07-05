#!/usr/bin/env bash
# نشر يدوي من السيرفر (بديل لـ GitHub Actions)
set -euo pipefail

APP_DIR="${DEPLOY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: ملف .env غير موجود — انسخ .env.example وعدّل DB_NAME و DB_PASSWORD"
  exit 1
fi

# تحميل متغيرات .env للنسخ الاحتياطي
set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
mkdir -p "$BACKUP_DIR"

DB_NAME="${DB_NAME:-merhab}"
DB_USER="${DB_USER:-merhab}"

echo "==> نسخة احتياطية PostgreSQL"
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > \
  "$BACKUP_DIR/backup_$(date +%F_%H-%M).sql"

echo "==> git pull"
git fetch origin
git reset --hard origin/main

echo "==> docker compose build & up"
docker compose build
docker compose up -d --remove-orphans

echo "==> التحقق من قاعدة البيانات (يجب PostgreSQL على السيرفر)"
docker compose exec backend python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.conf import settings
engine = settings.DATABASES['default']['ENGINE']
name = settings.DATABASES['default'].get('NAME', '')
print(f'[DB] engine={engine} name={name}')
if 'postgresql' not in engine:
    raise SystemExit(
        'ERROR: السيرفر يستخدم SQLite — تأكد من DB_NAME=merhab في .env '
        'وأعد تشغيل: docker compose up -d --force-recreate backend celery scheduler'
    )
"

echo "==> migrations & static"
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py check

docker image prune -f
docker compose ps

echo "==> تم النشر بنجاح"
