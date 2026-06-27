from django.core.management.base import BaseCommand

from apps.public_media.services import seed_landing_config


class Command(BaseCommand):
    help = "Seed default landing page configuration"

    def handle(self, *args, **options):
        seed_landing_config()
        self.stdout.write(self.style.SUCCESS("Landing config seeded."))
