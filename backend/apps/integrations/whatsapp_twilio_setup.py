"""التحقق من جاهزية Twilio لإرسال الدعوات التفاعلية."""

from __future__ import annotations

from django.conf import settings

from .whatsapp_send import (
    _active_cloud_credential,
    _active_twilio_credential,
    fetch_twilio_content,
    twilio_content_variable_keys,
)


def check_twilio_invitation_setup() -> dict:
    """يتطلب قالب الدعوة (Card) + التذكير المسبق + تذكير ما قبل الموعد."""
    provider = (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()
    cred = _active_twilio_credential()
    issues: list[str] = []
    warnings: list[str] = []

    if provider == "manual":
        issues.append(
            "WHATSAPP_PROVIDER=manual — لن يُرسل عبر Twilio تلقائياً. "
            "اضبط WHATSAPP_PROVIDER=api في .env وفعّل «إرسال تلقائي»."
        )

    if _active_cloud_credential():
        warnings.append(
            "يوجد اعتماد WhatsApp Cloud API نشط — مسار الدعوات يفضّل Twilio "
            "عند اكتمال قوالب Content. عطّل Cloud إن أردت Twilio فقط."
        )

    if not cred:
        issues.append(
            "لا يوجد اعتماد Twilio نشط — أضف Account SID + Auth Token + رقم المُرسِل "
            "من صفحة التكاملات."
        )
        return {
            "ready": False,
            "issues": issues,
            "warnings": warnings,
            "provider": provider,
        }

    if not cred.api_key or not cred.api_secret:
        issues.append("Account SID أو Auth Token ناقص في التكاملات.")

    if not (cred.phone_number_id or "").strip():
        issues.append(
            "رقم المُرسِل (phone_number_id) فارغ — استخدم whatsapp:+966XXXXXXXXX"
        )

    cfg = cred.config or {}
    invite_sid = (cfg.get("content_invitation") or cfg.get("content_card") or "").strip()
    if not invite_sid:
        issues.append(
            "content_invitation مفقود — قالب twilio/card للدعوة "
            "(اسم + مناسبة + تاريخ + وقت + مكان + خريطة + فتح الدعوة)."
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

    expected = {
        "content_invitation": (7, invite_sid),
        "content_reminder_optin": (2, optin_sid),
        "content_reminder": (7, reminder_sid),
    }
    for label, (want_n, sid) in expected.items():
        if not sid:
            continue
        content = fetch_twilio_content(cred, sid)
        keys = twilio_content_variable_keys(content)
        if content is None:
            warnings.append(f"{label}: تعذّر جلب القالب {sid} من Twilio.")
        elif len(keys) != want_n:
            warnings.append(
                f"{label} ({sid}): القالب يعرّف {{{','.join(keys)}}} "
                f"n={len(keys)} — مرحّاب يتوقع n={want_n}. "
                "حدّث القالب أو الـ SID لتفادي 63028."
            )

    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "provider": provider,
        "sender": cred.phone_number_id,
    }
