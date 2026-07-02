#!/usr/bin/env bash
# إعداد أولي للسيرفر (Ubuntu/Debian) — يُشغَّل مرة واحدة كـ root أو sudo
set -euo pipefail

APP_DIR="${1:-/opt/merhab}"
REPO_URL="${2:-https://github.com/Mustafa66726ali/Merhab.git}"

echo "==> تثبيت Docker و Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

echo "==> إنشاء مجلد التطبيق: $APP_DIR"
mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "المستودع موجود مسبقاً — تخطّي الاستنساخ"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  عدّل ملف .env قبل التشغيل:"
  echo "   nano $APP_DIR/.env"
  echo ""
fi

echo "==> بناء وتشغيل المشروع..."
docker compose build
docker compose up -d

echo ""
echo "✅ تم الإعداد. الموقع يعمل على المنفذ المحدّد في HTTP_PORT (افتراضي 80)."
echo "   لإضافة النشر التلقائي: اضبط أسرار GitHub Actions (SERVER_HOST, SERVER_USER, SERVER_SSH_KEY, DEPLOY_PATH)."
