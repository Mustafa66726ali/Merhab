"""إرسال رسائل واتساب عبر بوت الاختبار، Cloud API/Twilio، أو رابط wa.me.

يُختار المزوّد عبر الإعداد ``WHATSAPP_PROVIDER``:
- ``manual`` → روابط wa.me يدوية (التطوير).
- ``bot``    → بوت محلي يحاكي الإنسان لاختبار الأتمتة دون حظر.
- ``api``    → WhatsApp Cloud API / Twilio حسب التكاملات (الإنتاج).
"""

import base64
import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import quote

from django.conf import settings

from apps.integrations.models import IntegrationCredential

logger = logging.getLogger(__name__)

# أسماء قوالب Meta الافتراضية (يُستبدلها من .env أو إعدادات التكامل)
TWILIO_KNOWN_ERRORS: dict[int, str] = {
    63112: (
        "Meta عطّلت حساب WhatsApp Business المرتبط بالمرسل (63112). "
        "راجع Meta Business Manager → Account Quality وأكمل التحقق من النشاط."
    ),
    63120: "حساب Meta Business مقفول — تواصل مع Meta Business Support (63120).",
    63051: "مرسل أو حساب WhatsApp مقيّد من Meta (63051).",
    63016: (
        "القالب غير مطابق أو غير معتمد / الرقم غير صالح (63016). "
        "تأكد أن Content Template بحالة Approved وأن المتغيرات تطابق القالب."
    ),
    63013: (
        "مخالفة سياسة واتساب (63013) — غالباً متغير قالب فارغ، مسافات زائدة، "
        "أو رابط زر غير عام. راجع قالب Content ومتغيراته."
    ),
    63019: (
        "فشل تحميل الوسائط (63019) — تأكد أن رابط الصورة/الملف عام ومتاح لـ Twilio "
        "ويُرجع ملفاً غير فارغ بنوع Content-Type صحيح."
    ),
    63007: (
        "رقم المرسل غير مربوط كقناة واتساب في Twilio (63007). "
        "ضع رقم WhatsApp Sender الفعّال (ONLINE) في التكاملات."
    ),
    63049: "Meta رفضت الرسالة (63049) — راجع جودة الحساب أو محتوى القالب.",
    21211: "رقم المستلم غير صالح (21211).",
    21608: "الرقم غير مفعّل لاستقبال رسائل WhatsApp عبر Twilio (21608).",
    21610: "المستلم ألغى الاشتراك / لا يمكن مراسلته (21610).",
    63024: "فشل إرسال القالب — قد يكون غير معتمد لواتساب أو المتغيرات ناقصة (63024).",
    63028: (
        "عدد متغيرات القالب لا يطابق ما يرسله مرحّاب (63028). "
        "قالب الدعوة/التذكير يحتاج {{1}}…{{7}} بالضبط، "
        "والتذكير المسبق {{1}} و{{2}} فقط. "
        "حدّث Content SID في التكاملات ليطابق القالب الجديد المعتمد."
    ),
}


def format_twilio_error_code(code, message: str | None = None) -> str:
    """رسالة تشخيص عربية من رمز Twilio."""
    try:
        code_int = int(code)
    except (TypeError, ValueError):
        code_int = None
    if code_int is not None:
        hint = TWILIO_KNOWN_ERRORS.get(code_int)
        if hint:
            return hint
        if message:
            return f"Twilio {code_int}: {message}"
        return f"فشل تسليم Twilio (رمز {code_int}). راجع Monitor → Messaging Logs."
    if message:
        return str(message)[:300]
    return "خطأ Twilio غير معروف"


def parse_twilio_error(body: str) -> str:
    """استخراج رسالة خطأ Twilio من JSON."""
    try:
        data = json.loads(body)
        msg = data.get("message") or data.get("error_message")
        code = data.get("code") or data.get("error_code")
        if code or msg:
            return format_twilio_error_code(code, msg)
    except (json.JSONDecodeError, TypeError):
        pass
    return (body or "خطأ Twilio غير معروف")[:300]


