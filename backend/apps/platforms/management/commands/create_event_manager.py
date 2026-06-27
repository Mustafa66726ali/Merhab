from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import Platform, PlatformMember
from apps.platforms.team_actions import apply_platform_member_profile


class Command(BaseCommand):
    help = "Create or reset a demo event manager account assigned to platform events."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="eventmanager@merhab.sa")
        parser.add_argument("--password", default="Merhab@2024")
        parser.add_argument("--platform-id", type=int, default=None)

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        platform_id = options["platform_id"]

        platform = None
        if platform_id:
            platform = Platform.objects.filter(id=platform_id, status=Platform.Status.ACTIVE).first()
        if not platform:
            platform = Platform.objects.filter(status=Platform.Status.ACTIVE).order_by("id").first()
        if not platform:
            self.stdout.write(self.style.ERROR("No active platform found. Seed platforms first."))
            return

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email,
                    "first_name": "مدير",
                    "last_name": "الفعالية",
                    "role": User.Role.EVENT_MANAGER,
                },
            )
            user.username = email
            user.role = User.Role.EVENT_MANAGER
            user.is_active = True
            user.is_staff = False
            user.is_superuser = False
            user.set_password(password)
            user.save()

            apply_platform_member_profile(
                platform,
                user,
                PlatformMember.MemberRole.EVENT_MANAGER,
                perm_edit_guests=True,
                perm_send_messages=True,
            )

            events = list(Event.objects.filter(platform=platform).order_by("-created_at")[:3])
            for event in events:
                event.managers.add(user)

        self.stdout.write(self.style.SUCCESS(
            f"Event manager {'created' if created else 'updated'}: {email}"
        ))
        self.stdout.write(self.style.SUCCESS(f"Platform id={platform.id}"))
        self.stdout.write(self.style.SUCCESS(f"Assigned to {len(events)} event(s) as manager"))
