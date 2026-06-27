from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.accounts.password_utils import has_valid_password_hash


class Command(BaseCommand):
    help = "Repair users with corrupted or plain-text password fields."

    def handle(self, *args, **options):
        fixed = 0
        skipped = 0
        with transaction.atomic():
            for user in User.objects.all().iterator():
                if has_valid_password_hash(user):
                    skipped += 1
                    continue
                if user.role == User.Role.SYSTEM_MANAGER and user.is_superuser:
                    from decouple import config

                    user.set_password(config("ADMIN_PASSWORD", default="Merhab@2024"))
                else:
                    user.set_unusable_password()
                user.save(update_fields=["password"])
                fixed += 1
                self.stdout.write(f"Fixed password hash for user id={user.id} email={user.email}")

        self.stdout.write(self.style.SUCCESS(f"Done. fixed={fixed}, already_valid={skipped}"))
