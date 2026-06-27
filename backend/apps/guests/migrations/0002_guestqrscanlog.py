# Generated manually

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("events", "0001_initial"),
        ("guests", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="GuestQrScanLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scanned_at", models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="وقت المسح")),
                (
                    "event",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="qr_scan_logs",
                        to="events.event",
                        verbose_name="الفعالية",
                    ),
                ),
                (
                    "guest",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="qr_scan_logs",
                        to="guests.guest",
                        verbose_name="الضيف",
                    ),
                ),
                (
                    "scanner",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="qr_scans_performed",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="المسح بواسطة",
                    ),
                ),
            ],
            options={
                "verbose_name": "سجل مسح QR",
                "verbose_name_plural": "سجلات مسح QR",
                "ordering": ["-scanned_at"],
            },
        ),
    ]
