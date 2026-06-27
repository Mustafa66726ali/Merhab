from django.db import models
from apps.events.models import Event


class Report(models.Model):
    class ReportType(models.TextChoices):
        GUEST_LIST = "guest_list", "قائمة الضيوف"
        ATTENDANCE = "attendance", "الحضور"
        SEATING = "seating", "توزيع المقاعد"
        INVITATIONS = "invitations", "الدعوات"
        SUMMARY = "summary", "ملخص"

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="reports", verbose_name="الفعالية"
    )
    report_type = models.CharField(
        max_length=20,
        choices=ReportType.choices,
        verbose_name="نوع التقرير",
    )
    title = models.CharField(max_length=255, verbose_name="العنوان")
    data = models.JSONField(default=dict, verbose_name="البيانات")
    generated_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التوليد")

    class Meta:
        verbose_name = "تقرير"
        verbose_name_plural = "التقارير"
        ordering = ["-generated_at"]

    def __str__(self):
        return self.title
