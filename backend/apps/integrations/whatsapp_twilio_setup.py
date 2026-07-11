"""التحقق من جاهزية Twilio لإرسال الدعوات التفاعلية."""

from __future__ import annotations

from django.conf import settings

from .whatsapp_send import (
    _active_cloud_credential,
    _active_twilio_credential,
)


def check_twilio_invitation_setup() -> dict:
    """يتطلب قالب الدعوة + قالب التذكير المسبق."""
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
    invite_sid = (cfg.get("content_card") or cfg.get("content_invitation") or "").strip()
    if not invite_sid:
        issues.append(
            "content_invitation مفقود — قالب twilio/card للدعوة "
            "(نص + فتح الخريطة + فتح الدعوة)."
        )

    optin_sid = (cfg.get("content_reminder_optin") or "").strip()
    if not optin_sid:
        issues.append(
            "content_reminder_optin مفقود — قالب Quick Reply "
            "(نعم ذكرني / لا اعتذر عن الحضور)."
        )

    reminder_sid = (cfg.get("content_reminder") or "").strip()
    if not reminder_sid:
        issues.append(
            "content_reminder مفقود — قالب twilio/card لتذكير ما قبل الموعد بيوم "
            "(ثم تُرسل صورة QR تلقائياً)."
        )

    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "warnings": [],
        "provider": provider,
        "sender": cred.phone_number_id,
    }
