"""معالجة ردود واتساب الواردة (أزرار / نعم / لا)."""

from __future__ import annotations

import logging

from apps.guests.models import Guest
from apps.guests.rsvp_actions import apply_guest_rsvp

from .whatsapp_invitation import normalize_rsvp_reply, parse_rsvp_button_id
from .whatsapp_send import normalize_phone_digits

logger = logging.getLogger(__name__)


def _guest_by_token(token: str) -> Guest | None:
    return (
        Guest.objects.select_related("event")
        .filter(public_token=token)
        .first()
    )


def _guest_by_phone(phone: str) -> Guest | None:
    digits = normalize_phone_digits(phone)
    if not digits:
        return None
    suffix = digits[-9:] if len(digits) >= 9 else digits
    for guest in Guest.objects.select_related("event").order_by("-created_at")[:200]:
        g_digits = normalize_phone_digits(guest.phone or "")
        if g_digits and (g_digits == digits or g_digits.endswith(suffix) or digits.endswith(g_digits[-9:])):
            return guest
    return None


def handle_rsvp_inbound(
    *,
    phone: str = "",
    button_id: str = "",
    text: str = "",
    public_token: str = "",
) -> dict:
    """يُعالج RSVP من زر أو نص أو token مباشر."""
    confirm: bool | None = None
    token = (public_token or "").strip()

    if button_id:
        parsed = parse_rsvp_button_id(button_id)
        if parsed:
            confirm, token = parsed

    if confirm is None and text:
        confirm = normalize_rsvp_reply(text)

    guest = None
    if token:
        guest = _guest_by_token(token)
    elif phone:
        guest = _guest_by_phone(phone)

    if not guest:
        return {"ok": False, "detail": "ضيف غير معروف"}

    if confirm is None:
        return {"ok": False, "detail": "رد غير مفهوم — استخدم نعم أو لا"}

    if guest.status in (Guest.Status.ATTENDED, Guest.Status.SEATED):
        return {"ok": True, "detail": "حضور مسجّل مسبقاً", "status": guest.status}

    if confirm and guest.status == Guest.Status.CONFIRMED:
        from apps.integrations.whatsapp_messages import send_guest_qr

        send_guest_qr(guest)
        return {
            "ok": True,
            "detail": "تم إعادة إرسال بطاقة الدخول",
            "status": guest.status,
            "action": "confirmed",
        }

    apply_guest_rsvp(guest, confirm=confirm)
    guest.refresh_from_db()
    action = "confirmed" if confirm else "declined"
    logger.info("RSVP via WhatsApp: guest=%s action=%s", guest.id, action)

    if guest.phone and not confirm:
        from .whatsapp_send import dispatch_whatsapp

        dispatch_whatsapp(
            guest.phone,
            "تم تسجيل اعتذارك. نأمل رؤيتك في مناسبة قادمة.",
        )

    return {
        "ok": True,
        "detail": "تم تأكيد حضورك" if confirm else "تم تسجيل اعتذارك",
        "status": guest.status,
        "action": action,
    }
