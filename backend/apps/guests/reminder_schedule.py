"""جدولة تذكير الضيف قبل المناسبة بيوم (+ QR)."""

from __future__ import annotations

from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from apps.guests.models import Guest


def event_aware_datetime(event) -> datetime | None:
    """يجمع تاريخ ووقت الفعالية كـ datetime واعٍ للمنطقة الزمنية."""
    if not event or not event.date or not event.time:
        return None
    naive = datetime.combine(event.date, event.time)
    if settings.USE_TZ:
        return timezone.make_aware(naive, timezone.get_current_timezone())
    return naive


def compute_reminder_scheduled_for(event, *, now=None) -> datetime | None:
    """قبل المناسبة بـ 24 ساعة، أو أقرب وقت متاح إن بقي أقل من يوم.

    لا يُجدول بعد بدء المناسبة.
    """
    now = now or timezone.now()
    event_dt = event_aware_datetime(event)
    if event_dt is None or now >= event_dt:
        return None
    send_at = event_dt - timedelta(hours=24)
    if send_at <= now:
        return now
    return send_at


def schedule_guest_day_before_reminder(guest: Guest) -> Guest:
    """يؤكد جدولة التذكير+QR للضيف المؤكّد."""
    send_at = compute_reminder_scheduled_for(guest.event)
    guest.reminder_opted_in = True
    guest.reminder_scheduled_for = send_at
    # إن أُرسل سابقاً وأُعيد التأكيد — اسمح بإعادة الجدولة فقط إن لم يُرسل
    update = ["reminder_opted_in", "reminder_scheduled_for"]
    if guest.reminder_sent_at and send_at and send_at > timezone.now():
        # لا تمسح reminder_sent_at إن سبق الإرسال
        pass
    guest.save(update_fields=update)
    return guest
