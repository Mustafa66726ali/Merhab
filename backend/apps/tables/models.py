from django.db import models
from apps.events.models import Event, Section, Group
from apps.guests.models import Guest


class SeatingPlan(models.Model):
    """مخطط جلوس — يحتوي طاولات ومقاعد."""

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="seating_plans",
        verbose_name="الفعالية",
    )
    name = models.CharField(max_length=120, verbose_name="اسم المخطط")
    description = models.TextField(blank=True, verbose_name="الوصف")
    order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "مخطط جلوس"
        verbose_name_plural = "مخططات الجلوس"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.name} — {self.event.title}"


class Table(models.Model):
    class Shape(models.TextChoices):
        ROUND = "round", "دائري"
        RECTANGLE = "rectangle", "مستطيل"
        SQUARE = "square", "مربع"

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="tables", verbose_name="الفعالية"
    )
    plan = models.ForeignKey(
        SeatingPlan,
        on_delete=models.CASCADE,
        related_name="tables",
        null=True,
        blank=True,
        verbose_name="المخطط",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tables",
        verbose_name="القسم",
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tables",
        verbose_name="المجموعة",
    )
    name = models.CharField(max_length=100, verbose_name="الاسم")
    capacity = models.PositiveIntegerField(default=8, verbose_name="السعة")
    shape = models.CharField(
        max_length=15,
        choices=Shape.choices,
        default=Shape.ROUND,
        verbose_name="الشكل",
    )
    position_x = models.FloatField(default=0, verbose_name="الموقع X")
    position_y = models.FloatField(default=0, verbose_name="الموقع Y")
    seat_positions = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="مواقع الكراسي المخصصة",
        help_text="خريطة رقم المقعد إلى إزاحة {x, y} حول مركز الطاولة (إحداثيات منطقية)",
    )

    class Meta:
        verbose_name = "طاولة"
        verbose_name_plural = "الطاولات"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.event.title})"


class TableSeat(models.Model):
    table = models.ForeignKey(
        Table, on_delete=models.CASCADE, related_name="seats", verbose_name="الطاولة"
    )
    guest = models.OneToOneField(
        Guest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="seat",
        verbose_name="الضيف",
    )
    seat_number = models.PositiveIntegerField(verbose_name="رقم المقعد")

    class Meta:
        verbose_name = "مقعد"
        verbose_name_plural = "المقاعد"
        unique_together = ["table", "seat_number"]

    def __str__(self):
        guest_name = self.guest.full_name if self.guest else "فارغ"
        return f"{self.table.name} - مقعد {self.seat_number}: {guest_name}"
