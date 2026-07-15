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
    guest.save(update_fields=["reminder_opted_in", "reminder_scheduled_for"])
    return guest


def deliver_guest_day_before_reminder(
    guest: Guest,
    *,
    force: bool = False,
) -> dict | None:
    """يرسل التذكير+QR عند الاستحقاق.

    - ``force=False``: يرسل مرة واحدة فقط إن حان الموعد ولم يُرسل سابقاً.
    - ``force=True``: يعيد الإرسال عند «نعم ذكرني» مجدداً طالما الحفل لم يبدأ
      والموعد المستحق حان (أقل من 24 ساعة متبقية).
    - إن بقي أكثر من 24 ساعة: يجدول فقط ولا يرسل قبل الأوان.
    """
    from apps.integrations.whatsapp_messages import send_guest_day_before_reminder

    if not (guest.phone or "").strip():
        return {"sent": False, "detail": "رقم غير متوفر", "deferred": False}

    schedule_guest_day_before_reminder(guest)
    guest.refresh_from_db()

    now = timezone.now()
    event_dt = event_aware_datetime(guest.event)
    if event_dt is None or now >= event_dt:
        return {
            "sent": False,
            "detail": "انتهى موعد المناسبة — لا يُرسل تذكير",
            "deferred": False,
        }

    due = guest.reminder_scheduled_for
    if due is None:
        return {"sent": False, "detail": "تعذّر جدولة التذكير", "deferred": False}

    # ما زال باكراً (أكثر من 24 ساعة على الحفل)
    if due > now:
        return {
            "sent": False,
            "detail": "مجدول قبل الموعد بـ 24 ساعة",
            "deferred": True,
            "scheduled_for": due,
        }

    # مستحق الآن — لا تُعد الإرسال التلقائي إن سبق بنجاح إلا مع force
    if guest.reminder_sent_at and not force:
        return {
            "sent": False,
            "detail": "سبق إرسال التذكير",
            "deferred": False,
            "already_sent": True,
        }

    outcome = send_guest_day_before_reminder(guest)
    if outcome.get("sent"):
        guest.reminder_sent_at = timezone.now()
        guest.save(update_fields=["reminder_sent_at"])
    result = dict(outcome)
    result["deferred"] = False
    return result
