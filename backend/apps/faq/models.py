from django.conf import settings
from django.db import models


class FAQItem(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "بانتظار الرد"
        ANSWERED = "answered", "تم الرد"
        CLOSED = "closed", "مغلق"

    question = models.TextField(verbose_name="السؤال")
    answer = models.TextField(blank=True, verbose_name="الرد")
    asker_name = models.CharField(max_length=120, blank=True, verbose_name="اسم السائل")
    asker_email = models.EmailField(blank=True, verbose_name="بريد السائل")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="الحالة",
    )
    is_published = models.BooleanField(
        default=False,
        verbose_name="عرض في صفحة الهبوط",
        help_text="يُعرض فقط عند وجود رد",
    )
    sort_order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="faq_replies",
        verbose_name="رد بواسطة",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإرسال")
    updated_at = models.DateTimeField(auto_now=True)
    answered_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الرد")

    class Meta:
        verbose_name = "سؤال / استفسار"
        verbose_name_plural = "الأسئلة والاستفسارات"
        ordering = ["sort_order", "-created_at"]

    def __str__(self):
        return self.question[:80]
