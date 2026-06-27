# Generated manually — geographic fields for events

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0003_alter_event_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="geo_address",
            field=models.CharField(
                blank=True,
                max_length=500,
                verbose_name="الموقع الجغرافي (نص)",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name="خط العرض",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="longitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name="خط الطول",
            ),
        ),
    ]
