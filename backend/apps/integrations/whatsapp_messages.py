"""رسائل واتساب المهيكلة للضيوف:

1. **دعوة (Twilio النمط الوحيد عند تفعيل Twilio)** —
   بطاقة دعوة ثم تذكير مسبق (نعم ذكرني / لا اعتذر)
2. **تذكير قبل الموعد بيوم** — بطاقة تفاصيل ثم صورة QR
3. **تذكير يدوي مؤكّد** — رسالة نصية + رابط (بدون قالب؛ من شاشة التذكير)
4. **بطاقة QR** — صورة PNG (بعد التأكيد المجدول)
"""

from __future__ import annotations

import logging

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
    send_twilio_content_template,
    _active_cloud_credential,
    _active_twilio_credential,
)

logger = logging.getLogger(__name__)

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
    "رمز QR الخاص بكم\n"
    "فضلا تأكد من حفظ الصورة في جهازك لإبرازها عند الدخول"
)


def _provider_mode() -> str:
    return (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()


def _use_meta_templates() -> bool:
    """قوالب Meta عبر Cloud API."""
    if _provider_mode() == "manual":
        return False
    return bool(_active_cloud_credential())


def _use_twilio_templates() -> bool:
    """قوالب عبر Twilio ContentSid (بديل Cloud API)."""
    if _provider_mode() == "manual":
        return False
    if _active_cloud_credential():
        return False
    cred = _active_twilio_credential()
    if not cred:
        return False
    cfg = (cred.config or {}) if cred else {}
    return bool(
        cfg.get("content_card")
        or cfg.get("content_invitation")
        or cfg.get("content_reminder_optin")
        or cfg.get("content_reminder")
        or cfg.get("content_qr")
        or cfg.get("content_broadcast")
        or cfg.get("content_broadcast_watch")
    )


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


def guest_qr_template_params(guest: Guest) -> list[str]:
    """متغيرات قالب rsvp_qr: {{1}} اسم الضيف، {{2}} اسم المناسبة."""
    event = guest.event
    return [
        guest.full_name or "ضيف",
        event.title or "مناسبة",
    ]


def _twilio_template_variables(params: list[str]) -> dict[str, str]:
    return {str(i + 1): str(v) for i, v in enumerate(params)}


def _template_names() -> dict[str, str]:
    cred = _active_cloud_credential()
    twilio = _active_twilio_credential()
    cfg = (cred.config if cred else {}) or {}
    tw_cfg = (twilio.config if twilio else {}) or {}
    return {
        "invitation": (
            cfg.get("template_invitation")
            or getattr(settings, "WHATSAPP_TEMPLATE_INVITATION", "event_invitation")
        ),
        "reminder": (
            cfg.get("template_reminder")
            or getattr(settings, "WHATSAPP_TEMPLATE_REMINDER", "event_reminder")
        ),
        "qr": (
            cfg.get("template_qr")
            or getattr(settings, "WHATSAPP_TEMPLATE_QR", "rsvp_qr")
        ),
        "language": (
            cfg.get("template_language")
            or getattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "ar")
        ),
        "twilio_invitation": tw_cfg.get("content_card")
        or tw_cfg.get("content_invitation", ""),
        "twilio_reminder_optin": tw_cfg.get("content_reminder_optin", ""),
        "twilio_reminder": tw_cfg.get("content_reminder", ""),
        "twilio_qr": tw_cfg.get("content_qr", ""),
    }


def _qr_public_url(guest: Guest) -> str | None:
    """رابط عام مطلق لصورة QR — يجب أن يجلبه Twilio/Meta عبر HTTPS."""
    token = guest.public_token
    if not token:
        return None
    base = (
        getattr(settings, "PUBLIC_BASE_URL", None)
        or getattr(settings, "FRONTEND_URL", "")
        or ""
    ).rstrip("/")
    if not base:
        return None
    # مسار API عام يُرجع PNG مباشرة (موثوق أكثر من /media عبر FRONTEND فقط)
    return f"{base}/api/v1/public/invitation/{token}/qr.png"


def _bot_url_configured() -> bool:
    return bool((getattr(settings, "WHATSAPP_BOT_URL", "") or "").strip())


def _build_reminder_body(
    guest: Guest,
    custom_body: str | None,
    invite_url: str,
) -> str:
    if custom_body and "{link}" in custom_body:
        return custom_body.replace("{link}", "").rstrip()
    if custom_body:
        return custom_body.rstrip()
    return _format_bot_text(BOT_REMINDER_TEXT, guest, invite_url)


