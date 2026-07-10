"""التحقق من جاهزية Twilio لإرسال الدعوات التفاعلية."""

from __future__ import annotations

from django.conf import settings

from .whatsapp_send import (
    _active_cloud_credential,
    _active_twilio_credential,
)


def check_twilio_invitation_setup() -> dict:
    """يُرجع مشاكل الإعداد الحقيقية فقط — رسائل التسليم القديمة لا تمنع الإرسال."""
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
        return {
            "ready": False,
            "issues": issues,
            "warnings": [],
            "provider": provider,
        }

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

    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "warnings": [],
        "provider": provider,
        "sender": cred.phone_number_id,
    }
