from django.conf import settings
from django.db import models


class ExternalLink(models.Model):
    class LinkType(models.TextChoices):
        WEBSITE = "website", "موقع ويب"
        FACEBOOK = "facebook", "Facebook"
        INSTAGRAM = "instagram", "Instagram"
        TWITTER = "twitter", "X (Twitter)"
        LINKEDIN = "linkedin", "LinkedIn"
        YOUTUBE = "youtube", "YouTube"
        TIKTOK = "tiktok", "TikTok"
        WHATSAPP = "whatsapp", "WhatsApp"
        TELEGRAM = "telegram", "Telegram"
        SNAPCHAT = "snapchat", "Snapchat"
        APP_STORE = "app_store", "App Store"
        PLAY_STORE = "play_store", "Google Play"
        SUPPORT = "support", "دعم فني"
        DOCUMENTATION = "documentation", "وثائق / مساعدة"
        PAYMENT = "payment", "بوابة دفع"
        CUSTOM = "custom", "رابط مخصص"

    class Category(models.TextChoices):
        SOCIAL = "social", "وسائل التواصل"
        WEBSITE = "website", "المواقع"
        APP = "app", "تطبيقات الجوال"
        SUPPORT = "support", "الدعم والمساعدة"
        LEGAL = "legal", "قانوني"
        MARKETING = "marketing", "تسويق"
        PAYMENT = "payment", "الدفع"
        OTHER = "other", "أخرى"

    class Placement(models.TextChoices):
        FOOTER = "footer", "تذييل الموقع"
        HEADER = "header", "رأس الموقع"
        SIDEBAR = "sidebar", "الشريط الجانبي"
        LANDING = "landing", "صفحة الهبوط"
        MOBILE = "mobile", "تطبيق الجوال"
        ALL = "all", "جميع الأماكن"

    title = models.CharField(max_length=255, verbose_name="العنوان")
    url = models.URLField(max_length=500, verbose_name="الرابط")
    link_type = models.CharField(
        max_length=30,
        choices=LinkType.choices,
        default=LinkType.WEBSITE,
        verbose_name="نوع الرابط",
    )
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.WEBSITE,
        verbose_name="الفئة",
    )
    placement = models.CharField(
        max_length=20,
        choices=Placement.choices,
        default=Placement.ALL,
        verbose_name="مكان العرض",
    )
    description = models.TextField(blank=True, verbose_name="الوصف")
    icon = models.CharField(max_length=64, blank=True, verbose_name="أيقونة مخصصة")
    platform = models.ForeignKey(
        "platforms.Platform",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="external_links",
        verbose_name="المنصة",
    )
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    is_featured = models.BooleanField(default=False, verbose_name="مميز")
    open_in_new_tab = models.BooleanField(default=True, verbose_name="فتح في تبويب جديد")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="ترتيب العرض")
    click_count = models.PositiveIntegerField(default=0, verbose_name="عدد النقرات")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_external_links",
        verbose_name="أنشئ بواسطة",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "رابط خارجي"
        verbose_name_plural = "الروابط الخارجية"
        ordering = ["sort_order", "-is_featured", "-created_at"]

    def __str__(self):
        return self.title
