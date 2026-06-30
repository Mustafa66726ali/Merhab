"""استعادة كلمة المرور عبر رمز تحقق يُرسل بالبريد."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.integrations.email_send import is_password_recovery_configured, send_system_email

from .models import PasswordResetCode, User

CODE_LENGTH = 6
CODE_TTL_MINUTES = 15
MAX_ATTEMPTS = 5
MAX_REQUESTS_PER_HOUR = 3

PANEL_ROLES = {
    User.Role.SYSTEM_MANAGER,
    User.Role.PLATFORM_ADMIN,
    User.Role.EVENT_MANAGER,
    User.Role.EVENT_ORGANIZER,
    User.Role.STAFF,
}

GENERIC_SENT_MSG = (
    "إذا كان البريد مسجّلاً ومفعّلاً للاستعادة، ستصلك رسالة برمز التحقق خلال دقائق."
)


def _hash_code(code: str) -> str:
    raw = f"{code.strip()}{settings.SECRET_KEY}".encode()
    return hashlib.sha256(raw).hexdigest()


def _generate_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(CODE_LENGTH))


def _find_recoverable_user(email: str) -> User | None:
    email = (email or "").strip().lower()
    if not email:
        return None
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return None
    if user.account_status != User.AccountStatus.ACTIVE:
        return None
    if user.role not in PANEL_ROLES:
        return None
    if not user.recovery_email_enabled:
        return None
    return user


def request_password_reset(email: str) -> dict:
    """يطلب رمز تحقق — يُرجع رسالة عامة دون كشف وجود الحساب."""
    if not is_password_recovery_configured():
        return {
            "ok": False,
            "detail": "استعادة كلمة المرور غير مفعّلة — يجب على مدير النظام إعداد بريد Gmail/SMTP من التكاملات",
        }

    user = _find_recoverable_user(email)
    if not user:
        return {"ok": True, "detail": GENERIC_SENT_MSG}

    since = timezone.now() - timedelta(hours=1)
    recent = PasswordResetCode.objects.filter(
        user=user, created_at__gte=since, used_at__isnull=True
    ).count()
    if recent >= MAX_REQUESTS_PER_HOUR:
        return {
            "ok": False,
            "detail": "تجاوزت الحد المسموح من الطلبات — حاول بعد ساعة",
        }

    code = _generate_code()
    expires = timezone.now() + timedelta(minutes=CODE_TTL_MINUTES)
    PasswordResetCode.objects.create(
        user=user,
        code_hash=_hash_code(code),
        expires_at=expires,
    )

    subject = "رمز استعادة كلمة المرور — مرحّاب"
    body = (
        f"مرحباً {user.get_full_name() or user.email},\n\n"
        f"رمز التحقق لاستعادة كلمة المرور: {code}\n\n"
        f"صالح لمدة {CODE_TTL_MINUTES} دقيقة.\n"
        "إذا لم تطلب هذا الرمز، تجاهل الرسالة.\n\n"
        "— فريق مرحّاب"
    )
    html = (
        f"<p>مرحباً <strong>{user.get_full_name() or user.email}</strong>,</p>"
        f"<p>رمز التحقق لاستعادة كلمة المرور:</p>"
        f'<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{code}</p>'
        f"<p>صالح لمدة {CODE_TTL_MINUTES} دقيقة.</p>"
        "<p>إذا لم تطلب هذا الرمز، تجاهل الرسالة.</p>"
    )
    sent, detail = send_system_email(user.email, subject, body, html)
    if not sent:
        return {"ok": False, "detail": detail}

    return {"ok": True, "detail": GENERIC_SENT_MSG}


def reset_password_with_code(email: str, code: str, new_password: str) -> dict:
    """يتحقق من الرمز ويُعيّن كلمة مرور جديدة."""
    email = (email or "").strip().lower()
    code = (code or "").strip()
    new_password = (new_password or "").strip()

    if not email or not code or len(new_password) < 6:
        return {"ok": False, "detail": "البريد والرمز وكلمة المرور (6 أحرف على الأقل) مطلوبة"}

    user = _find_recoverable_user(email)
    if not user:
        return {"ok": False, "detail": "رمز التحقق غير صحيح أو منتهي الصلاحية"}

    reset_row = (
        PasswordResetCode.objects.filter(user=user, used_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if not reset_row:
        return {"ok": False, "detail": "لا يوجد رمز تحقق نشط — اطلب رمزاً جديداً"}

    if timezone.now() > reset_row.expires_at:
        return {"ok": False, "detail": "انتهت صلاحية رمز التحقق — اطلب رمزاً جديداً"}

    if reset_row.attempts >= MAX_ATTEMPTS:
        return {"ok": False, "detail": "تجاوزت عدد المحاولات — اطلب رمزاً جديداً"}

    if _hash_code(code) != reset_row.code_hash:
        reset_row.attempts += 1
        reset_row.save(update_fields=["attempts"])
        remaining = MAX_ATTEMPTS - reset_row.attempts
        if remaining <= 0:
            return {"ok": False, "detail": "تجاوزت عدد المحاولات — اطلب رمزاً جديداً"}
        return {
            "ok": False,
            "detail": f"رمز التحقق غير صحيح — متبقٍ {remaining} محاولة",
        }

    user.set_password(new_password)
    user.save(update_fields=["password"])
    reset_row.used_at = timezone.now()
    reset_row.save(update_fields=["used_at"])
    PasswordResetCode.objects.filter(user=user, used_at__isnull=True).exclude(
        pk=reset_row.pk
    ).update(used_at=timezone.now())

    return {"ok": True, "detail": "تم تغيير كلمة المرور بنجاح — يمكنك تسجيل الدخول الآن"}
