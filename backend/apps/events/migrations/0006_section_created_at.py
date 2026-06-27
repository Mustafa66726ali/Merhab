from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0005_add_performance_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="section",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True,
                default=timezone.now,
                verbose_name="تاريخ الإنشاء",
            ),
            preserve_default=False,
        ),
    ]
