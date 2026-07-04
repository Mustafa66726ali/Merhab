"""إرسال رابط البث المباشر للضيوف عبر واتساب (Twilio / Cloud / البوت)."""

from __future__ import annotations

from django.conf import settings

from apps.guests.models import Guest

from .whatsapp_interactive import _send_cloud_cta, _send_cloud_post_text
from .whatsapp_send import (
    _active_cloud_credential,
    _active_twilio_credential,
    _http_post_json,
    _send_twilio_whatsapp,
    build_whatsapp_url,
    dispatch_whatsapp,
    normalize_phone_digits,
    send_twilio_content_template,
)

BTN_WATCH = "مشاهدة"
WATCH_LINK_BODY = "▶️ اضغط لمشاهدة البث المباشر"


def broadcast_body(guest: Guest) -> str:
    event = guest.event
    return (
        f"مرحباً {guest.full_name or 'ضيف'}\n\n"
        f"بث مباشر — {event.title or 'المناسبة'}"
    )


def broadcast_twilio_text_variables(guest: Guest) -> dict[str, str]:
    event = guest.event
    return {
        "1": guest.full_name or "ضيف",
        "2": event.title or "المناسبة",
    }


def broadcast_watch_token(event) -> str:
    return str(event.live_broadcast_token or "")


def _broadcast_content_sids() -> dict[str, str]:
    cred = _active_twilio_credential()
    cfg = (cred.config if cred else {}) or {}
    return {
        "text": (cfg.get("content_broadcast") or "").strip(),
        "watch": (cfg.get("content_broadcast_watch") or "").strip(),
    }


def _provider_mode() -> str:
    return (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()


def _bot_url_configured() -> bool:
    return bool((getattr(settings, "WHATSAPP_BOT_URL", "") or "").strip())


def _send_bot_broadcast(phone: str, body: str, watch_url: str) -> dict:
    url = f"{settings.WHATSAPP_BOT_URL}/send-broadcast"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.WHATSAPP_BOT_TOKEN}",
    }
    payload = {
        "to": normalize_phone_digits(phone),
        "body": body,
        "watch_url": watch_url,
        "watch_button": BTN_WATCH,
    }
    status_code, resp_body = _http_post_json(url, payload, headers)
    if status_code in (200, 201, 202):
        return {
            "sent": True,
            "queued": True,
            "detail": "تم إرسال رابط البث عبر البوت (نص + زر مشاهدة)",
        }
    return {
        "sent": False,
        "detail": (resp_body[:200] if resp_body else "تعذّر الاتصال ببوت الواتساب")
        or "تعذّر الاتصال ببوت الواتساب",
    }


def _send_twilio_broadcast(phone: str, guest: Guest, watch_url: str) -> dict:
    sids = _broadcast_content_sids()
    token = broadcast_watch_token(guest.event)
    steps_ok = 0
    steps_total = 0
    details: list[str] = []

    if sids["text"]:
        steps_total += 1
        out = send_twilio_content_template(
            phone,
            sids["text"],
            broadcast_twilio_text_variables(guest),
        )
        if out.get("sent"):
            steps_ok += 1
            details.append("text")
    else:
        steps_total += 1
        fallback = build_whatsapp_url(phone, broadcast_body(guest))
        cred = _active_twilio_credential()
        if cred:
            plain = _send_twilio_whatsapp(
                cred, normalize_phone_digits(phone), broadcast_body(guest), fallback
            )
            if plain.get("sent"):
                steps_ok += 1
                details.append("text-plain")

    if sids["watch"] and token:
        steps_total += 1
        out = send_twilio_content_template(phone, sids["watch"], {"1": token})
        if out.get("sent"):
            steps_ok += 1
            details.append("watch")
    elif watch_url:
        steps_total += 1
        from .whatsapp_interactive import _send_twilio_text

        if _send_twilio_text(phone, f"{WATCH_LINK_BODY}\n{watch_url}"):
            steps_ok += 1
            details.append("watch-plain")

    sent = steps_ok >= 1 and (steps_total == 1 or steps_ok >= 2)
    if steps_total == 1 and steps_ok == 1:
        sent = True
    return {
        "sent": sent,
        "detail": f"بث Twilio ({steps_ok}/{steps_total}): {', '.join(details) or '—'}",
        "interactive": True,
    }


def _send_cloud_broadcast(phone: str, guest: Guest, watch_url: str) -> dict:
    cred = _active_cloud_credential()
    if not cred:
        return {"sent": False, "detail": "لا يوجد اعتماد Cloud API"}
    digits = normalize_phone_digits(phone)
    body = broadcast_body(guest)
    steps_ok = 0
    if _send_cloud_post_text(digits, body, cred):
        steps_ok += 1
    if watch_url and _send_cloud_cta(phone, WATCH_LINK_BODY, BTN_WATCH, watch_url):
        steps_ok += 1
    sent = steps_ok >= 1
    return {
        "sent": sent,
        "detail": f"بث Cloud ({steps_ok}/2)",
        "interactive": True,
    }


def send_guest_broadcast_link(guest: Guest, broadcast_url: str) -> dict:
    """يرسل نص البث + زر «مشاهدة» يفتح صفحة `/live/{token}`."""
    phone = guest.phone or ""
    fallback_url = build_whatsapp_url(phone, broadcast_url)
    body = broadcast_body(guest)

    if not normalize_phone_digits(phone):
        return {"sent": False, "whatsapp_url": fallback_url, "detail": "رقم غير متوفر"}

    provider = _provider_mode()
    cloud = _active_cloud_credential()
    twilio = _active_twilio_credential()
    sids = _broadcast_content_sids()
    use_twilio_broadcast = bool(
        twilio and (sids["text"] or sids["watch"]) and provider != "manual" and not cloud
    )

    if cloud and provider != "manual":
        result = _send_cloud_broadcast(phone, guest, broadcast_url)
        if result.get("sent"):
            result["whatsapp_url"] = fallback_url
            return result

    if use_twilio_broadcast:
        result = _send_twilio_broadcast(phone, guest, broadcast_url)
        if result.get("sent"):
            result["whatsapp_url"] = fallback_url
            return result

    if provider == "bot" and _bot_url_configured():
        result = _send_bot_broadcast(phone, body, broadcast_url)
        result["whatsapp_url"] = fallback_url
        return result

    if twilio and provider != "manual" and not cloud:
        result = _send_twilio_broadcast(phone, guest, broadcast_url)
        if result.get("sent"):
            result["whatsapp_url"] = fallback_url
            return result

    if _bot_url_configured():
        result = _send_bot_broadcast(phone, body, broadcast_url)
        if result.get("sent"):
            result["whatsapp_url"] = fallback_url
            return result

    text = f"{body}\n\n{WATCH_LINK_BODY}\n{broadcast_url}"
    result = dispatch_whatsapp(phone, text)
    result["whatsapp_url"] = fallback_url
    if not result.get("sent") and not result.get("detail"):
        result["detail"] = "وضع يدوي — افتح رابط واتساب"
    return result
