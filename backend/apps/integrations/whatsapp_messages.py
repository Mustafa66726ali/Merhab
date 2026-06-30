"""رسائل واتساب المهيكلة للضيوف — ثلاثة أنواع:

1. **دعوة** — قالب Meta: ``event_invitation``
2. **تذكير** — قالب Meta: ``event_reminder``
3. **بطاقة QR** — صورة PNG مباشرة بعد تأكيد الحضور

في التطوير: البوت المحلي (نص + رابط منفصل / صورة base64).
في الإنتاج: قوالب Meta المعتمدة + صورة QR عبر Cloud API.
"""

from __future__ import annotations

from django.conf import settings

from apps.guests.models import Guest

from .whatsapp_send import (
    build_whatsapp_url,
    dispatch_whatsapp,
    has_active_whatsapp_credential,
    normalize_phone_digits,
    send_via_bot,
    send_via_bot_image,
    send_whatsapp_image,
    send_whatsapp_template,
    _active_cloud_credential,
)

# نصوص افتراضية للبوت (تحاكي قوالب Meta)
BOT_INVITATION_TEXT = (
    "مرحبا {name}\n"
    "دعوة لحضور مناسبة: {event}\n\n"
    "نحن سعداء بدعوتك لحضور:\n\n"
    " التاريخ: {date}\n"
    " الموقع: {venue}"
)

BOT_REMINDER_TEXT = (
    "تذكير\n"
    "مرحبا {name}\n"
    "مناسبة: {event}\n\n"
    "ستقام بتاريخ: {date}\n"
    "الموقع: {venue}"
)

BOT_QR_CAPTION = (
    "بطاقة دخولك 🎫\n"
    "احتفظ بهذا الرمز (QR) لعرضه عند الوصول."
)


def _provider_mode() -> str:
    return (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()


def _use_meta_templates() -> bool:
    """قوالب Meta تُستخدم فقط مع اعتماد Cloud API نشط (الإنتاج)."""
    if _provider_mode() == "manual":
        return False
    return bool(_active_cloud_credential())


def _invite_url(guest: Guest) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/i/{guest.public_token}"


def _event_datetime_label(guest: Guest) -> str:
    event = guest.event
    parts = []
    if event.date:
        parts.append(event.date.strftime("%Y-%m-%d"))
    if event.time:
        parts.append(event.time.strftime("%H:%M"))
    return " - ".join(parts) if parts else "—"


def guest_template_params(guest: Guest, invite_url: str | None = None) -> list[str]:
    """متغيرات القالب بالترتيب {{1}}..{{5}} لقوالب Meta."""
    event = guest.event
    return [
        guest.full_name or "ضيف",
        event.title or "مناسبة",
        _event_datetime_label(guest),
        event.venue or "—",
        invite_url or _invite_url(guest),
    ]


def _format_bot_text(template: str, guest: Guest, invite_url: str) -> str:
    name, event, date, venue, link = guest_template_params(guest, invite_url)
    return template.format(name=name, event=event, date=date, venue=venue, link=link)


def _template_names() -> dict[str, str]:
    cred = _active_cloud_credential()
    cfg = (cred.config if cred else {}) or {}
    return {
        "invitation": (
            cfg.get("template_invitation")
            or getattr(settings, "WHATSAPP_TEMPLATE_INVITATION", "event_invitation")
        ),
        "reminder": (
            cfg.get("template_reminder")
            or getattr(settings, "WHATSAPP_TEMPLATE_REMINDER", "event_reminder")
        ),
        "language": (
            cfg.get("template_language")
            or getattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "ar")
        ),
    }


def _qr_public_url(guest: Guest) -> str | None:
    if not guest.qr_code:
        return None
    try:
        path = guest.qr_code.url
    except ValueError:
        return None
    if path.startswith("http"):
        return path
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _bot_split_text_and_link(phone: str, text_body: str, invite_url: str) -> dict:
    """البوت: رسالة نصية ثم رابط منفصل قابل للنقر."""
    out_text = send_via_bot(phone, text_body)
    out_link = send_via_bot(phone, invite_url)
    sent = bool(out_text.get("sent")) and bool(out_link.get("sent"))
    detail = out_link.get("detail") or out_text.get("detail") or ""
    return {"sent": sent, "detail": detail, "queued": True}


