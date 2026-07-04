from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("guests", "0007_guest_unique_contact_per_event"),
    ]

    operations = [
        migrations.AlterField(
            model_name="guest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "جديد"),
                    ("invited", "مدعو"),
                    ("confirmed", "مؤكد الحضور"),
                    ("attended", "حضر"),
                    ("seated", "جلس"),
                    ("declined", "معتذر"),
                    ("cancelled", "ملغي"),
                ],
                default="pending",
                max_length=15,
                verbose_name="الحالة",
            ),
        ),
    ]
