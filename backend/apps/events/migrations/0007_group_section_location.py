import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0006_section_created_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="location",
            field=models.CharField(blank=True, max_length=255, verbose_name="الموقع"),
        ),
        migrations.AddField(
            model_name="group",
            name="section",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="groups",
                to="events.section",
                verbose_name="القسم",
            ),
        ),
    ]
