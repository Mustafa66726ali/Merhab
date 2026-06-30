from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("messages_app", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="kind",
            field=models.CharField(
                choices=[
                    ("general", "عام"),
                    ("greeting", "تهنئة"),
                    ("inquiry", "استفسار للمنسق"),
                ],
                default="general",
                max_length=20,
                verbose_name="نوع الرسالة",
            ),
        ),
        migrations.AddField(
            model_name="message",
            name="recipient",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="received_guest_messages",
                to=settings.AUTH_USER_MODEL,
                verbose_name="المستلم",
            ),
        ),
    ]
