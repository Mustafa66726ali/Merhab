from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0002_event_platform"),
    ]

    operations = [
        migrations.AlterField(
            model_name="event",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "مسودة"),
                    ("active", "نشط"),
                    ("completed", "مكتمل"),
                    ("cancelled", "ملغي"),
                    ("archived", "مؤرشف"),
                ],
                default="draft",
                max_length=15,
                verbose_name="الحالة",
            ),
        ),
    ]
