# Generated manually for reminder opt-in scheduling

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("guests", "0008_guest_status_pending"),
    ]

    operations = [
        migrations.AddField(
            model_name="guest",
            name="reminder_opted_in",
            field=models.BooleanField(
                default=False,
                help_text="نعم ذكرني — يُجدول التذكير ورمز QR قبل المناسبة بيوم",
                verbose_name="وافق على التذكير المسبق",
            ),
        ),
        migrations.AddField(
            model_name="guest",
            name="reminder_scheduled_for",
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                null=True,
                verbose_name="موعد إرسال التذكير المجدول",
            ),
        ),
        migrations.AddField(
            model_name="guest",
            name="reminder_sent_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="تاريخ إرسال التذكير المجدول",
            ),
        ),
        migrations.AddIndex(
            model_name="guest",
            index=models.Index(
                fields=["reminder_scheduled_for", "reminder_sent_at"],
                name="guests_gues_remind_sched_idx",
            ),
        ),
    ]
