from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0011_event_started_ended_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="live_media_enabled",
            field=models.BooleanField(default=False, verbose_name="تفعيل البث للضيوف"),
        ),
        migrations.AddField(
            model_name="event",
            name="live_media_mode",
            field=models.CharField(
                choices=[
                    ("off", "متوقف"),
                    ("audio_file", "ملف صوتي"),
                    ("youtube", "يوتيوب"),
                    ("microphone", "ميكروفون مباشر"),
                    ("camera", "كamera مباشر"),
                ],
                default="off",
                max_length=20,
                verbose_name="نوع البث",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="live_youtube_url",
            field=models.CharField(blank=True, max_length=500, verbose_name="رابط يوتيوب"),
        ),
        migrations.AddField(
            model_name="event",
            name="live_audio_file",
            field=models.FileField(
                blank=True,
                upload_to="events/live_audio/",
                verbose_name="ملف صوتي للبث",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="live_stream_file",
            field=models.FileField(
                blank=True,
                upload_to="events/live_stream/",
                verbose_name="آخر مقطع بث مباشر",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="live_stream_active",
            field=models.BooleanField(default=False, verbose_name="البث المباشر نشط"),
        ),
        migrations.AddField(
            model_name="event",
            name="live_stream_rev",
            field=models.PositiveIntegerField(default=0, verbose_name="إصدار البث"),
        ),
    ]
