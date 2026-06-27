from django.conf import settings
from django.db import models


class LandingSiteConfig(models.Model):
    """إعدادات صفحة الهبوط — سجل واحد (singleton)."""

    hero_title = models.CharField(
        max_length=255,
        default="منصة إدارة المناسبات والفعاليات",
        verbose_name="عنوان الهبوط",
    )
    hero_subtitle = models.CharField(
        max_length=500,
        default="خطط لحفلاتك ومناسباتك بسهولة — دعوات، ضيوف، RSVP، وتقارير شاملة",
        verbose_name="العنوان الفرعي",
    )
    hero_description = models.TextField(
        blank=True,
        default="مرحّاب منصة سعودية متخصصة في إدارة المناسبات والفعاليات للأفراد والمؤسسات.",
        verbose_name="وصف الهبوط",
    )
    hero_cta_primary = models.CharField(max_length=80, default="ابدأ الآن", verbose_name="زر أساسي")
    hero_cta_primary_url = models.CharField(max_length=255, default="/login", verbose_name="رابط الزر الأساسي")
    hero_cta_secondary = models.CharField(max_length=80, default="تعرف علينا", verbose_name="زر ثانوي")
    hero_cta_secondary_url = models.CharField(max_length=255, default="#about", verbose_name="رابط الزر الثانوي")
    stats = models.JSONField(
        default=list,
        blank=True,
        verbose_name="أرقام وإحصائيات",
        help_text="قائمة {label, value, icon}",
    )
    features = models.JSONField(
        default=list,
        blank=True,
        verbose_name="المميزات",
        help_text="قائمة {icon, title, description}",
    )
    testimonials = models.JSONField(default=list, blank=True, verbose_name="شهادات العملاء")
    partners_title = models.CharField(max_length=255, blank=True, default="شركاء النجاح", verbose_name="عنوان الشركاء")
    gallery_title = models.CharField(max_length=255, blank=True, default="من معرض المناسبات", verbose_name="عنوان المعرض")
    video_section_title = models.CharField(max_length=255, blank=True, default="شاهد مرحّاب", verbose_name="عنوان قسم الفيديو")
    contact_email = models.EmailField(blank=True, default="support@merhab.sa", verbose_name="بريد التواصل")
    contact_phone = models.CharField(max_length=30, blank=True, verbose_name="هاتف التواصل")
    meta_title = models.CharField(max_length=255, blank=True, default="مرحّاب | إدارة المناسبات", verbose_name="SEO عنوان")
    meta_description = models.CharField(max_length=500, blank=True, verbose_name="SEO وصف")
    is_published = models.BooleanField(default=True, verbose_name="صفحة الهبوط منشورة")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "إعدادات صفحة الهبوط"
        verbose_name_plural = "إعدادات صفحة الهبوط"

    def __str__(self):
        return "إعدادات صفحة الهبوط"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class PublicMediaItem(models.Model):
    class MediaType(models.TextChoices):
        IMAGE = "image", "صورة"
        VIDEO_URL = "video_url", "رابط فيديو (YouTube/Vimeo)"
        VIDEO_FILE = "video_file", "ملف فيديو"

    class Section(models.TextChoices):
        HERO = "hero", "الهبوط الرئيسي"
        GALLERY = "gallery", "معرض الصور"
        VIDEO = "video", "قسم الفيديو"
        BANNER = "banner", "بانر إعلاني"
        FEATURES = "features", "صور المميزات"

    title = models.CharField(max_length=255, verbose_name="العنوان")
    description = models.TextField(blank=True, verbose_name="الوصف")
    alt_text = models.CharField(max_length=255, blank=True, verbose_name="نص بديل")
    media_type = models.CharField(
        max_length=20,
        choices=MediaType.choices,
        default=MediaType.IMAGE,
        verbose_name="نوع الوسائط",
    )
    section = models.CharField(
        max_length=20,
        choices=Section.choices,
        default=Section.GALLERY,
        verbose_name="القسم",
    )
    file = models.FileField(upload_to="public_media/", blank=True, null=True, verbose_name="ملف")
    video_url = models.URLField(blank=True, max_length=500, verbose_name="رابط الفيديو")
    thumbnail = models.ImageField(upload_to="public_media/thumbs/", blank=True, null=True, verbose_name="صورة مصغرة")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    is_featured = models.BooleanField(default=False, verbose_name="مميز")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "وسيط عام"
        verbose_name_plural = "الوسائط العامة"
        ordering = ["section", "sort_order", "-is_featured", "-created_at"]

    def __str__(self):
        return self.title


class TestimonialSubmission(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "بانتظار المراجعة"
        APPROVED = "approved", "موافق عليه"
        REJECTED = "rejected", "مرفوض"

    class Source(models.TextChoices):
        VISITOR = "visitor", "زائر"
        ADMIN = "admin", "إدارة"

    name = models.CharField(max_length=120, verbose_name="الاسم")
    role = models.CharField(max_length=120, blank=True, verbose_name="الصفة / المؤسسة")
    text = models.TextField(verbose_name="الرأي")
    email = models.EmailField(blank=True, verbose_name="البريد")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="الحالة",
    )
    show_on_landing = models.BooleanField(
        default=False,
        verbose_name="عرض في صفحة الهبوط",
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.VISITOR,
        verbose_name="المصدر",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_testimonials",
        verbose_name="راجع بواسطة",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "رأي عميل"
        verbose_name_plural = "آراء العملاء"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}: {self.text[:40]}"
