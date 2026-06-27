"""أدوات مساعدة للتحقق من كلمة المرور بأمان."""

from django.contrib.auth.hashers import identify_hasher


def has_valid_password_hash(user) -> bool:
    raw = user.password or ""
    if not raw or raw.startswith("!"):
        return False
    try:
        identify_hasher(raw)
        return True
    except ValueError:
        return False


def verify_password(user, raw_password: str) -> bool:
    if not user.is_active or not has_valid_password_hash(user):
        return False
    try:
        return user.check_password(raw_password)
    except (ValueError, TypeError):
        return False
