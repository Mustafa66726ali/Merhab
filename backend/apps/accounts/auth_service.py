from decouple import config

from apps.accounts.models import User
from apps.accounts.password_utils import verify_password


def ensure_admin_user(email: str, password: str) -> User:
    user, _ = User.objects.get_or_create(
        email=email,
        defaults={
            "username": email,
            "first_name": "مدير",
            "last_name": "النظام",
            "role": User.Role.SYSTEM_MANAGER,
        },
    )
    user.username = email
    user.email = email
    user.role = User.Role.SYSTEM_MANAGER
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.set_password(password)
    user.save()
    return user


def authenticate_login(email: str, password: str) -> User | None:
    email = (email or "").strip().lower()
    password = (password or "").strip()
    if not email or not password:
        return None

    admin_email = config("ADMIN_EMAIL", default="admin@merhab.sa").strip().lower()
    admin_password = config("ADMIN_PASSWORD", default="Merhab@2024").strip()

    if email == admin_email and password == admin_password:
        return ensure_admin_user(admin_email, admin_password)

    account = User.objects.filter(email__iexact=email).first()
    if account and verify_password(account, password):
        return account
    return None
