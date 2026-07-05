#!/bin/sh
# فحص صحة مجدول التذكيرات — يتحقق من نبض حيّ حديث
set -e

HEARTBEAT_FILE="/tmp/merhab-scheduler-heartbeat"
INTERVAL="${REMINDER_INTERVAL_SEC:-300}"
# هامش: دورتان كاملتان + 3 دقائق (لتغطية send_due_reminders البطيء)
MAX_AGE=$((INTERVAL * 2 + 180))

if [ ! -f "$HEARTBEAT_FILE" ]; then
  exit 1
fi

NOW=$(date +%s)
LAST=$(cat "$HEARTBEAT_FILE")
if [ $((NOW - LAST)) -gt "$MAX_AGE" ]; then
  exit 1
fi

exit 0