def _bot_send_reminder(phone: str, text_body: str, invite_url: str) -> dict:
    """البوت: رسالة واحدة (نص + رابط) — أكثر موثوقية من رسالتين منفصلتين."""
    text = (text_body or "").strip()
    if invite_url and invite_url not in text:
        text = f"{text}\n\n{invite_url}"
    if not text.strip():
        return {"sent": False, "detail": "نص التذكير فارغ"}
    out = send_via_bot(phone, text)
    out["queued"] = True
    return out


def _bot_split_text_and_link(phone: str, text_body: str, invite_url: str) -> dict:
    """البوت: رسالة نصية ثم رابط منفصل قابل للنقر."""
    out_text = send_via_bot(phone, text_body)
    if not out_text.get("sent"):
        return {"sent": False, "detail": out_text.get("detail") or "", "queued": True}
    out_link = send_via_bot(phone, invite_url)
    if out_link.get("sent"):
        detail = out_link.get("detail") or out_text.get("detail") or ""
        return {"sent": True, "detail": detail, "queued": True}
    # إذا فشل إرسال الرابط منفصلاً، جرّب دمج النص والرابط في رسالة واحدة
    combined = _bot_send_reminder(phone, text_body, invite_url)
    if combined.get("sent"):
        return combined
    detail = out_link.get("detail") or out_text.get("detail") or ""
    return {"sent": False, "detail": detail, "queued": True}


def send_guest_invitation(
    guest: Guest,
    custom_body: str | None = None,
) -> dict:
    """إرسال الدعوة بالنمط الوحيد المعتمد مع Twilio:

    1) بطاقة الدعوة (تفاصيل + خريطة + رابط)
    2) فوراً: تذكير مسبق نعم ذكرني / لا اعتذر
    """
    phone = guest.phone or ""
    invite_url = _invite_url(guest)
    fallback_url = build_whatsapp_url(phone, invite_url)

    if not normalize_phone_digits(phone):
        return {"sent": False, "whatsapp_url": fallback_url, "detail": "رقم غير متوفر"}

    # مع اعتماد Twilio: المسار التفاعلي دائماً (يتجاهل القالب اليدوي/الـ legacy)
    if _active_twilio_credential() and _provider_mode() != "manual":
        from .whatsapp_interactive import send_interactive_invitation

        return send_interactive_invitation(guest)

    use_legacy = getattr(settings, "WHATSAPP_INVITATION_LEGACY_TEMPLATE", False)
    use_interactive = getattr(settings, "WHATSAPP_INVITATION_INTERACTIVE", True)

    if use_interactive and not use_legacy:
        from .whatsapp_interactive import send_interactive_invitation

        return send_interactive_invitation(guest)

    if _use_meta_templates():
        names = _template_names()
        return send_whatsapp_template(
            phone,
            names["invitation"],
            guest_template_params(guest, invite_url),
            language=names["language"],
            fallback_url=fallback_url,
        )

    if _use_twilio_templates():
        names = _template_names()
        if names["twilio_invitation"]:
            return send_twilio_content_template(
                phone,
                names["twilio_invitation"],
                _twilio_template_variables(guest_template_params(guest, invite_url)),
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
    """إرسال تذكير للضيف المؤكّد — رسالة نصية فقط (بدون قالب Meta/Twilio)."""
    phone = guest.phone or ""
    invite_url = _invite_url(guest)
    fallback_url = build_whatsapp_url(phone, invite_url)
    provider = _provider_mode()
    text_body = _build_reminder_body(guest, custom_body, invite_url)

    if not normalize_phone_digits(phone):
        return {"sent": False, "whatsapp_url": fallback_url, "detail": "رقم غير متوفر"}

    last_error = ""

    if provider == "bot":
        return _bot_send_reminder(phone, text_body, invite_url)

    if has_active_whatsapp_credential():
        text = text_body
        if invite_url not in text:
            text = f"{text}\n\n{invite_url}"
        result = dispatch_whatsapp(phone, text)
        if result.get("sent"):
            return result
        last_error = result.get("detail") or last_error
        if _bot_url_configured():
            bot_result = _bot_send_reminder(phone, text_body, invite_url)
            if bot_result.get("sent"):
                return bot_result
            last_error = bot_result.get("detail") or last_error

    if _bot_url_configured():
        bot_result = _bot_send_reminder(phone, text_body, invite_url)
        if bot_result.get("sent"):
            return bot_result
        last_error = bot_result.get("detail") or last_error

    detail = last_error or "وضع يدوي — افتح رابط واتساب"

    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": detail,
    }


