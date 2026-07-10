"""إرسال دعوة تفاعلية عبر Cloud API / Twilio / البوت المحلي."""

from __future__ import annotations

from typing import Any

from django.conf import settings

from apps.guests.models import Guest

from .whatsapp_invitation import (
    BTN_INVITE,
    BTN_MAP,
    INVITE_LINK_BODY,
    RSVP_NO,
    RSVP_YES,
    event_maps_url,
    invitation_body,
    invitation_twilio_variables,
    invite_url,
    map_template_variable,
    rsvp_button_id,
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


def _send_cloud_rsvp_buttons(phone: str, guest: Guest) -> bool:
    cred = _active_cloud_credential()
    if not cred:
        return False
    payload = {
        "messaging_product": "whatsapp",
        "to": normalize_phone_digits(phone),
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": "هل ستحضر؟"},
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": rsvp_button_id(guest, True),
                            "title": RSVP_YES,
                        },
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": rsvp_button_id(guest, False),
                            "title": RSVP_NO,
                        },
                    },
                ]
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


def _twilio_content_sids() -> dict[str, str]:
    cred = _active_twilio_credential()
    cfg = (cred.config if cred else {}) or {}
    return {
        "invitation": (cfg.get("content_invitation") or "").strip(),
        "map": (cfg.get("content_map") or "").strip(),
        "open_invite": (cfg.get("content_open_invite") or "").strip(),
        "rsvp": (cfg.get("content_rsvp") or "").strip(),
    }


def _send_twilio_interactive_invitation(
    phone: str,
    guest: Guest,
    body: str,
    inv: str,
    map_u: str | None,
) -> dict:
    """دعوة تفاعلية Twilio: قوالب Content بالتسلسل (نص + خريطة + فتح + نعم/لا)."""
    setup = check_twilio_invitation_setup()
    if not setup["ready"]:
        return {
            "sent": False,
            "detail": "إعداد Twilio غير مكتمل: " + " | ".join(setup["issues"]),
            "interactive": True,
            "issues": setup["issues"],
            "warnings": setup.get("warnings") or [],
        }

    sids = _twilio_content_sids()
    token = str(guest.public_token)
    details: list[str] = []
    errors: list[str] = []

    out = send_twilio_content_template(
        phone,
        sids["invitation"],
        invitation_twilio_variables(guest),
    )
    if not out.get("sent"):
        return {
            "sent": False,
            "detail": out.get("detail", "فشل إرسال قالب الدعوة"),
            "interactive": True,
        }
    details.append("invitation")

    map_var = map_template_variable(guest.event) if map_u else None
    if map_var and sids["map"]:
        out = send_twilio_content_template(phone, sids["map"], {"1": map_var})
        if out.get("sent"):
            details.append("map")
        else:
            errors.append(out.get("detail", "map"))

    out = send_twilio_content_template(phone, sids["open_invite"], {"1": token})
    if out.get("sent"):
        details.append("open")
    else:
        return {
            "sent": False,
            "detail": out.get("detail", "فشل إرسال زر فتح الدعوة"),
            "interactive": True,
            "partial": details,
        }

    out = send_twilio_content_template(phone, sids["rsvp"], {"1": token})
    if out.get("sent"):
        details.append("rsvp")
    else:
        errors.append(out.get("detail", "rsvp"))

    detail = f"دعوة Twilio ({len(details)} خطوات): {', '.join(details)}"
    if errors:
        detail += f" — تحذيرات: {' | '.join(errors)}"
    return {
        "sent": True,
        "detail": detail,
        "interactive": True,
    }


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
        "poll_question": "هل ستحضر؟",
        "poll_options": [RSVP_YES, RSVP_NO],
    }
    status_code, _ = _http_post_json(url, payload, headers)
    return status_code in (200, 201, 202)


def send_interactive_invitation(
    guest: Guest,
    *,
    headline: str = "دعوة الضيف",
) -> dict:
    """دعوة تفاعلية: نص + خريطة + رابط الدعوة + نعم/لا."""
    phone = guest.phone or ""
    digits = normalize_phone_digits(phone)
    if not digits:
        return {"sent": False, "detail": "رقم غير متوفر"}

    base = settings.FRONTEND_URL
    body = invitation_body(guest, headline=headline)
    inv = invite_url(guest, base)
    map_u = event_maps_url(guest.event)

    provider = (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()
    steps_ok = 0
    steps_total = 2 + (1 if map_u else 0) + 1

    cloud = _active_cloud_credential()
    twilio = _active_twilio_credential()

    if cloud and provider != "manual":
        if _send_cloud_post_text(digits, body, cloud):
            steps_ok += 1
        if map_u and _send_cloud_cta(phone, "الموقع على الخريطة", BTN_MAP, map_u):
            steps_ok += 1
        if _send_cloud_cta(phone, INVITE_LINK_BODY, BTN_INVITE, inv):
            steps_ok += 1
        if _send_cloud_rsvp_buttons(phone, guest):
            steps_ok += 1
        sent = steps_ok >= 2
        return {
            "sent": sent,
            "detail": f"دعوة تفاعلية Cloud ({steps_ok}/{steps_total})",
            "interactive": True,
        }

    if twilio and provider != "manual" and not cloud:
        return _send_twilio_interactive_invitation(phone, guest, body, inv, map_u)

    if provider == "bot" and not twilio:
        sent = _send_bot_invitation(phone, guest, body, map_u, inv)
        return {
            "sent": sent,
            "detail": "دعوة تفاعلية عبر البوت (أزرار + استطلاع)",
            "interactive": True,
            "queued": True,
        }

    text = f"{body}\n\n{INVITE_LINK_BODY}"
    if map_u:
        text += f"\n{BTN_MAP}: {map_u}"
    text += "\n\nهل ستحضر؟ رد: نعم أو لا"
    out = send_via_bot(phone, text) if provider == "bot" else {"sent": False}
    return out


def _send_cloud_post_text(digits: str, text: str, cred) -> bool:
    payload = {
        "messaging_product": "whatsapp",
        "to": digits,
        "type": "text",
        "text": {"body": text[:4096]},
    }
    ok, _ = _cloud_post(cred, payload)
    return ok