def send_guest_invitation(
    guest: Guest,
    custom_body: str | None = None,
) -> dict:
    """إرسال دعوة الضيف (قالب ``event_invitation`` في الإنتاج)."""
    phone = guest.phone or ""
    invite_url = _invite_url(guest)
    fallback_url = build_whatsapp_url(phone, invite_url)

    if not normalize_phone_digits(phone):
        return {"sent": False, "whatsapp_url": fallback_url, "detail": "رقم غير متوفر"}

    if _use_meta_templates():
        names = _template_names()
        return send_whatsapp_template(
            phone,
            names["invitation"],
            guest_template_params(guest, invite_url),
            language=names["language"],
            fallback_url=fallback_url,
        )

    if _provider_mode() == "bot":
        if custom_body and "{link}" in custom_body:
            text_body = custom_body.replace("{link}", "").rstrip()
        elif custom_body:
            text_body = custom_body.rstrip()
        else:
            text_body = _format_bot_text(BOT_INVITATION_TEXT, guest, invite_url)
        return _bot_split_text_and_link(phone, text_body, invite_url)

    if has_active_whatsapp_credential():
        text = custom_body or _format_bot_text(BOT_INVITATION_TEXT, guest, invite_url)
        text = f"{text}\n\n{invite_url}"
        return dispatch_whatsapp(phone, text)

    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": "وضع يدوي — افتح رابط واتساب",
    }


def send_guest_reminder(
    guest: Guest,
    custom_body: str | None = None,
) -> dict:
    """إرسال تذكير الضيف (قالب ``event_reminder`` في الإنتاج)."""
    phone = guest.phone or ""
    invite_url = _invite_url(guest)
    fallback_url = build_whatsapp_url(phone, invite_url)

    if not normalize_phone_digits(phone):
        return {"sent": False, "whatsapp_url": fallback_url, "detail": "رقم غير متوفر"}

    if _use_meta_templates():
        names = _template_names()
        return send_whatsapp_template(
            phone,
            names["reminder"],
            guest_template_params(guest, invite_url),
            language=names["language"],
            fallback_url=fallback_url,
        )

    if _provider_mode() == "bot":
        if custom_body and "{link}" in custom_body:
            text_body = custom_body.replace("{link}", "").rstrip()
        elif custom_body:
            text_body = custom_body.rstrip()
        else:
            text_body = _format_bot_text(BOT_REMINDER_TEXT, guest, invite_url)
        return _bot_split_text_and_link(phone, text_body, invite_url)

    if has_active_whatsapp_credential():
        text = custom_body or _format_bot_text(BOT_REMINDER_TEXT, guest, invite_url)
        text = f"{text}\n\n{invite_url}"
        return dispatch_whatsapp(phone, text)

    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": "وضع يدوي — افتح رابط واتساب",
    }


def send_guest_qr(guest: Guest) -> dict:
    """إرسال صورة QR (PNG) مباشرة بعد تأكيد الحضور."""
    from apps.guests.qr_utils import build_guest_qr_png, ensure_guest_qr

    phone = guest.phone or ""
    fallback_url = build_whatsapp_url(phone, "")

    if not normalize_phone_digits(phone):
        return {"sent": False, "detail": "رقم غير متوفر"}

    ensure_guest_qr(guest)
    guest.refresh_from_db()
    png_bytes = build_guest_qr_png(guest.public_token)
    image_url = _qr_public_url(guest)
    caption = BOT_QR_CAPTION

    if _use_meta_templates() and image_url:
        return send_whatsapp_image(
            phone,
            image_url=image_url,
            caption=caption,
            fallback_url=fallback_url,
        )

    if _provider_mode() == "bot":
        return send_via_bot_image(phone, png_bytes, caption=caption)

    if has_active_whatsapp_credential() and image_url:
        return send_whatsapp_image(
            phone,
            image_url=image_url,
            caption=caption,
            fallback_url=fallback_url,
        )

    return {"sent": False, "detail": "لم يُكوَّن مزوّد إرسال للصورة"}