def send_guest_day_before_reminder(guest: Guest) -> dict:
    """تذكير قبل المناسبة بيوم: بطاقة التفاصيل ثم صورة QR."""
    from .whatsapp_invitation import invitation_card_twilio_variables

    phone = guest.phone or ""
    invite_url = _invite_url(guest)
    fallback_url = build_whatsapp_url(phone, invite_url)

    if not normalize_phone_digits(phone):
        return {"sent": False, "whatsapp_url": fallback_url, "detail": "رقم غير متوفر"}

    names = _template_names()
    details: list[str] = []
    errors: list[str] = []

    if _use_twilio_templates() and names.get("twilio_reminder"):
        out = send_twilio_content_template(
            phone,
            names["twilio_reminder"],
            invitation_card_twilio_variables(guest),
            fallback_url=fallback_url,
        )
        if out.get("sent"):
            details.append("reminder_card")
        else:
            errors.append(out.get("detail") or "فشل قالب التذكير")
    elif has_active_whatsapp_credential():
        from .whatsapp_invitation import invitation_body, event_maps_url, BTN_MAP

        text = (
            f"مرحبا {guest.full_name or 'ضيف'}\n"
            f"يسعدنا تذكيركم بان موعد مناسبة {guest.event.title or 'المناسبة'} سيكون\n\n"
            f"التاريخ: {guest.event.date.strftime('%Y-%m-%d') if guest.event.date else '—'}\n"
            f"الوقت: {guest.event.time.strftime('%H:%M') if guest.event.time else '—'}\n"
            f"المكان: {(guest.event.venue or guest.event.geo_address or '—')}\n\n"
            f"{invite_url}"
        )
        map_u = event_maps_url(guest.event)
        if map_u:
            text += f"\n{BTN_MAP}: {map_u}"
        out = dispatch_whatsapp(phone, text)
        if out.get("sent"):
            details.append("reminder_text")
        else:
            errors.append(out.get("detail") or "فشل نص التذكير")
    else:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "لا يوجد مزوّد لإرسال التذكير",
        }

    qr_out = send_guest_qr(guest)
    if qr_out.get("sent"):
        details.append("qr")
    else:
        errors.append(qr_out.get("detail") or "فشل إرسال QR")

    sent = "reminder_card" in details or "reminder_text" in details
    detail = f"تذكير قبل الموعد: {', '.join(details)}" if details else "فشل التذكير"
    if errors:
        detail += f" — {'; '.join(errors)}"
    return {
        "sent": sent,
        "detail": detail,
        "whatsapp_url": fallback_url,
        "qr_sent": "qr" in details,
    }


def send_guest_qr(guest: Guest) -> dict:
    """إرسال قالب rsvp_qr ثم صورة QR بعد تأكيد الحضور."""
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
    names = _template_names()
    template_sent = False
    qr_result: dict = {"sent": False}

    if image_url and not image_url.startswith("https://"):
        logger.warning(
            "QR media URL is not HTTPS — Twilio/WhatsApp will reject it: %s",
            image_url,
        )

    if _use_meta_templates():
        qr_result = send_whatsapp_template(
            phone,
            names["qr"],
            guest_qr_template_params(guest),
            language=names["language"],
            fallback_url=fallback_url,
        )
        template_sent = bool(qr_result.get("sent"))
    elif _use_twilio_templates() and names["twilio_qr"]:
        qr_result = send_twilio_content_template(
            phone,
            names["twilio_qr"],
            _twilio_template_variables(guest_qr_template_params(guest)),
            fallback_url=fallback_url,
        )
        template_sent = bool(qr_result.get("sent"))

    if _provider_mode() == "bot":
        qr_text = (
            f"مرحبا {guest.full_name or 'ضيف'}\n"
            f"تم تأكيد حضورك في: {guest.event.title or 'مناسبة'}\n\n"
            "هذا هو كود الدخول الخاص بك\n\n"
            "نراك في الموعد"
        )
        send_via_bot(phone, qr_text)
        return send_via_bot_image(phone, png_bytes, caption=caption)

    if image_url and (_use_meta_templates() or has_active_whatsapp_credential()):
        img_result = send_whatsapp_image(
            phone,
            image_url=image_url,
            caption=caption,
            fallback_url=fallback_url,
        )
        if img_result.get("sent"):
            return img_result
        if template_sent:
            return qr_result  # type: ignore[name-defined]
        return img_result

    if template_sent:
        return qr_result  # type: ignore[name-defined]

    return {"sent": False, "detail": "لم يُكوَّن مزوّد إرسال للقالب أو الصورة"}
