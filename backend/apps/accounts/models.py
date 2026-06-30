from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        SYSTEM_MANAGER = "system_manager", "مدير النظام"
        PLATFORM_ADMIN = "platform_admin", "مدير المنصة"
        EVENT_MANAGER = "event_manager", "مدير الفعالية"
        EVENT_ORGANIZER = "event_organizer", "منظم الفعالية"
        STAFF = "staff", "طاقم العمل"
        GUEST = "guest", "ضيف"

    class AccountStatus(models.TextChoices):
        ACTIVE = "active", "نشط"
        INACTIVE = "inactive", "غير نشط"
        BLOCKED = "blocked", "محظور"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.GUEST,
        verbose_name="الدور",
    )
    phone = models.CharField(max_length=20, blank=True, verbose_name="رقم الهاتف")
    recovery_email_enabled = models.BooleanField(
        default=True,
        verbose_name="تفعيل استعادة كلمة المرور عبر البريد",
    )
    two_factor_enabled = models.BooleanField(
        default=False,
        verbose_name="المصادقة الثنائية (2FA)",
    )
    avatar = models.ImageField(upload_to="avatars/", blank=True, verbose_name="الصورة الشخصية")
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
        verbose_name="حالة الحساب",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    def save(self, *args, **kwargs):
        self.is_active = self.account_status == self.AccountStatus.ACTIVE
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"
        ordering = ["-date_joined"]

    def __str__(self):
        return self.get_full_name() or self.username


class PasswordResetCode(models.Model):
    """رمز تحقق لمرة واحدة لاستعادة كلمة المرور عبر البريد."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_codes",
        verbose_name="المستخدم",
    )
    code_hash = models.CharField(max_length=128, verbose_name="تجزئة الرمز")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    expires_at = models.DateTimeField(verbose_name="ينتهي في")
    attempts = models.PositiveSmallIntegerField(default=0, verbose_name="محاولات خاطئة")
    used_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الاستخدام")

    class Meta:
        verbose_name = "رمز استعادة كلمة المرور"
        verbose_name_plural = "رموز استعادة كلمة المرور"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"reset:{self.user_id}@{self.created_at:%Y-%m-%d %H:%M}"
