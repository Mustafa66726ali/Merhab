import uuid

from django.db import models
from django.conf import settings
from apps.events.models import Event, Section, Group


class Guest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "جديد"
        INVITED = "invited", "مدعو"
        CONFIRMED = "confirmed", "مؤكد الحضور"
        ATTENDED = "attended", "حضر"
        SEATED = "seated", "جلس"
        DECLINED = "declined", "معتذر"
        CANCELLED = "cancelled", "ملغي"

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="guests", verbose_name="الفعالية"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="guest_profiles",
        verbose_name="المستخدم",
    )
    full_name = models.CharField(max_length=255, verbose_name="الاسم الكامل")
    email = models.EmailField(blank=True, verbose_name="البريد الإلكتروني")
    phone = models.CharField(max_length=20, blank=True, verbose_name="رقم الهاتف")
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="الحالة",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="guests",
        verbose_name="القسم",
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="guests",
        verbose_name="المجموعة",
    )
    qr_code = models.ImageField(upload_to="qr_codes/", blank=True, verbose_name="رمز QR")
    public_token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        verbose_name="رمز الدعوة الفريد",
        help_text="معرّف فريد لكل ضيف يُستخدم في رابط الدعوة العام وفي رمز QR",
    )
    responded_at = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الرد على الدعوة"
    )
    reminder_opted_in = models.BooleanField(
        default=False,
        verbose_name="وافق على التذكير المسبق",
        help_text="نعم ذكرني — يُجدول التذكير ورمز QR قبل المناسبة بيوم",
    )
    reminder_scheduled_for = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="موعد إرسال التذكير المجدول",
    )
    reminder_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ إرسال التذكير المجدول",
    )
    greeting = models.TextField(blank=True, verbose_name="كلمة تهنئة من الضيف")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    dietary_requirements = models.TextField(blank=True, verbose_name="متطلبات غذائية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "ضيف"
        verbose_name_plural = "الضيوف"
        ordering = ["full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["event", "email"],
                condition=models.Q(email__gt=""),
                name="unique_guest_email_per_event",
            ),
            models.UniqueConstraint(
                fields=["event", "phone"],
                condition=models.Q(phone__gt=""),
                name="unique_guest_phone_per_event",
            ),
        ]
        indexes = [
            models.Index(fields=["event", "status"]),
            models.Index(fields=["event", "created_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["reminder_scheduled_for", "reminder_sent_at"]),
        ]

    def __str__(self):
        return self.full_name


class GuestQrScanLog(models.Model):
    """سجل عمليات مسح QR / تسجيل الحضور."""

    guest = models.ForeignKey(
        Guest,
        on_delete=models.CASCADE,
        related_name="qr_scan_logs",
        verbose_name="الضيف",
    )
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="qr_scan_logs",
        verbose_name="الفعالية",
    )
    scanner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="qr_scans_performed",
        verbose_name="المسح بواسطة",
    )
    scanned_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="وقت المسح")

    class Meta:
        verbose_name = "سجل مسح QR"
        verbose_name_plural = "سجلات مسح QR"
        ordering = ["-scanned_at"]

    def __str__(self):
        return f"مسح {self.guest_id} — {self.scanned_at}"
