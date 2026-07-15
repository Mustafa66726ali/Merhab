"""تأكيد/اعتذار الضيف — مشترك بين صفحة الدعوة وردود واتساب."""

from __future__ import annotations

from django.utils import timezone

from apps.guests.models import Guest
from apps.guests.reminder_schedule import deliver_guest_day_before_reminder


def apply_guest_rsvp(
    guest: Guest,
    *,
    confirm: bool,
    defer_qr: bool = True,
    force_reminder_delivery: bool = False,
) -> Guest:
    """يُحدّث حالة الضيف.

    عند التأكيد مع ``defer_qr=True`` (الافتراضي): يُؤكَّد الحضور ويُجدول
    التذكير+QR قبل المناسبة بيوم — ويُرسل فوراً إن حان الموعد.
    ``force_reminder_delivery`` يعيد الإرسال عند تأكيد متكرر (نعم ذكرني).
    """
    if guest.status in (Guest.Status.ATTENDED, Guest.Status.SEATED):
        return guest

    guest.responded_at = timezone.now()
    if confirm:
        guest.status = Guest.Status.CONFIRMED
        guest.save(update_fields=["status", "responded_at"])
        from apps.guests.qr_utils import ensure_guest_qr

        ensure_guest_qr(guest)
        guest.refresh_from_db()

        if defer_qr:
            deliver_guest_day_before_reminder(
                guest, force=force_reminder_delivery
            )
            guest.refresh_from_db()
        elif guest.phone:
            from apps.integrations.whatsapp_messages import send_guest_qr

            send_guest_qr(guest)
    else:
        guest.status = Guest.Status.DECLINED
        guest.reminder_opted_in = False
        guest.reminder_scheduled_for = None
        guest.save(
            update_fields=[
                "status",
                "responded_at",
                "reminder_opted_in",
                "reminder_scheduled_for",
            ]
        )

    from apps.platforms.notification_service import notify_rsvp_response

    notify_rsvp_response(
        guest.event,
        guest.full_name,
        confirmed=confirm,
    )
    return guest
