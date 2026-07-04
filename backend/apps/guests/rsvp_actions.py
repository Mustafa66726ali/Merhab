"""تأكيد/اعتذار الضيف — مشترك بين صفحة الدعوة وردود واتساب."""

from __future__ import annotations

from django.utils import timezone

from apps.guests.models import Guest


def apply_guest_rsvp(guest: Guest, *, confirm: bool) -> Guest:
    """يُحدّث حالة الضيف ويُرسل QR عند التأكيد."""
    if guest.status in (Guest.Status.ATTENDED, Guest.Status.SEATED):
        return guest

    guest.responded_at = timezone.now()
    if confirm:
        guest.status = Guest.Status.CONFIRMED
        guest.save(update_fields=["status", "responded_at"])
        from apps.guests.qr_utils import ensure_guest_qr
        from apps.integrations.whatsapp_messages import send_guest_qr

        ensure_guest_qr(guest)
        guest.refresh_from_db()
        if guest.phone:
            send_guest_qr(guest)
    else:
        guest.status = Guest.Status.DECLINED
        guest.save(update_fields=["status", "responded_at"])

    from apps.platforms.notification_service import notify_rsvp_response

    notify_rsvp_response(
        guest.event,
        guest.full_name,
        confirmed=confirm,
    )
    return guest
