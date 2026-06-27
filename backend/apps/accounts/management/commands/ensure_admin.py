from decouple import config
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Create or reset the Merhab system admin with a valid password hash."

    def handle(self, *args, **options):
        email = config("ADMIN_EMAIL", default="admin@merhab.sa").strip().lower()
        password = config("ADMIN_PASSWORD", default="Merhab@2024").strip()

        with transaction.atomic():
            duplicates = User.objects.filter(email__iexact=email).order_by("id")
            user = duplicates.first()

            if duplicates.count() > 1:
                dup_ids = list(duplicates.values_list("id", flat=True)[1:])
                User.objects.filter(id__in=dup_ids).delete()
                self.stdout.write(self.style.WARNING(f"Removed duplicate admin rows: {dup_ids}"))

            stale_username = User.objects.filter(username="admin").exclude(email__iexact=email).first()
            if stale_username:
                stale_username.delete()
                self.stdout.write(self.style.WARNING("Removed stale 'admin' username account"))

            if not user:
                user = User.objects.create(
                    username=email,
                    email=email,
                    first_name="مدير",
                    last_name="النظام",
                    role=User.Role.SYSTEM_MANAGER,
                )
                created = True
            else:
                created = False

            user.username = email
            user.email = email
            user.role = User.Role.SYSTEM_MANAGER
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.set_password(password)
            user.save()

        action = "created" if created else "reset"
        self.stdout.write(self.style.SUCCESS(f"Admin account {action}: {email}"))
        self.stdout.write(self.style.SUCCESS(f"Password set from ADMIN_PASSWORD in .env"))
