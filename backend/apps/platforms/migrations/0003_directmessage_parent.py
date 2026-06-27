import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platforms", "0002_directmessage_usernotification"),
    ]

    operations = [
        migrations.AddField(
            model_name="directmessage",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="replies",
                to="platforms.directmessage",
                verbose_name="رد على",
            ),
        ),
    ]
