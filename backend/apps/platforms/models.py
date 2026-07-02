from django.conf import settings
from django.db import models


class Platform(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "نشطة"
        BLOCKED = "blocked", "محظورة"

    name = models.CharField(max_length=255, verbose_name="اسم المنصة")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_platforms",
        verbose_name="المالك",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="الحالة",
    )
    description = models.TextField(blank=True, verbose_name="الوصف")
    whatsapp_number = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="رقم واتساب الدعوات",
        help_text="يُستخدم لإرسال دعوات الفعاليات عبر واتساب (صيغة E.164)",
    )
    whatsapp_invites_enabled = models.BooleanField(
        default=False,
        verbose_name="تفعيل دعوات واتساب",
    )
    logo = models.ImageField(
        upload_to="platforms/logos/",
        blank=True,
        verbose_name="شعار المنصة",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "منصة"
        verbose_name_plural = "المنصات"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class PlatformMember(models.Model):
    class MemberRole(models.TextChoices):
        EVENT_MANAGER = "event_manager", "مدير فعالية"
        EVENT_ORGANIZER = "event_organizer", "منظم فعالية"
        COORDINATOR = "coordinator", "منسق"
        ENTRY_MANAGER = "entry_manager", "مدير دخول"

    platform = models.ForeignKey(
        Platform,
        on_delete=models.CASCADE,
        related_name="members",
        verbose_name="المنصة",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="platform_memberships",
        verbose_name="المستخدم",
    )
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الانضمام")
    member_role = models.CharField(
        max_length=20,
        choices=MemberRole.choices,
        default=MemberRole.EVENT_MANAGER,
        verbose_name="دور المنصة",
    )
    coordinator_label = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="نوع المنسق",
    )
    perm_scan_qr = models.BooleanField(default=False, verbose_name="مسح QR")
    perm_edit_guests = models.BooleanField(default=False, verbose_name="تعديل الضيوف")
    perm_send_messages = models.BooleanField(default=False, verbose_name="إرسال رسائل")

    class Meta:
        verbose_name = "عضو منصة"
        verbose_name_plural = "أعضاء المنصات"
        unique_together = ["platform", "user"]

    def __str__(self):
        return f"{self.user} — {self.platform}"


class DirectMessage(models.Model):
    class DeliveryStatus(models.TextChoices):
        PENDING = "pending", "قيد الإرسال"
        DELIVERED = "delivered", "تم التسليم"
        FAILED = "failed", "فشل التسليم"

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_direct_messages",
        verbose_name="المرسل",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_direct_messages",
        verbose_name="المستلم",
    )
    platform = models.ForeignKey(
        Platform,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_messages",
        verbose_name="المنصة",
    )
    subject = models.CharField(max_length=255, blank=True, verbose_name="الموضوع")
    body = models.TextField(verbose_name="المحتوى")
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
        verbose_name="رد على",
    )
    is_read = models.BooleanField(default=False, verbose_name="مقروءة")
    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.DELIVERED,
        verbose_name="حالة التسليم",
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت التسليم",
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت القراءة / الفتح",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإرسال")

    class Meta:
        verbose_name = "رسالة مباشرة"
        verbose_name_plural = "الرسائل المباشرة"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.sender} → {self.recipient}"


class UserNotification(models.Model):
    class Kind(models.TextChoices):
        SYSTEM = "system", "نظام"
        EVENT_CREATED = "event_created", "فعالية جديدة"
        EVENT_STARTED = "event_started", "بدء الفعالية"
        EVENT_ENDED = "event_ended", "انتهاء الفعالية"
        PREPARATION_COMPLETE = "preparation_complete", "اكتمال التجهيزات"
        RSVP_STARTED = "rsvp_started", "بدء التأكيدات"
        RSVP_CONFIRMED = "rsvp_confirmed", "تأكيد حضور"
        RSVP_DECLINED = "rsvp_declined", "اعتذار"
        CHECKIN_STARTED = "checkin_started", "بدء الحضور"
        GUEST_CHECKED_IN = "guest_checked_in", "حضور ضيف"
        SEATING_STARTED = "seating_started", "بدء الإجلاس"
        SEATING_FULL = "seating_full", "اكتمال الإجلاس"
        TEAM_ASSIGNED = "team_assigned", "تعيين فريق"
        DIRECT_MESSAGE = "direct_message", "رسالة مباشرة"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_notifications",
        verbose_name="المستخدم",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_user_notifications",
        verbose_name="المرسل",
    )
    platform = models.ForeignKey(
        Platform,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
        verbose_name="المنصة",
    )
    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_notifications",
        verbose_name="الفعالية",
    )
    kind = models.CharField(
        max_length=40,
        choices=Kind.choices,
        default=Kind.SYSTEM,
        verbose_name="النوع",
    )
    title = models.CharField(max_length=255, verbose_name="العنوان")
    body = models.TextField(verbose_name="المحتوى")
    action_path = models.CharField(max_length=500, blank=True, verbose_name="رابط الإجراء")
    icon = models.CharField(max_length=64, blank=True, verbose_name="أيقونة")
    is_read = models.BooleanField(default=False, verbose_name="مقروء")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "إشعار مستخدم"
        verbose_name_plural = "إشعارات المستخدمين"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
