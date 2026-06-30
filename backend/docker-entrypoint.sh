#!/bin/sh
set -e

echo "[مرحّاب] انتظار قاعدة البيانات..."
for i in $(seq 1 60); do
  if python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
" 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "[مرحّاب] تطبيق الترحيلات..."
python manage.py migrate --noinput

echo "[مرحّاب] جمع الملفات الثابتة..."
python manage.py collectstatic --noinput

if [ -n "${ADMIN_EMAIL:-}" ]; then
  python manage.py ensure_admin || true
fi

echo "[مرحّاب] تشغيل الخادم..."
exec "$@"