def evaluate_twilio_send_response(status_code: int, body: str) -> tuple[bool, str, str | None]:
    """يُقيّم استجابة Twilio — 201 لا يعني بالضرورة وصول الرسالة للضيف."""
    if status_code not in (200, 201):
        return False, parse_twilio_error(body), None
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return True, "تم قبول الطلب من Twilio", None

    code = data.get("error_code") or data.get("code")
    if code:
        return False, parse_twilio_error(body), data.get("sid")

    msg_status = (data.get("status") or "").lower()
    sid = data.get("sid")
    if msg_status in ("failed", "undelivered"):
        return False, parse_twilio_error(body) or f"Twilio status={msg_status}", sid

    detail = f"قُبلت من Twilio ({msg_status or 'accepted'})"
    if msg_status == "queued":
        detail += " — جارٍ التحقق من التسليم…"
    if sid:
        detail += f" [{sid}]"
    return True, detail, sid


def _twilio_fetch_message(cred, sid: str) -> dict | None:
    """جلب حالة رسالة من Twilio Messages API."""
    if not sid or not cred.api_key or not cred.api_secret:
        return None
    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/{cred.api_key}/Messages/{sid}.json"
    )
    token = base64.b64encode(f"{cred.api_key}:{cred.api_secret}".encode()).decode()
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, OSError, TimeoutError) as exc:
        logger.warning("Twilio fetch message failed sid=%s err=%s", sid, exc)
        return None


def confirm_twilio_delivery(
    cred,
    sid: str | None,
    *,
    timeout_sec: float = 10.0,
    interval_sec: float = 0.9,
) -> tuple[bool, str]:
    """ينتظر نتيجة التسليم بعد قبول الطلب — يُظهر رمز الخطأ إن فشل.

    الرسائل الفاشلة تظهر غالباً خلال ثانية؛ ننتظر حتى الحالة النهائية أو انتهاء المهلة.
    """
    if not sid:
        return True, "قُبلت من Twilio (بدون SID للتحقق)"

    deadline = time.monotonic() + timeout_sec
    last_status = "queued"
    while time.monotonic() < deadline:
        data = _twilio_fetch_message(cred, sid)
        if not data:
            time.sleep(interval_sec)
            continue
        last_status = (data.get("status") or "").lower()
        err_code = data.get("error_code")
        err_msg = data.get("error_message") or data.get("message")
        if last_status in ("failed", "undelivered"):
            detail = format_twilio_error_code(err_code, err_msg)
            return False, f"{detail} [{sid}]"
        # delivered/read = نجاح مؤكد؛ sent قد يفشل لاحقاً لذلك ننتظر أكثر قليلاً
        if last_status in ("delivered", "read"):
            return True, f"تم التسليم عبر Twilio ({last_status}) [{sid}]"
        # بعد وصول الحالة sent نتحقق مرة أو مرتين إضافيتين لالتقاط فشل سريع
        if last_status == "sent" and time.monotonic() + interval_sec * 2 >= deadline:
            return True, f"أُرسلت عبر Twilio (sent) [{sid}]"
        time.sleep(interval_sec)

    # لم تكتمل بعد — لا نعتبرها فشلاً قاطعاً لكن ننبّه
    return True, (
        f"قُبلت من Twilio وما زالت {last_status or 'قيد الانتظار'} "
        f"— إن فشلت لاحقاً ستظهر في Messaging Logs [{sid}]"
    )


def fetch_twilio_content(cred, content_sid: str) -> dict | None:
    """جلب تعريف قالب Content من Twilio (المتغيرات والأنواع)."""
    if not content_sid or not cred or not cred.api_key or not cred.api_secret:
        return None
    url = f"https://content.twilio.com/v1/Content/{content_sid}"
    token = base64.b64encode(f"{cred.api_key}:{cred.api_secret}".encode()).decode()
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, OSError, TimeoutError) as exc:
        logger.warning("Twilio fetch content failed sid=%s err=%s", content_sid, exc)
        return None


