"""إرسال دعوة تفاعلية عبر Cloud API / Twilio / البوت المحلي."""

from __future__ import annotations

from typing import Any

from django.conf import settings

from apps.guests.models import Guest

from .whatsapp_invitation import (
    BTN_INVITE,
    BTN_MAP,
    INVITE_LINK_BODY,
    REMIND_NO,
    REMIND_YES,
    event_maps_url,
    invitation_body,
    invitation_card_twilio_variables,
    invite_url,
    reminder_optin_body,
    reminder_optin_twilio_variables,
    remind_button_id,
)
from .whatsapp_send import (
    _active_cloud_credential,
    _active_twilio_credential,
    _http_post_form,
    _http_post_json,
    normalize_phone_digits,
    parse_twilio_error,
    send_twilio_content_template,
    send_via_bot,
)
from .whatsapp_twilio_setup import check_twilio_invitation_setup


def _cloud_post(cred, payload: dict) -> tuple[bool, str]:
    url = f"https://graph.facebook.com/v18.0/{cred.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {cred.api_key}",
        "Content-Type": "application/json",
    }
    status_code, body = _http_post_json(url, payload, headers)
    return status_code in (200, 201), body[:300]


def _send_cloud_cta(phone: str, body_text: str, display: str, url: str) -> bool:
    cred = _active_cloud_credential()
    if not cred or not url:
        return False
    payload = {
        "messaging_product": "whatsapp",
        "to": normalize_phone_digits(phone),
        "type": "interactive",
        "interactive": {
            "type": "cta_url",
            "body": {"text": body_text[:1024]},
            "action": {
                "name": "cta_url",
                "parameters": {"display_text": display[:20], "url": url},
            },
        },
    }
    ok, _ = _cloud_post(cred, payload)
    return ok


def _send_twilio_text(phone: str, text: str) -> dict:
    cred = _active_twilio_credential()
    if not cred:
        return {"sent": False, "detail": "لا يوجد اعتماد Twilio"}
    from_number = cred.phone_number_id.strip()
    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:+{normalize_phone_digits(from_number)}"
    to_number = f"whatsapp:+{normalize_phone_digits(phone)}"
    api_url = (
        f"https://api.twilio.com/2010-04-01/Accounts/{cred.api_key}/Messages.json"
    )
    status_code, body = _http_post_form(
        api_url,
        {"From": from_number, "To": to_number, "Body": text},
        (cred.api_key, cred.api_secret),
    )
    if status_code in (200, 201):
        return {"sent": True, "detail": "نص Twilio"}
    return {"sent": False, "detail": parse_twilio_error(body)}


def _twilio_content_sid(*keys: str) -> str:
    cred = _active_twilio_credential()
    cfg = (cred.config if cred else {}) or {}
    for key in keys:
        val = (cfg.get(key) or "").strip()
        if val:
            return val
    return ""


def _send_twilio_interactive_invitation(
    phone: str,
    guest: Guest,
    body: str,
    inv: str,
    map_u: str | None,
) -> dict:
    """دعوة Twilio: (1) بطاقة الدعوة ثم (2) التذكير المسبق فوراً."""
    setup = check_twilio_invitation_setup()
    if not setup["ready"]:
        return {
            "sent": False,
            "detail": "إعداد Twilio غير مكتمل: " + " | ".join(setup["issues"]),
            "interactive": True,
            "issues": setup["issues"],
            "warnings": setup.get("warnings") or [],
        }

    invite_sid = _twilio_content_sid("content_invitation", "content_card")
    optin_sid = _twilio_content_sid("content_reminder_optin")

    out = send_twilio_content_template(
        phone,
        invite_sid,
        invitation_card_twilio_variables(guest),
    )
    if not out.get("sent"):
        return {
            "sent": False,
            "detail": f"فشل قالب الدعوة: {out.get('detail', 'خطأ غير معروف')}",
            "interactive": True,
            "twilio_sid": out.get("twilio_sid"),
        }

    out2 = send_twilio_content_template(
        phone,
        optin_sid,
        reminder_optin_twilio_variables(guest),
    )
    if not out2.get("sent"):
        return {
            "sent": False,
            "detail": (
                f"الدعوة وصلت لكن فشل التذكير المسبق: "
                f"{out2.get('detail', 'خطأ غير معروف')}"
            ),
            "interactive": True,
            "partial": ["invitation"],
            "twilio_sid": out2.get("twilio_sid"),
        }

    return {
        "sent": True,
        "detail": (
            f"دعوة Twilio (دعوة + تذكير مسبق) — "
            f"{out.get('detail', '')} | {out2.get('detail', '')}"
        )[:500],
        "interactive": True,
        "content_sid": invite_sid,
        "optin_sid": optin_sid,
    }


