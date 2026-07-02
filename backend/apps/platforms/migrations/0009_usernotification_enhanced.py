from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0013_event_live_broadcast_token"),
        ("platforms", "0008_add_performance_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="usernotification",
            name="kind",
            field=models.CharField(
                choices=[
                    ("system", "نظام"),
                    ("event_created", "فعالية جديدة"),
                    ("event_started", "بدء الفعالية"),
                    ("event_ended", "انتهاء الفعالية"),
                    ("preparation_complete", "اكتمال التجهيزات"),
                    ("rsvp_started", "بدء التأكيدات"),
                    ("rsvp_confirmed", "تأكيد حضور"),
                    ("rsvp_declined", "اعتذار"),
                    ("checkin_started", "بدء الحضور"),
                    ("guest_checked_in", "حضور ضيف"),
                    ("seating_started", "بدء الإجلاس"),
                    ("seating_full", "اكتمال الإجلاس"),
                    ("team_assigned", "تعيين فريق"),
                    ("direct_message", "رسالة مباشرة"),
                ],
                default="system",
                max_length=40,
                verbose_name="النوع",
            ),
        ),
        migrations.AddField(
            model_name="usernotification",
            name="event",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="user_notifications",
                to="events.event",
                verbose_name="الفعالية",
            ),
        ),
        migrations.AddField(
            model_name="usernotification",
            name="action_path",
            field=models.CharField(blank=True, max_length=500, verbose_name="رابط الإجراء"),
        ),
        migrations.AddField(
            model_name="usernotification",
            name="icon",
            field=models.CharField(blank=True, max_length=64, verbose_name="أيقونة"),
        ),
        migrations.AddIndex(
            model_name="usernotification",
            index=models.Index(fields=["user", "is_read", "-created_at"], name="notif_user_read_idx"),
        ),
        migrations.AddIndex(
            model_name="usernotification",
            index=models.Index(fields=["event", "kind"], name="notif_event_kind_idx"),
        ),
    ]
