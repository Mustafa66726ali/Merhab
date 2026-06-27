import os

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"

    def ready(self) -> None:
        # runserver spawns a parent watcher; only sync admin in the worker process
        if os.environ.get("RUN_MAIN") != "true":
            return
        from django.conf import settings

        if not settings.DEBUG:
            return
        try:
            from decouple import config

            from apps.accounts.auth_service import ensure_admin_user

            email = config("ADMIN_EMAIL", default="admin@merhab.sa").strip().lower()
            password = config("ADMIN_PASSWORD", default="Merhab@2024").strip()
            ensure_admin_user(email, password)
        except Exception:
            # DB may not be ready during first migrate
            pass
