"""إرسال رسائل واتساب عبر بوت الاختبار، Cloud API/Twilio، أو رابط wa.me.

يُختار المزوّد عبر الإعداد ``WHATSAPP_PROVIDER``:
- ``manual`` → روابط wa.me يدوية (التطوير).
- ``bot``    → بوت محلي يحاكي الإنسان لاختبار الأتمتة دون حظر.
- ``api``    → WhatsApp Cloud API / Twilio حسب التكاملات (الإنتاج).
"""

import base64
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import quote

from django.conf import settings

from apps.integrations.models import IntegrationCredential


def normalize_phone_digits(phone: str) -> str:
    return re.sub(r"\D", "", (phone or "").strip())


def build_whatsapp_url(phone: str, text: str = "") -> str:
    digits = normalize_phone_digits(phone)
    if not digits:
        return ""
    base = f"https://wa.me/{digits}"
    if text:
        return f"{base}?text={quote(text)}"
    return base


def _http_post_json(url: str, payload: dict, headers: dict) -> tuple[int, str]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    for key, value in headers.items():
        req.add_header(key, value)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return 0, str(exc.reason)


def _http_post_form(url: str, form: dict, auth: tuple[str, str]) -> tuple[int, str]:
    body = urllib.parse.urlencode(form).encode("utf-8")
    token = base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Basic {token}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return 0, str(exc.reason)


def send_whatsapp_text(phone: str, text: str) -> dict:
    """
    يحاول الإرسال عبر WhatsApp Cloud API إن وُجدت credentials نشطة.
    يُرجع: sent (bool), whatsapp_url (str), detail (str)
    """
    digits = normalize_phone_digits(phone)
    fallback_url = build_whatsapp_url(phone, text)

    if not digits or not text.strip():
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "رقم الهاتف أو المحتوى غير متوفر",
        }

    cred = (
        IntegrationCredential.objects.filter(
            provider=IntegrationCredential.Provider.WHATSAPP_CLOUD,
            is_active=True,
        )
        .order_by("-updated_at")
        .first()
    )

    if not cred or not cred.api_key or not cred.phone_number_id:
        cred = (
            IntegrationCredential.objects.filter(
                provider=IntegrationCredential.Provider.WHATSAPP_TWILIO,
                is_active=True,
            )
            .order_by("-updated_at")
            .first()
        )
        if cred and cred.api_key and cred.api_secret and cred.phone_number_id:
            return _send_twilio_whatsapp(cred, digits, text, fallback_url)

        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "لم يُكوَّن WhatsApp API — استخدم رابط واتساب",
        }

    return _send_cloud_api(cred, digits, text, fallback_url)


def _send_cloud_api(cred, digits: str, text: str, fallback_url: str) -> dict:
    url = f"https://graph.facebook.com/v18.0/{cred.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {cred.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": digits,
        "type": "text",
        "text": {"body": text},
    }
    status_code, body = _http_post_json(url, payload, headers)
    if status_code in (200, 201):
        return {
            "sent": True,
            "whatsapp_url": fallback_url,
            "detail": "تم الإرسال عبر WhatsApp Cloud API",
        }
    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": body[:200] or "فشل إرسال واتساب",
    }


def send_via_bot(phone: str, text: str) -> dict:
    """يُرسل عبر بوت الواتساب المحلي الذي يحاكي سلوك الإنسان.

    البوت يستقبل الرسالة ويضعها في طابور داخلي ويُرسلها بتأنٍّ (تأخير عشوائي
    ومؤشّر كتابة) لتجنّب الحظر. لذا يعود هذا الاستدعاء سريعاً بحالة ``queued``.
    """
    digits = normalize_phone_digits(phone)
    fallback_url = build_whatsapp_url(phone, text)
    if not digits or not text.strip():
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "رقم الهاتف أو المحتوى غير متوفر",
        }

    url = f"{settings.WHATSAPP_BOT_URL}/send"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.WHATSAPP_BOT_TOKEN}",
    }
    status_code, body = _http_post_json(
        url, {"to": digits, "message": text}, headers
    )
    if status_code in (200, 201, 202):
        return {
            "sent": True,
            "queued": True,
            "whatsapp_url": fallback_url,
            "detail": "تمت إضافته لطابور البوت (محاكاة إرسال بشري)",
        }
    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": (body[:200] if body else "تعذّر الاتصال ببوت الواتساب")
        or "تعذّر الاتصال ببوت الواتساب",
    }


def dispatch_whatsapp(phone: str, text: str) -> dict:
    """يوجّه الإرسال إلى المزوّد المُكوَّن (manual/bot/api)."""
    provider = (getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual").lower()
    if provider == "bot":
        return send_via_bot(phone, text)
    if provider in ("api", "cloud", "twilio"):
        return send_whatsapp_text(phone, text)
    # manual — روابط يدوية
    return {
        "sent": False,
        "whatsapp_url": build_whatsapp_url(phone, text),
        "detail": "وضع يدوي — افتح الرابط لإتمام الإرسال",
    }


def _send_twilio_whatsapp(cred, digits: str, text: str, fallback_url: str) -> dict:
    from_number = cred.phone_number_id.strip()
    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:+{normalize_phone_digits(from_number)}"
    to_number = f"whatsapp:+{digits}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{cred.api_key}/Messages.json"
    status_code, body = _http_post_form(
        url,
        {"From": from_number, "To": to_number, "Body": text},
        (cred.api_key, cred.api_secret),
    )
    if status_code in (200, 201):
        return {
            "sent": True,
            "whatsapp_url": fallback_url,
            "detail": "تم الإرسال عبر Twilio WhatsApp",
        }
    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": body[:200] or "فشل إرسال واتساب",
    }
