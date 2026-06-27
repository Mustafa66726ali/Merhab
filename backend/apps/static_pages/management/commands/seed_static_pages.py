from django.core.management.base import BaseCommand

from apps.static_pages.services import seed_default_pages


class Command(BaseCommand):
    help = "Seed default static pages templates (about, privacy, terms, etc.)"

    def handle(self, *args, **options):
        created, updated = seed_default_pages()
        self.stdout.write(self.style.SUCCESS(f"Seed complete: created={created}, updated={updated}"))
