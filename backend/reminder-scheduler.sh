#!/bin/sh
# مجدوِل التذكيرات التلقائية — يعمل داخل حاوية منفصلة في Docker
set -e
INTERVAL="${REMINDER_INTERVAL_SEC:-300}"
echo "[مرحّاب] مجدوِل التذكيرات — كل ${INTERVAL}ث"
sleep 30
while true; do
  python manage.py send_due_reminders || true
  sleep "$INTERVAL"
done
