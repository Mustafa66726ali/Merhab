"""التحقق من جاهزية Twilio لإرسال الدعوات التفاعلية."""

from __future__ import annotations

from django.conf import settings

from .whatsapp_send import (
    _active_cloud_credential,
    _active_twilio_credential,
)


def check_twilio_invitation_setup() -> dict:
    """يُرجع مشاكل الإعداد الحقيقية فقط — يتطلب قالب twilio/card واحد."""
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
    card_sid = (cfg.get("content_card") or cfg.get("content_invitation") or "").strip()
    if not card_sid:
        issues.append(
            "content_invitation مفقود — أنشئ قالب twilio/card في Twilio "
            "والصق Content SID (HX...) في حقل «قالب الدعوة»."
        )

    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "warnings": [],
        "provider": provider,
        "sender": cred.phone_number_id,
    }
