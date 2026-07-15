"""معالجة ردود واتساب الواردة (تذكير مسبق / نعم / لا)."""

from __future__ import annotations

import logging

from apps.guests.models import Guest
from apps.guests.reminder_schedule import deliver_guest_day_before_reminder
from apps.guests.rsvp_actions import apply_guest_rsvp

from .whatsapp_invitation import (
    normalize_rsvp_reply,
    parse_remind_button_id,
    parse_rsvp_button_id,
)
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
        if g_digits and (
            g_digits == digits
            or g_digits.endswith(suffix)
            or digits.endswith(g_digits[-9:])
        ):
            return guest
    return None


def _confirm_delivery_detail(outcome: dict | None, *, already_confirmed: bool) -> str:
    if outcome is None:
        return (
            "تم تأكيد حضورك مسبقاً — سيصلك التذكير ورمز الدخول قبل الموعد بيوم"
            if already_confirmed
            else "تم تأكيد حضورك"
        )
    if outcome.get("sent"):
        return "تم تأكيد حضورك — أُرسل التذكير ورمز الدخول"
    if outcome.get("deferred"):
        return "تم تأكيد حضورك — سيصلك التذكير ورمز الدخول قبل الموعد بيوم"
    if outcome.get("already_sent"):
        return "تم تأكيد حضورك — سبق إرسال التذكير ورمز الدخول"
    err = (outcome.get("detail") or "").strip()
    if err:
        return f"تم تأكيد حضورك — تعذّر إرسال التذكير الآن: {err}"
    return "تم تأكيد حضورك"


def handle_rsvp_inbound(
    *,
    phone: str = "",
    button_id: str = "",
    text: str = "",
    public_token: str = "",
) -> dict:
    """يُعالج رد التذكير المسبق أو RSVP من زر أو نص."""
    confirm: bool | None = None
    token = (public_token or "").strip()
    from_remind = False

    if button_id:
        parsed_remind = parse_remind_button_id(button_id)
        if parsed_remind:
            confirm, token = parsed_remind
            from_remind = True
        else:
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
        return {"ok": False, "detail": "رد غير مفهوم — استخدم نعم ذكرني أو لا"}

    if guest.status in (Guest.Status.ATTENDED, Guest.Status.SEATED):
        return {"ok": True, "detail": "حضور مسجّل مسبقاً", "status": guest.status}

    # مؤكّد مسبقاً + نعم ذكرني: أعد الجدولة وأرسل فوراً إن حان الموعد (force)
    if confirm and guest.status == Guest.Status.CONFIRMED:
        from apps.guests.qr_utils import ensure_guest_qr

        ensure_guest_qr(guest)
        guest.refresh_from_db()
        # force=True: كل ضغطة «نعم ذكرني» تعيد الإرسال إن بقي أقل من 24 ساعة
        outcome = deliver_guest_day_before_reminder(guest, force=True)
        guest.refresh_from_db()
        detail = _confirm_delivery_detail(outcome, already_confirmed=True)
        logger.info(
            "RSVP via WhatsApp (already confirmed): guest=%s from_remind=%s outcome=%s",
            guest.id,
            from_remind,
            (outcome or {}).get("detail") or (outcome or {}).get("sent"),
        )
        return {
            "ok": True,
            "detail": detail,
            "status": guest.status,
            "action": "confirmed",
            "reminder_sent": bool(outcome and outcome.get("sent")),
            "reminder_deferred": bool(outcome and outcome.get("deferred")),
        }

    # تأكيد أول / اعتذار — force عند نعم ذكرني حتى لو أُعيد بعد اعتذار
    apply_guest_rsvp(
        guest,
        confirm=confirm,
        defer_qr=True,
        force_reminder_delivery=bool(confirm and from_remind),
    )
    guest.refresh_from_db()
    action = "confirmed" if confirm else "declined"
    logger.info(
        "RSVP via WhatsApp: guest=%s action=%s from_remind=%s",
        guest.id,
        action,
        from_remind,
    )

    if guest.phone and not confirm:
        from .whatsapp_send import dispatch_whatsapp

        dispatch_whatsapp(
            guest.phone,
            "تم تسجيل اعتذارك. نأمل رؤيتك في مناسبة قادمة.",
        )

    if confirm:
        if guest.reminder_sent_at:
            detail = "تم تأكيد حضورك — أُرسل التذكير ورمز الدخول"
        elif guest.reminder_scheduled_for:
            detail = "تم تأكيد حضورك — سيصلك تذكير ورمز الدخول قبل الموعد بيوم"
        else:
            detail = "تم تأكيد حضورك"
    else:
        detail = "تم تسجيل اعتذارك"

    return {
        "ok": True,
        "detail": detail,
        "status": guest.status,
        "action": action,
    }
