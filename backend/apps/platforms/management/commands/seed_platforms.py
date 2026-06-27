from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.platforms.models import Platform, PlatformMember
from apps.events.models import Event

User = get_user_model()

SAMPLE_PLATFORMS = [
    {"name": "منصة الاحتفالات الملكية", "status": "active"},
    {"name": "منصة المؤتمرات التقنية", "status": "active"},
    {"name": "منصة الأعراس والمناسبات", "status": "blocked"},
    {"name": "منصة التعليم والتدريب", "status": "active"},
    {"name": "منصة الفعاليات الرياضية", "status": "active"},
    {"name": "منصة المعارض التجارية", "status": "blocked"},
]


class Command(BaseCommand):
    help = "Seed sample platforms for development"

    def handle(self, *args, **options):
        owner = User.objects.filter(role="system_manager").first()
        if not owner:
            owner = User.objects.first()
        if not owner:
            self.stdout.write(self.style.WARNING("No users found. Run ensure_admin first."))
            return

        other_users = list(User.objects.exclude(id=owner.id)[:5])
        created_count = 0

        for item in SAMPLE_PLATFORMS:
            platform, created = Platform.objects.get_or_create(
                name=item["name"],
                defaults={"owner": owner, "status": item["status"]},
            )
            if created:
                created_count += 1

            PlatformMember.objects.get_or_create(platform=platform, user=owner)
            for u in other_users[:2]:
                PlatformMember.objects.get_or_create(platform=platform, user=u)

            events = Event.objects.filter(platform__isnull=True)[:2]
            for event in events:
                event.platform = platform
                event.save(update_fields=["platform"])

        self.stdout.write(self.style.SUCCESS(f"Platforms ready. New: {created_count}"))
