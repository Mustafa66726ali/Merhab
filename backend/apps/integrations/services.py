"""خدمات التكاملات: إخفاء المفاتيح واختبار الاتصال."""

from django.utils import timezone

from apps.integrations.models import IntegrationCredential


def mask_secret(value: str, visible: int = 4) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if len(raw) <= visible:
        return "••••"
    return "••••••••" + raw[-visible:]


PROVIDER_META = {
    IntegrationCredential.Provider.WHATSAPP_CLOUD: {
        "category": IntegrationCredential.Category.MESSAGING,
        "icon": "chat",
        "color": "#25D366",
        "fields": ["api_key", "phone_number_id", "business_account_id", "webhook_url", "webhook_secret"],
        "help": "مفتاح WhatsApp Cloud API من Meta Business Suite",
    },
    IntegrationCredential.Provider.WHATSAPP_TWILIO: {
        "category": IntegrationCredential.Category.MESSAGING,
        "icon": "chat",
        "color": "#F22F46",
        "fields": ["api_key", "api_secret", "phone_number_id"],
        "help": "Account SID و Auth Token من Twilio",
    },
    IntegrationCredential.Provider.EMAIL_SMTP: {
        "category": IntegrationCredential.Category.EMAIL,
        "icon": "mail",
        "color": "#5b2eff",
        "fields": ["smtp_host", "smtp_port", "smtp_use_tls", "api_key", "from_email", "from_name"],
        "help": "إعدادات SMTP لإرسال رسائل استعادة كلمة المرور والإشعارات",
    },
    IntegrationCredential.Provider.EMAIL_SENDGRID: {
        "category": IntegrationCredential.Category.EMAIL,
        "icon": "mail",
        "color": "#1A82E2",
        "fields": ["api_key", "from_email", "from_name"],
        "help": "API Key من SendGrid",
    },
    IntegrationCredential.Provider.EMAIL_MAILGUN: {
        "category": IntegrationCredential.Category.EMAIL,
        "icon": "mail",
        "color": "#F06B66",
        "fields": ["api_key", "from_email", "from_name"],
        "help": "API Key من Mailgun",
    },
    IntegrationCredential.Provider.SMS_TWILIO: {
        "category": IntegrationCredential.Category.SMS,
        "icon": "sms",
        "color": "#F22F46",
        "fields": ["api_key", "api_secret", "phone_number_id"],
        "help": "Twilio SMS credentials",
    },
    IntegrationCredential.Provider.SMS_UNIFONIC: {
        "category": IntegrationCredential.Category.SMS,
        "icon": "sms",
        "color": "#00B386",
        "fields": ["api_key", "from_name"],
        "help": "App SID من Unifonic",
    },
    IntegrationCredential.Provider.PAYMENT_STRIPE: {
        "category": IntegrationCredential.Category.PAYMENT,
        "icon": "payments",
        "color": "#635BFF",
        "fields": ["api_key", "api_secret", "webhook_secret"],
        "help": "Publishable/Secret keys من Stripe",
    },
    IntegrationCredential.Provider.PAYMENT_MOYASAR: {
        "category": IntegrationCredential.Category.PAYMENT,
        "icon": "payments",
        "color": "#00C48C",
        "fields": ["api_key", "webhook_secret"],
        "help": "API Key من Moyasar",
    },
    IntegrationCredential.Provider.MAPS_GOOGLE: {
        "category": IntegrationCredential.Category.MAPS,
        "icon": "map",
        "color": "#4285F4",
        "fields": ["api_key"],
        "help": "Google Maps Platform API Key",
    },
    IntegrationCredential.Provider.STORAGE_S3: {
        "category": IntegrationCredential.Category.STORAGE,
        "icon": "cloud",
        "color": "#FF9900",
        "fields": ["api_key", "api_secret", "config"],
        "help": "AWS Access Key و Secret",
    },
    IntegrationCredential.Provider.FIREBASE: {
        "category": IntegrationCredential.Category.PUSH,
        "icon": "local_fire_department",
        "color": "#FFCA28",
        "fields": ["api_key", "config"],
        "help": "Firebase Server Key أو Service Account",
    },
    IntegrationCredential.Provider.PUSH_ONESIGNAL: {
        "category": IntegrationCredential.Category.PUSH,
        "icon": "notifications_active",
        "color": "#E54B4D",
        "fields": ["api_key", "api_secret"],
        "help": "OneSignal App ID و REST API Key",
    },
    IntegrationCredential.Provider.CUSTOM: {
        "category": IntegrationCredential.Category.OTHER,
        "icon": "extension",
        "color": "#928ea3",
        "fields": ["api_key", "api_secret", "access_token", "webhook_url", "config"],
        "help": "تكامل مخصص — أدخل المفاتيح المطلوبة",
    },
}


