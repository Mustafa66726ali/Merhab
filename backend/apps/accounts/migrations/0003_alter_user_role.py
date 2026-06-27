from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_recovery_email_enabled"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("system_manager", "مدير النظام"),
                    ("platform_admin", "مدير المنصة"),
                    ("event_manager", "مدير الفعالية"),
                    ("event_organizer", "منظم الفعالية"),
                    ("staff", "طاقم العمل"),
                    ("guest", "ضيف"),
                ],
                default="guest",
                max_length=20,
                verbose_name="الدور",
            ),
        ),
    ]
