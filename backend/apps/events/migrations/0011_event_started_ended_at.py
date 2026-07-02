from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0010_event_auto_reminder_enabled_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="started_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="وقت بدء التشغيل",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="ended_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="وقت إنهاء التشغيل",
            ),
        ),
        migrations.AlterField(
            model_name="event",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "مسودة"),
                    ("active", "تعمل الآن"),
                    ("completed", "منتهية"),
                    ("cancelled", "ملغي"),
                    ("archived", "مؤرشف"),
                ],
                default="draft",
                max_length=15,
                verbose_name="الحالة",
            ),
        ),
    ]