def _send_cloud_remind_buttons(phone: str, guest: Guest) -> bool:
    cred = _active_cloud_credential()
    if not cred:
        return False
    payload = {
        "messaging_product": "whatsapp",
        "to": normalize_phone_digits(phone),
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": reminder_optin_body(guest)[:1024]},
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": remind_button_id(guest, True),
                            "title": REMIND_YES[:20],
                        },
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": remind_button_id(guest, False),
                            "title": REMIND_NO[:20],
                        },
                    },
                ]
            },
        },
    }
    ok, _ = _cloud_post(cred, payload)
    return ok


def _send_bot_invitation(phone: str, guest: Guest, body: str, map_u: str | None, inv: str) -> bool:
    url = f"{settings.WHATSAPP_BOT_URL}/send-invitation"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.WHATSAPP_BOT_TOKEN}",
    }
    payload: dict[str, Any] = {
        "to": normalize_phone_digits(phone),
        "guest_token": str(guest.public_token),
        "body": body,
        "invite_url": inv,
        "map_url": map_u or "",
        "map_button": BTN_MAP,
        "invite_body": INVITE_LINK_BODY,
        "invite_button": BTN_INVITE,
        "poll_question": reminder_optin_body(guest),
        "poll_options": [REMIND_YES, REMIND_NO],
    }
    status_code, _ = _http_post_json(url, payload, headers)
    return status_code in (200, 201, 202)


def send_interactive_invitation(
    guest: Guest,
    *,
    headline: str = "دعوة الضيف",
) -> dict:
    """النمط الوحيد عبر Twilio: بطاقة دعوة ثم تذكير مسبق (نعم ذكرني / لا)."""
    phone = guest.phone or ""
    digits = normalize_phone_digits(phone)
    if not digits:
        return {"sent": False, "detail": "رقم غير متوفر"}

    base = settings.FRONTEND_URL
    body = invitation_body(guest, headline=headline)
    inv = invite_url(guest, base)
    map_u = event_maps_url(guest.event)

    provider = (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()
    cloud = _active_cloud_credential()
    twilio = _active_twilio_credential()

    # Twilio Content هو المسار الأساسي للدعوات عند توفر الاعتماد
    if twilio and provider != "manual":
        return _send_twilio_interactive_invitation(phone, guest, body, inv, map_u)

    if cloud and provider != "manual":
        steps_ok = 0
        steps_total = 2 + (1 if map_u else 0) + 1
        if _send_cloud_post_text(digits, body, cloud):
            steps_ok += 1
        if map_u and _send_cloud_cta(phone, "الموقع على الخريطة", BTN_MAP, map_u):
            steps_ok += 1
        if _send_cloud_cta(phone, INVITE_LINK_BODY, BTN_INVITE, inv):
            steps_ok += 1
        if _send_cloud_remind_buttons(phone, guest):
            steps_ok += 1
        sent = steps_ok >= 2
        return {
            "sent": sent,
            "detail": f"دعوة تفاعلية Cloud ({steps_ok}/{steps_total})",
            "interactive": True,
        }

    if provider == "bot":
        sent = _send_bot_invitation(phone, guest, body, map_u, inv)
        return {
            "sent": sent,
            "detail": "دعوة تفاعلية عبر البوت (دعوة + تذكير مسبق)",
            "interactive": True,
            "queued": True,
        }

    text = f"{body}\n\n{INVITE_LINK_BODY}"
    if map_u:
        text += f"\n{BTN_MAP}: {map_u}"
    text += f"\n\n{reminder_optin_body(guest)}\nرد: {REMIND_YES} أو {REMIND_NO}"
    return {"sent": False, "detail": "لا يوجد مزوّد واتساب للإرسال التلقائي", "preview": text}

def _send_cloud_post_text(digits: str, text: str, cred) -> bool:
    payload = {
        "messaging_product": "whatsapp",
        "to": digits,
        "type": "text",
        "text": {"body": text[:4096]},
    }
    ok, _ = _cloud_post(cred, payload)
    return ok
