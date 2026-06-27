from django.db import models
from django.conf import settings
from apps.events.models import Event
from apps.guests.models import Guest


class Message(models.Model):
    class Direction(models.TextChoices):
        INCOMING = "incoming", "وارد"
        OUTGOING = "outgoing", "صادر"

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="messages", verbose_name="الفعالية"
    )
    guest = models.ForeignKey(
        Guest,
        on_delete=models.CASCADE,
        related_name="messages",
        null=True,
        blank=True,
        verbose_name="الضيف",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_messages",
        verbose_name="المرسل",
    )
    direction = models.CharField(
        max_length=10,
        choices=Direction.choices,
        default=Direction.OUTGOING,
        verbose_name="الاتجاه",
    )
    content = models.TextField(verbose_name="المحتوى")
    is_read = models.BooleanField(default=False, verbose_name="مقروءة")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإرسال")

    class Meta:
        verbose_name = "رسالة"
        verbose_name_plural = "الرسائل"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_direction_display()} - {self.created_at}"
