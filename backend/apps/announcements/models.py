from django.db import models
from django.utils import timezone


class Announcement(models.Model):
    class Section(models.TextChoices):
        BANNER = "banner", "إعلان / بانر (سلايدر)"
        VIDEO = "video", "فيديو إعلاني"

    class MediaType(models.TextChoices):
        IMAGE = "image", "صورة"
        VIDEO_URL = "video_url", "رابط فيديو"
        VIDEO_FILE = "video_file", "ملف فيديو"

    title = models.CharField(max_length=255, verbose_name="العنوان")
    description = models.TextField(blank=True, verbose_name="الوصف")
    section = models.CharField(
        max_length=20,
        choices=Section.choices,
        default=Section.BANNER,
        verbose_name="القسم",
    )
    media_type = models.CharField(
        max_length=20,
        choices=MediaType.choices,
        default=MediaType.IMAGE,
        verbose_name="نوع الوسائط",
    )
    image = models.ImageField(upload_to="announcements/images/", blank=True, null=True, verbose_name="صورة")
    video_file = models.FileField(upload_to="announcements/videos/", blank=True, null=True, verbose_name="ملف فيديو")
    video_url = models.URLField(blank=True, max_length=500, verbose_name="رابط الفيديو")
    link_url = models.URLField(blank=True, max_length=500, verbose_name="رابط عند النقر")
    display_duration = models.PositiveIntegerField(
        default=5,
        verbose_name="مدة الظهور (ثانية)",
        help_text="مدة عرض الشريحة أو الفيديو في السلايدر",
    )
    sort_order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    show_on_landing = models.BooleanField(default=True, verbose_name="عرض في صفحة الهبوط")
    starts_at = models.DateTimeField(null=True, blank=True, verbose_name="يبدأ من")
    ends_at = models.DateTimeField(null=True, blank=True, verbose_name="ينتهي في")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "إعلان"
        verbose_name_plural = "الإعلانات والبانرات"
        ordering = ["section", "sort_order", "-created_at"]

    def __str__(self):
        return self.title

    def is_visible_now(self) -> bool:
        if not self.is_active or not self.show_on_landing:
            return False
        now = timezone.now()
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        return True