def get_providers_catalog() -> list[dict]:
    catalog = []
    for value, label in IntegrationCredential.Provider.choices:
        meta = PROVIDER_META.get(value, {})
        catalog.append({
            "value": value,
            "label": label,
            "category": meta.get("category", IntegrationCredential.Category.OTHER),
            "category_label": dict(IntegrationCredential.Category.choices).get(
                meta.get("category", IntegrationCredential.Category.OTHER), ""
            ),
            "icon": meta.get("icon", "extension"),
            "color": meta.get("color", "#928ea3"),
            "fields": meta.get("fields", ["api_key"]),
            "help": meta.get("help", ""),
        })
    return catalog


def test_integration(credential: IntegrationCredential) -> tuple[bool, str]:
    """اختبار أساسي للتحقق من اكتمال الحقول المطلوبة."""
    provider = credential.provider
    meta = PROVIDER_META.get(provider, {})
    required_map = {
        IntegrationCredential.Provider.WHATSAPP_CLOUD: lambda c: c.api_key and c.phone_number_id,
        IntegrationCredential.Provider.WHATSAPP_TWILIO: lambda c: c.api_key and c.api_secret,
        IntegrationCredential.Provider.EMAIL_SMTP: lambda c: c.smtp_host and c.smtp_port and c.api_key and c.from_email,
        IntegrationCredential.Provider.EMAIL_SENDGRID: lambda c: c.api_key and c.from_email,
        IntegrationCredential.Provider.EMAIL_MAILGUN: lambda c: c.api_key and c.from_email,
        IntegrationCredential.Provider.SMS_TWILIO: lambda c: c.api_key and c.api_secret,
        IntegrationCredential.Provider.SMS_UNIFONIC: lambda c: c.api_key,
        IntegrationCredential.Provider.PAYMENT_STRIPE: lambda c: c.api_key and c.api_secret,
        IntegrationCredential.Provider.PAYMENT_MOYASAR: lambda c: c.api_key,
        IntegrationCredential.Provider.MAPS_GOOGLE: lambda c: c.api_key,
        IntegrationCredential.Provider.STORAGE_S3: lambda c: c.api_key and c.api_secret,
        IntegrationCredential.Provider.FIREBASE: lambda c: c.api_key,
        IntegrationCredential.Provider.PUSH_ONESIGNAL: lambda c: c.api_key and c.api_secret,
        IntegrationCredential.Provider.CUSTOM: lambda c: c.api_key,
    }
    checker = required_map.get(provider, lambda c: c.api_key)
    if not checker(credential):
        return False, "بعض الحقول المطلوبة غير مكتملة — راجع إعدادات التكامل"

    if provider == IntegrationCredential.Provider.EMAIL_SMTP:
        from apps.integrations.email_send import send_smtp_email

        test_to = credential.from_email
        if not test_to:
            return False, "أدخل البريد المرسل للاختبار"
        ok, msg = send_smtp_email(
            credential,
            test_to,
            "اختبار بريد مرحّاب",
            "تم إعداد بريد الاستعادة بنجاح.\n— مرحّاب",
        )
        return ok, msg if ok else msg

    return True, "تم التحقق من اكتمال الحقول المطلوبة بنجاح"


def run_test_and_save(credential: IntegrationCredential) -> dict:
    ok, message = test_integration(credential)
    credential.last_tested_at = timezone.now()
    credential.last_test_status = (
        IntegrationCredential.TestStatus.SUCCESS if ok else IntegrationCredential.TestStatus.FAILED
    )
    credential.last_test_error = "" if ok else message
    credential.save(
        update_fields=["last_tested_at", "last_test_status", "last_test_error", "updated_at"]
    )
    return {"success": ok, "message": message, "tested_at": credential.last_tested_at}


def compute_stats() -> dict:
    qs = IntegrationCredential.objects.all()
    total = qs.count()
    active = qs.filter(is_active=True).count()
    tested_ok = qs.filter(last_test_status=IntegrationCredential.TestStatus.SUCCESS).count()
    failed = qs.filter(last_test_status=IntegrationCredential.TestStatus.FAILED).count()
    by_category = {}
    for cat_value, cat_label in IntegrationCredential.Category.choices:
        by_category[cat_value] = {
            "label": cat_label,
            "count": qs.filter(category=cat_value).count(),
            "active": qs.filter(category=cat_value, is_active=True).count(),
        }
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "tested_ok": tested_ok,
        "test_failed": failed,
        "never_tested": qs.filter(last_test_status=IntegrationCredential.TestStatus.NEVER).count(),
        "by_category": by_category,
    }
