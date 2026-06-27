# Generated manually for platform logo field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platforms", "0006_platform_whatsapp_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="platform",
            name="logo",
            field=models.ImageField(
                blank=True,
                upload_to="platforms/logos/",
                verbose_name="شعار المنصة",
            ),
        ),
    ]
