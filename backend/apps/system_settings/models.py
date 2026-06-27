from django.db import models


class SystemSettings(models.Model):
    class Language(models.TextChoices):
        AR_SA = "ar_SA", "العربية (المملكة العربية السعودية)"
        EN_GB = "en_GB", "English (United Kingdom)"

    class Timezone(models.TextChoices):
        RIYADH = "Asia/Riyadh", "(GMT+03:00) الرياض"
        DUBAI = "Asia/Dubai", "(GMT+04:00) دبي"

    class QrValidity(models.TextChoices):
        HOURS_48 = "48h", "48 ساعة"
        WEEK = "7d", "أسبوع واحد"
        OPEN = "open", "مفتوح (بدون انتهاء)"

    class TicketFormat(models.TextChoices):
        DIGITAL = "digital", "بطاقة رقمية (Standard)"
        PDF = "pdf", "ملف PDF"
        WEB = "web", "رابط ويب فقط"

    platform_name = models.CharField(max_length=120, default="مرحّاب", verbose_name="اسم المنصة")
    logo = models.ImageField(upload_to="system/", blank=True, null=True, verbose_name="شعار المنصة")
    default_language = models.CharField(
        max_length=10,
        choices=Language.choices,
        default=Language.AR_SA,
        verbose_name="اللغة الافتراضية",
    )
    timezone = models.CharField(
        max_length=40,
        choices=Timezone.choices,
        default=Timezone.RIYADH,
        verbose_name="المنطقة الزمنية",
    )
    theme_primary = models.CharField(max_length=7, default="#5b2eff", verbose_name="اللون الأساسي")

    notify_email = models.BooleanField(default=True, verbose_name="إشعارات البريد")
    notify_sms = models.BooleanField(default=False, verbose_name="إشعارات SMS")
    notify_whatsapp = models.BooleanField(default=True, verbose_name="إشعارات واتساب")
    notify_push = models.BooleanField(default=True, verbose_name="إشعارات التطبيق")
    notify_system_alerts = models.BooleanField(default=True, verbose_name="تنبيهات النظام")

    qr_validity = models.CharField(
        max_length=10,
        choices=QrValidity.choices,
        default=QrValidity.HOURS_48,
        verbose_name="مدة صلاحية QR",
    )
    rsvp_auto_enabled = models.BooleanField(default=True, verbose_name="تفعيل RSVP تلقائياً")
    high_res_headers_only = models.BooleanField(default=False, verbose_name="صور ترويسة عالية الدقة فقط")
    ticket_format = models.CharField(
        max_length=20,
        choices=TicketFormat.choices,
        default=TicketFormat.DIGITAL,
        verbose_name="تنسيق التذاكر",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "إعدادات النظام"
        verbose_name_plural = "إعدادات النظام"

    def __str__(self):
        return self.platform_name

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
