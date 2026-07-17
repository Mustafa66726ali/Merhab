"""إرسال تذكير يدوي من شاشة الدعوات — بترتيب واضح وبدون تكدس."""

from __future__ import annotations

import logging
import time

from django.conf import settings
from django.utils import timezone

from apps.guests.models import Guest
from apps.guests.reminder_schedule import event_aware_datetime
from apps.integrations.whatsapp_messages import send_guest_invitation, send_guest_qr_direct
from apps.integrations.whatsapp_send import build_whatsapp_url

from .models import Invitation

logger = logging.getLogger(__name__)

BATCH_DELAY_SEC = float(getattr(settings, "WHATSAPP_BATCH_DELAY_SEC", 1.2))


def classify_guest_remind_bucket(guest: Guest) -> str:
    """تصنيف الضيف لدفعة التذكير اليدوية."""
    if guest.status == Guest.Status.DECLINED:
        return "skip"
    if guest.reminder_opted_in:
        return "opted_in"
    return "no_optin"


def format_time_until_event(event) -> str:
    """نص عربي لما تبقى على بدء المناسبة."""
    event_dt = event_aware_datetime(event)
    if not event_dt:
        return ""
    now = timezone.now()
    if now >= event_dt:
        return "المناسبة بدأت أو انتهى موعدها."
    total_secs = int((event_dt - now).total_seconds())
    days, rem = divmod(total_secs, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    parts: list[str] = []
    if days:
        parts.append(f"{days} يوم")
    if hours:
        parts.append(f"{hours} ساعة")
    if minutes and not days:
        parts.append(f"{minutes} دقيقة")
    if not parts:
        parts.append("أقل من دقيقة")
    return "يتبقى على بدء المناسبة: " + " و ".join(parts)


def _countdown_message(guest: Guest) -> str:
    name = (guest.full_name or "ضيف").strip()
    countdown = format_time_until_event(guest.event)
    lines = [f"مرحباً {name}"]
    if countdown:
        lines.append(countdown)
    lines.append("هذا رمز الدخول الخاص بكم:")
    return "\n".join(lines)


def _record_invitation(event, guest, *, subject: str, body: str, sent: bool) -> None:
    Invitation.objects.create(
        event=event,
        guest=guest,
        method=Invitation.Method.WHATSAPP,
        status=Invitation.Status.SENT if sent else Invitation.Status.FAILED,
        subject=subject,
        message=body,
        sent_at=timezone.now() if sent else None,
    )


def _result_row(
    event,
    guest: Guest,
    *,
    kind: str,
    sent: bool,
    detail: str,
    message: str,
    auto: bool,
) -> dict:
    invite_url = f"{settings.FRONTEND_URL}/i/{guest.public_token}"
    return {
        "guest_id": guest.id,
        "full_name": guest.full_name,
        "phone": guest.phone,
        "status": guest.status,
        "kind": kind,
        "invite_url": invite_url,
        "message": message,
        "auto": auto,
        "sent": sent,
        "detail": detail,
        "whatsapp_url": build_whatsapp_url(guest.phone, message) if guest.phone else None,
    }


def _send_no_optin_guest(event, guest: Guest, *, auto: bool) -> dict:
    """لم يختر نعم/لا — إعادة الدعوة + قالب التذكير المسبق."""
    subject = f"تذكير — {event.invitation_title or event.title}"
    preview = (
        f"دعوة + تذكير مسبق (نعم ذكرني / لا اعتذر) — {guest.full_name}"
    )

    if not auto:
        return _result_row(
            event,
            guest,
            kind="no_optin",
            sent=False,
            detail="وضع يدوي — فعّل الإرسال التلقائي أو استخدم مزوّداً رسمياً",
            message=preview,
            auto=auto,
        )

    if not (guest.phone or "").strip():
        row = _result_row(
            event,
            guest,
            kind="no_optin",
            sent=False,
            detail="رقم غير متوفر",
            message=preview,
            auto=auto,
        )
        _record_invitation(event, guest, subject=subject, body=preview, sent=False)
        return row

    outcome = send_guest_invitation(guest)
    sent = bool(outcome.get("sent"))
    detail = outcome.get("detail", "")
    row = _result_row(
        event,
        guest,
        kind="no_optin",
        sent=sent,
        detail=detail,
        message=preview,
        auto=auto,
    )
    _record_invitation(event, guest, subject=subject, body=preview, sent=sent)
    return row


def _send_opted_in_guest(event, guest: Guest, *, auto: bool) -> dict:
    """من اختار نعم ذكرني — العدّاد + QR مباشرة بدون قالب."""
    subject = f"رمز الدخول — {event.invitation_title or event.title}"
    countdown = _countdown_message(guest)

    if not auto:
        return _result_row(
            event,
            guest,
            kind="opted_in",
            sent=False,
            detail="وضع يدوي — فعّل الإرسال التلقائي أو استخدم مزوّداً رسمياً",
            message=countdown,
            auto=auto,
        )

    if not (guest.phone or "").strip():
        row = _result_row(
            event,
            guest,
            kind="opted_in",
            sent=False,
            detail="رقم غير متوفر",
            message=countdown,
            auto=auto,
        )
        _record_invitation(event, guest, subject=subject, body=countdown, sent=False)
        return row

    outcome = send_guest_qr_direct(guest, preamble=countdown)
    sent = bool(outcome.get("sent"))
    detail = outcome.get("detail", "")
    row = _result_row(
        event,
        guest,
        kind="opted_in",
        sent=sent,
        detail=detail,
        message=countdown,
        auto=auto,
    )
    _record_invitation(event, guest, subject=subject, body=countdown, sent=sent)
    return row


def process_manual_remind_batch(event, guests_qs, *, auto: bool) -> tuple[list[dict], int, int]:
    """تذكير يدوي مرتّب: أولاً من لم يختر، ثم من اختار نعم ذكرني."""
    no_optin: list[Guest] = []
    opted_in: list[Guest] = []
    skipped = 0

    for guest in guests_qs.order_by("id"):
        bucket = classify_guest_remind_bucket(guest)
        if bucket == "skip":
            skipped += 1
        elif bucket == "no_optin":
            no_optin.append(guest)
        else:
            opted_in.append(guest)

    results: list[dict] = []
    sent_count = 0
    ordered = [(g, "no_optin") for g in no_optin] + [(g, "opted_in") for g in opted_in]

    for index, (guest, kind) in enumerate(ordered):
        if kind == "no_optin":
            row = _send_no_optin_guest(event, guest, auto=auto)
        else:
            row = _send_opted_in_guest(event, guest, auto=auto)
        results.append(row)
        if row.get("sent"):
            sent_count += 1
        if auto and index < len(ordered) - 1:
            time.sleep(BATCH_DELAY_SEC)

    logger.info(
        "manual remind batch event=%s auto=%s no_optin=%s opted_in=%s skipped=%s sent=%s",
        event.id,
        auto,
        len(no_optin),
        len(opted_in),
        skipped,
        sent_count,
    )
    return results, skipped, sent_count
