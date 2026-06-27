from django.conf import settings
from django.db import models


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "إنشاء"
        UPDATE = "update", "تحديث"
        DELETE = "delete", "حذف"
        LOGIN = "login", "تسجيل دخول"
        LOGOUT = "logout", "تسجيل خروج"
        VIEW = "view", "عرض"
        EXPORT = "export", "تصدير"
        IMPORT = "import", "استيراد"
        PUBLISH = "publish", "نشر"
        APPROVE = "approve", "موافقة"
        REJECT = "reject", "رفض"
        TEST = "test", "اختبار"
        SYSTEM = "system", "نظام"
        OTHER = "other", "أخرى"

    class Status(models.TextChoices):
        SUCCESS = "success", "نجاح"
        FAILURE = "failure", "فشل"
        WARNING = "warning", "تحذير"

    class Category(models.TextChoices):
        AUTH = "auth", "المصادقة"
        EVENTS = "events", "الفعاليات"
        GUESTS = "guests", "الضيوف"
        PLATFORMS = "platforms", "المنصات"
        INTEGRATIONS = "integrations", "التكاملات"
        STATIC_PAGES = "static_pages", "الصفحات الثابتة"
        EXTERNAL_LINKS = "external_links", "الروابط الخارجية"
        PUBLIC_MEDIA = "public_media", "الوسائط والهبوط"
        ANNOUNCEMENTS = "announcements", "الإعلانات"
        FAQ = "faq", "الأسئلة"
        REPORTS = "reports", "التقارير"
        STAFF = "staff", "الطاقم"
        MESSAGES = "messages", "الرسائل"
        MONITORING = "monitoring", "المراقبة"
        SYSTEM = "system", "النظام"
        OTHER = "other", "أخرى"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        verbose_name="المستخدم",
    )
    user_email = models.CharField(max_length=255, blank=True, verbose_name="البريد")
    user_name = models.CharField(max_length=255, blank=True, verbose_name="الاسم")
    user_role = models.CharField(max_length=30, blank=True, verbose_name="الدور")

    action = models.CharField(max_length=20, choices=Action.choices, default=Action.OTHER)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUCCESS)

    object_type = models.CharField(max_length=120, blank=True, verbose_name="نوع العنصر")
    object_id = models.CharField(max_length=64, blank=True, verbose_name="معرّف العنصر")
    object_repr = models.CharField(max_length=500, blank=True, verbose_name="العنصر")

    description = models.TextField(blank=True, verbose_name="الوصف")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")

    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="IP")
    user_agent = models.CharField(max_length=500, blank=True, verbose_name="المتصفح")
    request_path = models.CharField(max_length=500, blank=True, verbose_name="المسار")
    request_method = models.CharField(max_length=10, blank=True, verbose_name="الطريقة")

    platform_id = models.PositiveIntegerField(null=True, blank=True, verbose_name="المنصة")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="التاريخ")

    class Meta:
        verbose_name = "سجل نشاط"
        verbose_name_plural = "سجلات النشاط"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at", "category"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_action_display()} — {self.object_repr or self.description[:40]}"
