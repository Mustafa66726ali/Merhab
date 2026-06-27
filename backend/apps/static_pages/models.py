from django.conf import settings
from django.db import models


class StaticPage(models.Model):
    class PageType(models.TextChoices):
        ABOUT_US = "about_us", "من نحن"
        PRIVACY_POLICY = "privacy_policy", "سياسة الخصوصية"
        TERMS_OF_USE = "terms_of_use", "شروط الاستخدام"
        COOKIE_POLICY = "cookie_policy", "سياسة ملفات تعريف الارتباط"
        REFUND_POLICY = "refund_policy", "سياسة الاسترداد"
        EVENT_GUIDELINES = "event_guidelines", "إرشادات المناسبات"
        GUEST_POLICY = "guest_policy", "سياسة الضيوف والحضور"
        CONTACT_INFO = "contact_info", "تواصل معنا"
        CUSTOM = "custom", "صفحة مخصصة"

    slug = models.SlugField(max_length=120, unique=True, verbose_name="المعرّف")
    page_type = models.CharField(
        max_length=30,
        choices=PageType.choices,
        default=PageType.CUSTOM,
        verbose_name="نوع الصفحة",
    )
    title = models.CharField(max_length=255, verbose_name="العنوان")
    subtitle = models.CharField(max_length=500, blank=True, verbose_name="العنوان الفرعي")
    content = models.TextField(verbose_name="المحتوى")
    meta_title = models.CharField(max_length=255, blank=True, verbose_name="عنوان SEO")
    meta_description = models.CharField(max_length=500, blank=True, verbose_name="وصف SEO")
    icon = models.CharField(max_length=64, blank=True, default="article", verbose_name="أيقونة")
    is_published = models.BooleanField(default=False, verbose_name="منشورة")
    show_in_footer = models.BooleanField(default=True, verbose_name="عرض في التذييل")
    show_in_header = models.BooleanField(default=False, verbose_name="عرض في الرأس")
    show_on_landing = models.BooleanField(default=True, verbose_name="عرض في صفحة الهبوط")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="ترتيب العرض")
    published_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ النشر")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_static_pages",
        verbose_name="أنشئ بواسطة",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "صفحة ثابتة"
        verbose_name_plural = "الصفحات الثابتة"
        ordering = ["sort_order", "-updated_at"]

    def __str__(self):
        return self.title
