"""تحديث حالة الضيف بعد إرسال الدعوة."""

from __future__ import annotations

from apps.guests.models import Guest


def mark_guest_invitation_sent(guest: Guest) -> bool:
    """يُحدّث الحالة إلى «مدعو» بعد إرسال الدعوة بنجاح."""
    if guest.status not in (Guest.Status.PENDING, Guest.Status.INVITED):
        return False
    if guest.status == Guest.Status.INVITED:
        return False
    guest.status = Guest.Status.INVITED
    guest.save(update_fields=["status"])
    return True
