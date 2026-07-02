from django.db import models
from django.conf import settings
from apps.events.models import Event


class StaffMember(models.Model):
    class Role(models.TextChoices):
        COORDINATOR = "coordinator", "منسق"
        ENTRY_MANAGER = "entry_manager", "مدير دخول"
        USHER = "usher", "مرشد"
        SECURITY = "security", "أمن"
        CATERING = "catering", "تموين"
        TECHNICAL = "technical", "تقني"
        OTHER = "other", "أخرى"

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="staff_members", verbose_name="الفعالية"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_assignments",
        verbose_name="المستخدم",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OTHER,
        verbose_name="الدور",
    )
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    assigned_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التعيين")

    class Meta:
        verbose_name = "طاقم العمل"
        verbose_name_plural = "طاقم العمل"
        unique_together = ["event", "user"]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.get_role_display()}"
