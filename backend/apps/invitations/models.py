from django.db import models
from apps.events.models import Event
from apps.guests.models import Guest


class Invitation(models.Model):
    class Method(models.TextChoices):
        EMAIL = "email", "بريد إلكتروني"
        SMS = "sms", "رسالة نصية"
        WHATSAPP = "whatsapp", "واتساب"
        QR = "qr", "رمز QR"

    class Status(models.TextChoices):
        PENDING = "pending", "قيد الانتظار"
        SENT = "sent", "تم الإرسال"
        DELIVERED = "delivered", "تم التسليم"
        OPENED = "opened", "تم الفتح"
        FAILED = "failed", "فشل"

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="invitations", verbose_name="الفعالية"
    )
    guest = models.ForeignKey(
        Guest, on_delete=models.CASCADE, related_name="invitations", verbose_name="الضيف"
    )
    method = models.CharField(
        max_length=15,
        choices=Method.choices,
        default=Method.EMAIL,
        verbose_name="طريقة الإرسال",
    )
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="الحالة",
    )
    subject = models.CharField(max_length=255, blank=True, verbose_name="الموضوع")
    message = models.TextField(blank=True, verbose_name="الرسالة")
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإرسال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "دعوة"
        verbose_name_plural = "الدعوات"
        ordering = ["-created_at"]

    def __str__(self):
        return f"دعوة {self.guest.full_name} - {self.event.title}"