def twilio_content_variable_keys(content: dict | None) -> list[str]:
    """مفاتيح المتغيرات المتوقعة عند الإرسال.

    المصدر الأساسي: حقل ``variables`` في تعريف Content (هذا ما يطابق 63028).
    إن كان فارغاً نمسح ``{{n}}`` من أنواع القالب.
    """
    if not content:
        return []
    keys: set[str] = set()
    declared = content.get("variables") or {}
    if isinstance(declared, dict) and declared:
        keys.update(str(k) for k in declared.keys())
    else:
        blob = json.dumps(content.get("types") or {}, ensure_ascii=False)
        keys.update(re.findall(r"\{\{(\w+)\}\}", blob))

    def _sort_key(k: str):
        return (0, int(k)) if k.isdigit() else (1, k)

    return sorted(keys, key=_sort_key)


def align_twilio_content_variables(
    variables: dict[str, str],
    template_keys: list[str],
) -> tuple[dict[str, str], str]:
    """يطابق ContentVariables مع ما يعرّفه القالب لتفادي 63028."""
    if not template_keys:
        return dict(variables), ""
    aligned: dict[str, str] = {}
    for key in template_keys:
        raw = variables.get(key)
        if raw is None or str(raw).strip() == "":
            aligned[key] = "-"
        else:
            aligned[key] = " ".join(str(raw).split()) or "-"
    note = ""
    if set(variables.keys()) != set(aligned.keys()):
        note = (
            f"طُبّقت متغيرات القالب n={len(aligned)} "
            f"(الكود جهّز n={len(variables)}): {{{','.join(template_keys)}}}"
        )
        logger.info(
            "Twilio ContentVariables aligned prepared=%s expect=%s",
            sorted(variables.keys()),
            template_keys,
        )
    return aligned, note


def _log_twilio_result(action: str, phone: str, status_code: int, body: str) -> None:
    sent, detail, sid = evaluate_twilio_send_response(status_code, body)
    if sent:
        logger.info("Twilio %s accepted to=%s http=%s sid=%s %s", action, phone, status_code, sid, detail)
    else:
        logger.warning(
            "Twilio %s rejected to=%s http=%s sid=%s err=%s",
            action,
            phone,
            status_code,
            sid,
            detail,
        )

META_TEMPLATE_INVITATION = "event_invitation"
META_TEMPLATE_REMINDER = "event_reminder"
META_TEMPLATE_LANGUAGE = "ar"


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


def _active_cloud_credential():
    """اعتماد WhatsApp Cloud API نشط ومكتمل الحقول، أو None."""
    cred = (
        IntegrationCredential.objects.filter(
            provider=IntegrationCredential.Provider.WHATSAPP_CLOUD,
            is_active=True,
        )
        .order_by("-updated_at")
        .first()
    )
    if cred and cred.api_key and cred.phone_number_id:
        return cred
    return None


def _active_twilio_credential():
    """اعتماد Twilio WhatsApp نشط ومكتمل الحقول، أو None."""
    cred = (
        IntegrationCredential.objects.filter(
            provider=IntegrationCredential.Provider.WHATSAPP_TWILIO,
            is_active=True,
        )
        .order_by("-updated_at")
        .first()
    )
    if cred and cred.api_key and cred.api_secret and cred.phone_number_id:
        return cred
    return None


def has_active_whatsapp_credential() -> bool:
    """هل يوجد اعتماد رسمي نشط (Cloud API أو Twilio) جاهز للإرسال؟"""
    return bool(_active_cloud_credential() or _active_twilio_credential())


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

    cloud_cred = _active_cloud_credential()
    if cloud_cred:
        return _send_cloud_api(cloud_cred, digits, text, fallback_url)

    twilio_cred = _active_twilio_credential()
    if twilio_cred:
        return _send_twilio_whatsapp(twilio_cred, digits, text, fallback_url)

    if not has_active_whatsapp_credential():
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "لم يُكوَّن WhatsApp API — استخدم رابط واتساب",
        }

    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": "لم يُكوَّن WhatsApp API — استخدم رابط واتساب",
    }


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


