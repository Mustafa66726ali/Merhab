from django.db import models
from django.conf import settings


class Event(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        ACTIVE = "active", "نشط"
        COMPLETED = "completed", "مكتمل"
        CANCELLED = "cancelled", "ملغي"
        ARCHIVED = "archived", "مؤرشف"

    title = models.CharField(max_length=255, verbose_name="العنوان")
    description = models.TextField(blank=True, verbose_name="الوصف")
    date = models.DateField(verbose_name="التاريخ")
    time = models.TimeField(verbose_name="الوقت")
    end_date = models.DateField(blank=True, null=True, verbose_name="تاريخ الانتهاء")
    end_time = models.TimeField(blank=True, null=True, verbose_name="وقت الانتهاء")
    venue = models.CharField(max_length=255, blank=True, verbose_name="المكان")
    geo_address = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="الموقع الجغرافي (نص)",
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="خط العرض",
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="خط الطول",
    )
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="الحالة",
    )
    max_guests = models.PositiveIntegerField(default=0, verbose_name="الحد الأقصى للضيوف")
    cover_image = models.ImageField(upload_to="events/", blank=True, verbose_name="صورة الغلاف")
    invitation_title = models.CharField(
        max_length=255, blank=True, verbose_name="عنوان الدعوة"
    )
    invitation_message = models.TextField(
        blank=True,
        verbose_name="نص الدعوة الافتراضي",
        help_text="يدعم الحقول: {name} {event} {date} {time} {venue} {link}",
    )
    auto_reminder_enabled = models.BooleanField(
        default=False,
        verbose_name="تفعيل التذكير التلقائي قبل الحفل",
        help_text="يتطلّب مزوّداً رسمياً نشطاً (Twilio/Cloud) ليُرسل تلقائياً.",
    )
    auto_reminder_hours_before = models.PositiveSmallIntegerField(
        default=3,
        verbose_name="عدد الساعات قبل الحفل لإرسال التذكير",
    )
    auto_reminder_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت إرسال التذكير التلقائي",
        help_text="يُضبط تلقائياً عند الإرسال لمنع التكرار.",
    )
    platform = models.ForeignKey(
        "platforms.Platform",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
        verbose_name="المنصة",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_events",
        verbose_name="أنشئ بواسطة",
    )
    managers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="managed_events",
        blank=True,
        verbose_name="المدراء",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "فعالية"
        verbose_name_plural = "الفعاليات"
        ordering = ["-date", "-time"]
        indexes = [
            models.Index(fields=["platform", "status"]),
            models.Index(fields=["platform", "-created_at"]),
            models.Index(fields=["status", "date"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return self.title


class Section(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="sections",
        verbose_name="الفعالية",
    )
    name = models.CharField(max_length=255, verbose_name="الاسم")
    description = models.TextField(blank=True, verbose_name="الوصف")
    location = models.CharField(max_length=255, blank=True, verbose_name="الموقع")
    color = models.CharField(max_length=7, default="#5b2eff", verbose_name="اللون")
    order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "قسم"
        verbose_name_plural = "الأقسام"
        ordering = ["order"]

    def __str__(self):
        return f"{self.name} - {self.event.title}"


class Schedule(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="schedules",
        verbose_name="الفعالية",
    )
    title = models.CharField(max_length=255, verbose_name="العنوان")
    description = models.TextField(blank=True, verbose_name="الوصف")
    start_time = models.DateTimeField(verbose_name="وقت البداية")
    end_time = models.DateTimeField(verbose_name="وقت النهاية")
    location = models.CharField(max_length=255, blank=True, verbose_name="الموقع")
    order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")

    class Meta:
        verbose_name = "جدول"
        verbose_name_plural = "الجداول"
        ordering = ["start_time"]

    def __str__(self):
        return self.title


class Group(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="groups",
        verbose_name="الفعالية",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="groups",
        verbose_name="القسم",
    )
    name = models.CharField(max_length=255, verbose_name="الاسم")
    description = models.TextField(blank=True, verbose_name="الوصف")
    location = models.CharField(max_length=255, blank=True, verbose_name="الموقع")
    color = models.CharField(max_length=7, default="#5b2eff", verbose_name="اللون")

    class Meta:
        verbose_name = "مجموعة"
        verbose_name_plural = "المجموعات"

    def __str__(self):
        return self.name
