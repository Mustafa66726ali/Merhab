from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0008_section_location"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="invitation_title",
            field=models.CharField(
                blank=True, max_length=255, verbose_name="عنوان الدعوة"
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="invitation_message",
            field=models.TextField(
                blank=True,
                help_text="يدعم الحقول: {name} {event} {date} {time} {venue} {link}",
                verbose_name="نص الدعوة الافتراضي",
            ),
        ),
    ]
