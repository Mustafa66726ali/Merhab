#!/bin/sh
# مجدوِل التذكيرات التلقائية — يعمل داخل حاوية منفصلة في Docker
set -e
INTERVAL="${REMINDER_INTERVAL_SEC:-300}"
HEARTBEAT_FILE="/tmp/merhab-scheduler-heartbeat"

touch_heartbeat() {
  date +%s > "$HEARTBEAT_FILE"
}

echo "[مرحّاب] مجدوِل التذكيرات — كل ${INTERVAL}ث"
touch_heartbeat
sleep 30
while true; do
  python manage.py send_due_reminders || true
  touch_heartbeat
  sleep "$INTERVAL"
done