def send_whatsapp_template(
    phone: str,
    template_name: str,
    body_params: list[str],
    language: str = "ar",
    fallback_url: str = "",
) -> dict:
    """إرسال قالب Meta معتمد (Cloud API).

    ``body_params`` تُطابق {{1}}, {{2}}, ... في جسم القالب.
    """
    digits = normalize_phone_digits(phone)
    if not digits or not template_name:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "بيانات القالب غير مكتملة",
        }

    cred = _active_cloud_credential()
    if not cred:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "لا يوجد اعتماد WhatsApp Cloud API نشط",
        }

    url = f"https://graph.facebook.com/v18.0/{cred.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {cred.api_key}",
        "Content-Type": "application/json",
    }
    parameters = [{"type": "text", "text": str(p)} for p in body_params]
    payload = {
        "messaging_product": "whatsapp",
        "to": digits,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
            "components": [{"type": "body", "parameters": parameters}],
        },
    }
    status_code, body = _http_post_json(url, payload, headers)
    if status_code in (200, 201):
        return {
            "sent": True,
            "whatsapp_url": fallback_url,
            "detail": f"تم الإرسال عبر قالب Meta: {template_name}",
            "template": template_name,
        }
    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": body[:300] or "فشل إرسال قالب Meta",
    }


def send_twilio_content_template(
    phone: str,
    content_sid: str,
    variables: dict[str, str],
    fallback_url: str = "",
) -> dict:
    """إرسال قالب واتساب عبر Twilio Content API (ContentSid)."""
    digits = normalize_phone_digits(phone)
    cred = _active_twilio_credential()
    if not cred or not content_sid:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "لا يوجد اعتماد Twilio أو ContentSid",
        }

    from_number = cred.phone_number_id.strip()
    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:+{normalize_phone_digits(from_number)}"
    to_number = f"whatsapp:+{digits}"

    # مطابقة المتغيرات مع تعريف القالب في Twilio (يمنع 63028)
    content_def = fetch_twilio_content(cred, content_sid)
    template_keys = twilio_content_variable_keys(content_def)
    aligned, align_note = align_twilio_content_variables(variables, template_keys)
    payload_vars = aligned

    api_url = (
        f"https://api.twilio.com/2010-04-01/Accounts/{cred.api_key}/Messages.json"
    )
    form = {
        "From": from_number,
        "To": to_number,
        "ContentSid": content_sid,
        "ContentVariables": json.dumps(payload_vars, ensure_ascii=False),
    }
    status_code, body = _http_post_form(
        api_url, form, (cred.api_key, cred.api_secret)
    )
    var_keys = ",".join(
        sorted(payload_vars.keys(), key=lambda k: int(k) if str(k).isdigit() else 0)
    )
    vars_hint = f" [SID={content_sid} vars={{{var_keys}}} n={len(payload_vars)}]"
    if align_note:
        vars_hint += f" ({align_note})"
    if content_def is None:
        vars_hint += " (تعذّر جلب تعريف القالب من Twilio)"
    _log_twilio_result(f"content:{content_sid}", phone, status_code, body)
    sent, detail, sid = evaluate_twilio_send_response(status_code, body)
    if not sent:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": f"{detail}{vars_hint}",
            "twilio_sid": sid,
            "template": content_sid,
        }

    # التحقق من التسليم الفعلي (أخطاء مثل 63013 تظهر بعد القبول)
    verify_ok, verify_detail = confirm_twilio_delivery(cred, sid)
    if not verify_ok:
        logger.warning(
            "Twilio content delivery failed sid=%s to=%s detail=%s",
            sid,
            phone,
            verify_detail,
        )
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": f"{verify_detail}{vars_hint}",
            "template": content_sid,
            "twilio_sid": sid,
        }
    return {
        "sent": True,
        "whatsapp_url": fallback_url,
        "detail": verify_detail + (f" — {align_note}" if align_note else ""),
        "template": content_sid,
        "twilio_sid": sid,
    }


