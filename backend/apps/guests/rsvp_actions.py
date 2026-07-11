"""تأكيد/اعتذار الضيف — مشترك بين صفحة الدعوة وردود واتساب."""

from __future__ import annotations

from django.utils import timezone

from apps.guests.models import Guest
from apps.guests.reminder_schedule import schedule_guest_day_before_reminder


def apply_guest_rsvp(
    guest: Guest,
    *,
    confirm: bool,
    defer_qr: bool = True,
) -> Guest:
    """يُحدّث حالة الضيف.

    عند التأكيد مع ``defer_qr=True`` (الافتراضي): يُؤكَّد الحضور ويُجدول
    التذكير+QR قبل المناسبة بيوم — دون إرسال QR فوراً.
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
            schedule_guest_day_before_reminder(guest)
            guest.refresh_from_db()
            # إن بقي أقل من يوم على المناسبة — أرسل التذكير+QR في أقرب وقت (فوراً)
            due = guest.reminder_scheduled_for
            if (
                guest.phone
                and due is not None
                and due <= timezone.now()
                and guest.reminder_sent_at is None
            ):
                from apps.integrations.whatsapp_messages import (
                    send_guest_day_before_reminder,
                )

                outcome = send_guest_day_before_reminder(guest)
                if outcome.get("sent"):
                    guest.reminder_sent_at = timezone.now()
                    guest.save(update_fields=["reminder_sent_at"])
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
