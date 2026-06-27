from django.conf import settings
from django.db import models
from django.utils import timezone


class IntegrationCredential(models.Model):
    class Provider(models.TextChoices):
        WHATSAPP_CLOUD = "whatsapp_cloud", "WhatsApp Business API"
        WHATSAPP_TWILIO = "whatsapp_twilio", "WhatsApp (Twilio)"
        EMAIL_SMTP = "email_smtp", "البريد الإلكتروني (SMTP)"
        EMAIL_SENDGRID = "email_sendgrid", "SendGrid"
        EMAIL_MAILGUN = "email_mailgun", "Mailgun"
        SMS_TWILIO = "sms_twilio", "Twilio SMS"
        SMS_UNIFONIC = "sms_unifonic", "Unifonic"
        PAYMENT_STRIPE = "payment_stripe", "Stripe"
        PAYMENT_MOYASAR = "payment_moyasar", "Moyasar"
        MAPS_GOOGLE = "maps_google", "Google Maps"
        STORAGE_S3 = "storage_s3", "AWS S3"
        FIREBASE = "firebase", "Firebase"
        PUSH_ONESIGNAL = "push_onesignal", "OneSignal"
        CUSTOM = "custom", "تكامل مخصص"

    class Category(models.TextChoices):
        MESSAGING = "messaging", "الرسائل والواتساب"
        EMAIL = "email", "البريد الإلكتروني"
        SMS = "sms", "الرسائل النصية"
        PAYMENT = "payment", "الدفع"
        MAPS = "maps", "الخرائط"
        STORAGE = "storage", "التخزين"
        PUSH = "push", "الإشعارات الفورية"
        OTHER = "other", "أخرى"

    class Environment(models.TextChoices):
        SANDBOX = "sandbox", "تجريبي"
        PRODUCTION = "production", "إنتاج"

    class TestStatus(models.TextChoices):
        NEVER = "never", "لم يُختبر"
        SUCCESS = "success", "ناجح"
        FAILED = "failed", "فشل"

    provider = models.CharField(
        max_length=40,
        choices=Provider.choices,
        verbose_name="المزود",
    )
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        verbose_name="الفئة",
    )
    name = models.CharField(max_length=255, verbose_name="الاسم")
    description = models.TextField(blank=True, verbose_name="الوصف")
    environment = models.CharField(
        max_length=20,
        choices=Environment.choices,
        default=Environment.PRODUCTION,
        verbose_name="البيئة",
    )
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    is_primary = models.BooleanField(default=False, verbose_name="أساسي للفئة")

    api_key = models.CharField(max_length=512, blank=True, verbose_name="مفتاح API")
    api_secret = models.CharField(max_length=512, blank=True, verbose_name="سر API")
    access_token = models.CharField(max_length=512, blank=True, verbose_name="رمز الوصول")
    refresh_token = models.CharField(max_length=512, blank=True, verbose_name="رمز التحديث")

    phone_number_id = models.CharField(max_length=100, blank=True, verbose_name="معرف رقم الهاتف")
    business_account_id = models.CharField(max_length=100, blank=True, verbose_name="معرف الحساب التجاري")

    from_email = models.EmailField(blank=True, verbose_name="البريد المرسل")
    from_name = models.CharField(max_length=255, blank=True, verbose_name="اسم المرسل")
    smtp_host = models.CharField(max_length=255, blank=True, verbose_name="خادم SMTP")
    smtp_port = models.PositiveIntegerField(null=True, blank=True, verbose_name="منفذ SMTP")
    smtp_use_tls = models.BooleanField(default=True, verbose_name="TLS")

    webhook_url = models.URLField(blank=True, verbose_name="رابط Webhook")
    webhook_secret = models.CharField(max_length=255, blank=True, verbose_name="سر Webhook")

    config = models.JSONField(default=dict, blank=True, verbose_name="إعدادات إضافية")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")

    last_tested_at = models.DateTimeField(null=True, blank=True, verbose_name="آخر اختبار")
    last_test_status = models.CharField(
        max_length=20,
        choices=TestStatus.choices,
        default=TestStatus.NEVER,
        verbose_name="نتيجة الاختبار",
    )
    last_test_error = models.TextField(blank=True, verbose_name="خطأ الاختبار")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_integrations",
        verbose_name="أنشئ بواسطة",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "تكامل خارجي"
        verbose_name_plural = "التكاملات الخارجية"
        ordering = ["-is_primary", "-is_active", "-updated_at"]

    def __str__(self):
        return self.name
