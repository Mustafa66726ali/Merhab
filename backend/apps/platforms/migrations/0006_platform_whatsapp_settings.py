from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platforms", "0005_directmessage_status_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="platform",
            name="whatsapp_invites_enabled",
            field=models.BooleanField(default=False, verbose_name="تفعيل دعوات واتساب"),
        ),
        migrations.AddField(
            model_name="platform",
            name="whatsapp_number",
            field=models.CharField(
                blank=True,
                help_text="يُستخدم لإرسال دعوات الفعاليات عبر واتساب",
                max_length=20,
                verbose_name="رقم واتساب الدعوات",
            ),
        ),
    ]