def send_whatsapp_image(
    phone: str,
    image_url: str,
    caption: str = "",
    fallback_url: str = "",
) -> dict:
    """إرسال صورة (مثل QR) عبر Cloud API أو Twilio."""
    digits = normalize_phone_digits(phone)
    if not digits or not image_url:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": "رقم أو رابط الصورة غير متوفر",
        }

    cloud_cred = _active_cloud_credential()
    if cloud_cred:
        url = f"https://graph.facebook.com/v18.0/{cloud_cred.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {cloud_cred.api_key}",
            "Content-Type": "application/json",
        }
        image_payload: dict = {"link": image_url}
        if caption:
            image_payload["caption"] = caption
        payload = {
            "messaging_product": "whatsapp",
            "to": digits,
            "type": "image",
            "image": image_payload,
        }
        status_code, body = _http_post_json(url, payload, headers)
        if status_code in (200, 201):
            return {
                "sent": True,
                "whatsapp_url": fallback_url,
                "detail": "تم إرسال صورة QR عبر WhatsApp Cloud API",
            }
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": body[:300] or "فشل إرسال الصورة",
        }

    twilio_cred = _active_twilio_credential()
    if twilio_cred:
        from_number = twilio_cred.phone_number_id.strip()
        if not from_number.startswith("whatsapp:"):
            from_number = f"whatsapp:+{normalize_phone_digits(from_number)}"
        to_number = f"whatsapp:+{digits}"
        api_url = (
            f"https://api.twilio.com/2010-04-01/Accounts/{twilio_cred.api_key}/Messages.json"
        )
        form = {"From": from_number, "To": to_number, "MediaUrl": image_url}
        if caption:
            form["Body"] = caption
        status_code, body = _http_post_form(
            api_url, form, (twilio_cred.api_key, twilio_cred.api_secret)
        )
        _log_twilio_result(f"image:{image_url[:120]}", phone, status_code, body)
        sent, detail, sid = evaluate_twilio_send_response(status_code, body)
        if not sent:
            return {
                "sent": False,
                "whatsapp_url": fallback_url,
                "detail": detail or (body[:300] if body else "فشل إرسال الصورة عبر Twilio"),
                "media_url": image_url,
                "twilio_sid": sid,
            }
        verify_ok, verify_detail = confirm_twilio_delivery(twilio_cred, sid)
        if not verify_ok:
            return {
                "sent": False,
                "whatsapp_url": fallback_url,
                "detail": verify_detail,
                "media_url": image_url,
                "twilio_sid": sid,
            }
        return {
            "sent": True,
            "whatsapp_url": fallback_url,
            "detail": verify_detail or "تم إرسال صورة QR عبر Twilio",
            "twilio_sid": sid,
            "media_url": image_url,
        }

    return {
        "sent": False,
        "whatsapp_url": fallback_url,
        "detail": "لا يوجد مزوّد لإرسال الصور",
    }


def send_via_bot_image(
    phone: str, image_bytes: bytes, caption: str = ""
) -> dict:
    """إرسال صورة PNG عبر بوت الاختبار (base64)."""
    digits = normalize_phone_digits(phone)
    if not digits or not image_bytes:
        return {"sent": False, "detail": "رقم أو صورة غير متوفرة"}

    url = f"{settings.WHATSAPP_BOT_URL}/send-image"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.WHATSAPP_BOT_TOKEN}",
    }
    payload = {
        "to": digits,
        "image_base64": base64.b64encode(image_bytes).decode("ascii"),
        "mimetype": "image/png",
        "caption": caption,
    }
    status_code, body = _http_post_json(url, payload, headers)
    if status_code in (200, 201, 202):
        return {
            "sent": True,
            "queued": True,
            "detail": "تمت إضافة صورة QR لطابور البوت",
        }
    return {
        "sent": False,
        "detail": (body[:200] if body else "تعذّر إرسال الصورة عبر البوت")
        or "تعذّر إرسال الصورة عبر البوت",
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

    # اعتماد رسمي نشط (Twilio/Cloud) يتقدّم تلقائياً على البوت — دون الحاجة
    # لتعديل WHATSAPP_PROVIDER يدوياً. الوضع اليدوي (manual) يبقى صريحاً.
    if provider != "manual" and has_active_whatsapp_credential():
        return send_whatsapp_text(phone, text)

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
    _log_twilio_result("text", digits, status_code, body)
    sent, detail, sid = evaluate_twilio_send_response(status_code, body)
    if not sent:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": detail,
            "twilio_sid": sid,
        }
    verify_ok, verify_detail = confirm_twilio_delivery(cred, sid)
    if not verify_ok:
        return {
            "sent": False,
            "whatsapp_url": fallback_url,
            "detail": verify_detail,
            "twilio_sid": sid,
        }
    return {
        "sent": True,
        "whatsapp_url": fallback_url,
        "detail": verify_detail,
        "twilio_sid": sid,
    }
