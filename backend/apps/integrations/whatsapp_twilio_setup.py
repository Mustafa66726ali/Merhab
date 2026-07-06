"""التحقق من جاهزية Twilio لإرسال الدعوات التفاعلية."""

from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request

from django.conf import settings

from .whatsapp_send import (
    TWILIO_KNOWN_ERRORS,
    _active_cloud_credential,
    _active_twilio_credential,
)


def check_twilio_invitation_setup() -> dict:
    """يُرجع قائمة مشاكل الإعداد قبل محاولة الإرسال."""
    provider = (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()
    cred = _active_twilio_credential()
    issues: list[str] = []

    if provider == "manual":
        issues.append(
            "WHATSAPP_PROVIDER=manual — لن يُرسل عبر Twilio تلقائياً. "
            "اضبط WHATSAPP_PROVIDER=api في .env وفعّل «إرسال تلقائي»."
        )

    if _active_cloud_credential():
        issues.append(
            "يوجد اعتماد WhatsApp Cloud API نشط — له أولوية على Twilio. "
            "عطّله إن كنت تستخدم Twilio فقط."
        )

    if not cred:
        issues.append(
            "لا يوجد اعتماد Twilio نشط — أضف Account SID + Auth Token + رقم المُرسِل "
            "من صفحة التكاملات."
        )
        return {"ready": False, "issues": issues, "provider": provider}

    if not cred.api_key or not cred.api_secret:
        issues.append("Account SID أو Auth Token ناقص في التكاملات.")

    if not (cred.phone_number_id or "").strip():
        issues.append(
            "رقم المُرسِل (phone_number_id) فارغ — استخدم whatsapp:+15558663061"
        )

    cfg = cred.config or {}
    required = {
        "content_invitation": "قالب نص الدعوة (1. نص الدعوة)",
        "content_open_invite": "قالب زر فتح الدعوة (3. فتح الدعوة)",
        "content_rsvp": "قالب نعم/لا (4. RSVP)",
    }
    for key, label in required.items():
        if not (cfg.get(key) or "").strip():
            issues.append(f"{key} مفقود — {label}")

    map_sid = (cfg.get("content_map") or "").strip()
    open_sid = (cfg.get("content_open_invite") or "").strip()
    if map_sid and open_sid and map_sid == open_sid:
        issues.append(
            "content_map و content_open_invite يستخدمان نفس Content SID — "
            "يجب أن يكون لكل قالب HX منفصل."
        )

    issues.extend(_recent_twilio_delivery_issues(cred))

    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "provider": provider,
        "sender": cred.phone_number_id,
    }


def _recent_twilio_delivery_issues(cred) -> list[str]:
    """تحذير إذا آخر رسائل Twilio فشلت عند التسليم (بعد قبول الطلب)."""
    if not cred.api_key or not cred.api_secret:
        return []
    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/{cred.api_key}/Messages.json"
        "?PageSize=5"
    )
    token = base64.b64encode(f"{cred.api_key}:{cred.api_secret}".encode()).decode()
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, OSError):
        return []

    messages = data.get("messages") or []
    failed = [m for m in messages if m.get("status") == "failed"]
    if len(failed) < 2:
        return []

    codes: set[int] = set()
    for msg in failed[:3]:
        code = msg.get("error_code")
        if code:
            try:
                codes.add(int(code))
            except (TypeError, ValueError):
                pass

    hints: list[str] = []
    for code in sorted(codes):
        hint = TWILIO_KNOWN_ERRORS.get(code)
        if hint:
            hints.append(f"آخر رسائل Twilio فشلت عند التسليم: {hint}")
        else:
            hints.append(
                f"آخر رسائل Twilio فشلت عند التسليم (رمز {code}). "
                "راجع Twilio Console → Monitor → Logs → Messaging."
            )
    return hints[:2]
