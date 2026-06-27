from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0007_group_section_location"),
    ]

    operations = [
        migrations.AddField(
            model_name="section",
            name="location",
            field=models.CharField(blank=True, max_length=255, verbose_name="الموقع"),
        ),
    ]
