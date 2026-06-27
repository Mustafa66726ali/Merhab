from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("guests", "0005_alter_guest_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="guest",
            name="greeting",
            field=models.TextField(blank=True, verbose_name="كلمة تهنئة من الضيف"),
        ),
    ]
