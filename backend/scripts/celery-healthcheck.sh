#!/bin/sh
# فحص صحة عامل Celery — يرسل ping عبر الوسيط ويتوقع رد OK
set -e
celery -A config inspect ping --timeout=10 2>/dev/null | grep -q OK
